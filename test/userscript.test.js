const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const userscriptSource = fs.readFileSync(path.resolve(__dirname, "../userscript/twitchnosub.user.js"), "utf8");

function firstSingleQuotedImport(source) {
    const match = source.match(/importScripts\('([^']+)'\)/);
    return match && match[1];
}

function createComposite() {
    const blobs = new Map();
    let blobCounter = 0;

    class FakeBlob {
        constructor(parts) {
            this.source = parts.join("");
        }
    }

    function FakeURL(value, base) {
        return new URL(value, base);
    }

    FakeURL.createObjectURL = blob => {
        const url = `blob:https://www.twitch.tv/userscript-${++blobCounter}`;
        blobs.set(url, blob.source);
        return url;
    };
    FakeURL.revokeObjectURL = () => {};

    class FakeXMLHttpRequest {
        open(_method, url) {
            this.url = url;
        }

        overrideMimeType() {}

        send() {
            this.status = 200;
            this.responseText = "self.originalLoaded = true; // amazon-ivs-worker";
        }
    }

    class NativeWorker {
        constructor(url, options) {
            this.url = url;
            this.options = options;
        }
    }

    const document = {
        body: {},
        querySelectorAll() { return []; },
        addEventListener() {}
    };
    const window = {
        Worker: NativeWorker,
        location: { href: "https://www.twitch.tv/videos/123" }
    };
    const context = {
        Blob: FakeBlob,
        console: { error() {} },
        document,
        JSON,
        MutationObserver: class { observe() {} },
        Node: { ELEMENT_NODE: 1 },
        setTimeout() {},
        URL: FakeURL,
        window,
        XMLHttpRequest: FakeXMLHttpRequest
    };

    vm.runInNewContext(userscriptSource, context, { filename: "userscript/twitchnosub.user.js" });
    const worker = new window.Worker("blob:https://www.twitch.tv/original", { type: "classic" });
    const trampoline = blobs.get(worker.url);
    return blobs.get(firstSingleQuotedImport(trampoline));
}

function executeComposite(composite, patchGeneration) {
    const workerSelf = {};
    const context = {
        importScripts() {
            if (patchGeneration === "old") {
                workerSelf.oldPatchLoaded = true;
            } else {
                workerSelf.__TNS_INSTALL_WORKER_PATCH__ = () => {
                    workerSelf.newPatchLoaded = true;
                };
            }
        },
        self: workerSelf
    };

    vm.runInNewContext(composite, context);
    return workerSelf;
}

test("the userscript hooks at document-start and defers only DOM cleanup", () => {
    assert.match(userscriptSource, /@run-at\s+document-start/);
    assert.match(userscriptSource, /DOMContentLoaded/);
});

test("the userscript accepts both cached legacy and factory worker patches", () => {
    const composite = createComposite();
    const oldWorker = executeComposite(composite, "old");
    const newWorker = executeComposite(composite, "new");

    assert.equal(oldWorker.oldPatchLoaded, true);
    assert.equal(oldWorker.originalLoaded, true);
    assert.equal(newWorker.newPatchLoaded, true);
    assert.equal(newWorker.originalLoaded, true);
    assert.equal(newWorker.__TNS_INSTALL_WORKER_PATCH__, undefined);
});
