const assert = require("node:assert/strict");
const test = require("node:test");

const { buildZip, createPackageEntries, listZipEntries } = require("../tools/package.js");

test("builds deterministic Chromium and Firefox packages from explicit allowlists", () => {
    for (const manifest of ["manifest.json", "firefox-manifest.json"]) {
        const entries = createPackageEntries(manifest);
        const first = buildZip(entries);
        const second = buildZip(entries);
        const names = listZipEntries(first);

        assert.deepEqual(first, second);
        assert.deepEqual(names, entries.map(entry => entry.name));
        assert.equal(names.filter(name => name === "manifest.json").length, 1);
        assert.ok(names.includes("src/patch_amazonworker.js"));
        assert.ok(names.includes("src/app.js"));
        assert.ok(!names.includes("src/twitchnosub.js"));
        assert.ok(!names.includes("userscript/twitchnosub.user.js"));
        assert.ok(!names.includes("src/amazon-ivs-worker.min.js"));

        const packagedManifest = JSON.parse(entries.find(entry => entry.name === "manifest.json").data.toString("utf8"));
        assert.equal(packagedManifest.version, "0.9.4");
        assert.equal(packagedManifest.manifest_version, manifest === "manifest.json" ? 3 : 2);
    }
});

test("labels the locally built Firefox archive as unsigned", () => {
    const source = require("node:fs").readFileSync(require("node:path").resolve(__dirname, "../tools/package.js"), "utf8");
    assert.match(source, /firefox-\$\{version\}-unsigned\.xpi/);
});
