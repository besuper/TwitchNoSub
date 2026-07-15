const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");

function readJson(file) {
    return JSON.parse(fs.readFileSync(path.join(root, file), "utf8"));
}

function contentScriptFiles(manifest) {
    return manifest.content_scripts.flatMap(script => script.js || []);
}

function webAccessibleFiles(manifest) {
    return manifest.manifest_version === 3
        ? (manifest.web_accessible_resources || []).flatMap(resource => resource.resources)
        : (manifest.web_accessible_resources || []);
}

test("both extension manifests reference local files only", () => {
    for (const manifestFile of ["manifest.json", "firefox-manifest.json"]) {
        const manifest = readJson(manifestFile);
        const referencedFiles = [
            ...contentScriptFiles(manifest),
            ...webAccessibleFiles(manifest)
        ];

        assert.ok(referencedFiles.includes("src/app.js"));
        assert.ok(referencedFiles.includes("src/patch_amazonworker.js"));

        for (const file of referencedFiles) {
            assert.doesNotMatch(file, /^https?:/);
            assert.ok(fs.existsSync(path.join(root, file)), `${manifestFile} references missing ${file}`);
        }
    }
});

test("the worker hook runs statically in the page world before Twitch scripts", () => {
    for (const manifestFile of ["manifest.json", "firefox-manifest.json"]) {
        const manifest = readJson(manifestFile);
        const hook = manifest.content_scripts.find(script => script.js?.includes("src/app.js"));

        assert.deepEqual(hook.js, ["src/patch_amazonworker.js", "src/app.js"]);
        assert.equal(hook.run_at, "document_start");
        assert.equal(hook.world, "MAIN");
        assert.equal(hook.all_frames, true);
    }
});

test("package and extension versions stay synchronized", () => {
    const packageJson = readJson("package.json");
    const chromium = readJson("manifest.json");
    const firefox = readJson("firefox-manifest.json");

    assert.equal(chromium.version, packageJson.version);
    assert.equal(firefox.version, packageJson.version);
    assert.equal(packageJson.license, "Apache-2.0");
});

test("the packaged extension hook contains no remotely hosted executable code", () => {
    const hook = fs.readFileSync(path.join(root, "src/app.js"), "utf8");

    assert.doesNotMatch(hook, /https?:\/\//);
    assert.doesNotMatch(hook, /\bpatch_url\b/);
    assert.ok(!fs.existsSync(path.join(root, "src/twitchnosub.js")));
});
