const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const hookSource = fs.readFileSync(path.resolve(__dirname, "../src/app.js"), "utf8");
const patchSource = fs.readFileSync(path.resolve(__dirname, "../src/patch_amazonworker.js"), "utf8");

function createHarness(WorkerConstructor) {
    const blobs = new Map();
    const sourceByUrl = new Map([
        ["blob:https://www.twitch.tv/original", "importScripts('https://static.twitchcdn.net/amazon-ivs-worker.js');"],
        ["blob:https://www.twitch.tv/unrelated", "self.onmessage = event => postMessage(event.data);"]
    ]);
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
        const url = `blob:https://www.twitch.tv/tns-${++blobCounter}`;
        blobs.set(url, blob.source);
        return url;
    };
    FakeURL.revokeObjectURL = () => {};

    function readSource(url) {
        if (blobs.has(String(url))) return blobs.get(String(url));
        if (sourceByUrl.has(String(url))) return sourceByUrl.get(String(url));
        throw new Error(`No source fixture for ${url}`);
    }

    class FakeXMLHttpRequest {
        open(_method, url) {
            this.url = url;
        }

        overrideMimeType() {}

        send() {
            this.status = 200;
            this.responseText = readSource(this.url);
        }
    }

    const window = {
        Worker: WorkerConstructor,
        location: { href: "https://www.twitch.tv/videos/123" }
    };
    const context = {
        Blob: FakeBlob,
        console: { debug() {}, error() {}, warn() {} },
        JSON,
        setTimeout() {},
        URL: FakeURL,
        window,
        XMLHttpRequest: FakeXMLHttpRequest
    };

    vm.runInNewContext(patchSource, context, { filename: "src/patch_amazonworker.js" });
    vm.runInNewContext(hookSource, context, { filename: "src/app.js" });
    return { blobs, context, readSource, sourceByUrl, window };
}

function firstSingleQuotedImport(source) {
    const match = source.match(/importScripts\('([^']+)'\)/);
    return match && match[1];
}

test("hooks Twitch workers through a composite trampoline and preserves options", () => {
    class NativeWorker {
        constructor(url, options) {
            this.url = url;
            this.options = options;
        }
    }

    const harness = createHarness(NativeWorker);
    const options = { name: "amazon-ivs", type: "classic" };
    const worker = new harness.window.Worker("blob:https://www.twitch.tv/original", options);

    const trampoline = harness.readSource(worker.url);
    const compositeUrl = firstSingleQuotedImport(trampoline);
    const composite = harness.readSource(compositeUrl);

    assert.equal(worker.options, options);
    assert.match(composite, /__TNS_FETCH_PATCHED__/);
    assert.match(composite, /static\.twitchcdn\.net\/amazon-ivs-worker\.js/);

    const workerSelf = { __TNS_EXPOSE_TEST_API__: true, fetch: async () => new Response("ok") };
    vm.runInNewContext(composite, {
        console: { debug() {}, error() {}, log() {}, warn() {} },
        Date,
        Headers,
        importScripts() {},
        Math,
        Number,
        Promise,
        Response,
        self: workerSelf,
        Uint8Array,
        URL
    });
    assert.equal(workerSelf.__TNS_FETCH_PATCHED__, true);
});

test("leaves non-Twitch workers untouched", () => {
    class NativeWorker {
        constructor(url, options) {
            this.url = url;
            this.options = options;
        }
    }

    const harness = createHarness(NativeWorker);
    const worker = new harness.window.Worker("https://example.com/worker.js", { name: "other" });

    assert.equal(worker.url, "https://example.com/worker.js");
    assert.equal(harness.blobs.size, 0);
});

test("leaves unrelated Twitch and module workers untouched", () => {
    class NativeWorker {
        constructor(url, options) {
            this.url = url;
            this.options = options;
        }
    }

    const harness = createHarness(NativeWorker);
    const unrelated = new harness.window.Worker("blob:https://www.twitch.tv/unrelated");
    const moduleWorker = new harness.window.Worker("blob:https://www.twitch.tv/original", { type: "module" });

    assert.equal(unrelated.url, "blob:https://www.twitch.tv/unrelated");
    assert.equal(moduleWorker.url, "blob:https://www.twitch.tv/original");
    assert.equal(harness.blobs.size, 0);
});

test("remains compatible when an AdGuard-style wrapper is installed first", () => {
    let readSource;

    class NativeWorker {
        constructor(url, options) {
            this.url = url;
            this.options = options;
        }
    }

    class AdGuardWorker extends NativeWorker {
        constructor(url, options) {
            const nestedUrl = firstSingleQuotedImport(readSource(url));
            super(nestedUrl || url, options);
        }
    }

    const harness = createHarness(AdGuardWorker);
    readSource = harness.readSource;
    const worker = new harness.window.Worker("blob:https://www.twitch.tv/original", { name: "ivs" });
    const composite = harness.readSource(worker.url);

    assert.match(composite, /__TNS_FETCH_PATCHED__/);
    assert.match(composite, /amazon-ivs-worker\.js/);
});

test("remains compatible when an AdGuard-style wrapper is installed afterwards", () => {
    class NativeWorker {
        constructor(url, options) {
            this.url = url;
            this.options = options;
        }
    }

    const harness = createHarness(NativeWorker);
    const TwitchNoSubWorker = harness.window.Worker;

    harness.window.Worker = class AdGuardWorker extends TwitchNoSubWorker {
        constructor(url, options) {
            const amazonUrl = firstSingleQuotedImport(harness.readSource(url));
            const wrapperUrl = `blob:https://www.twitch.tv/adguard-wrapper`;
            harness.sourceByUrl.set(wrapperUrl, `self.adguardHooked = true;\nimportScripts('${amazonUrl}');`);
            super(wrapperUrl, options);
        }
    };

    const worker = new harness.window.Worker("blob:https://www.twitch.tv/original", { name: "ivs" });
    const trampoline = harness.readSource(worker.url);
    const composite = harness.readSource(firstSingleQuotedImport(trampoline));

    assert.match(composite, /__TNS_FETCH_PATCHED__/);
    assert.match(composite, /adguardHooked/);
    assert.match(composite, /amazon-ivs-worker\.js/);
});
