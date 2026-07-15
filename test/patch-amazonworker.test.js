const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const patchSource = fs.readFileSync(path.resolve(__dirname, "../src/patch_amazonworker.js"), "utf8");

function writeAscii(bytes, offset, value) {
    for (let i = 0; i < value.length; i += 1) bytes[offset + i] = value.charCodeAt(i);
}

function writeUint32(bytes, offset, value) {
    bytes[offset] = value >>> 24;
    bytes[offset + 1] = value >>> 16;
    bytes[offset + 2] = value >>> 8;
    bytes[offset + 3] = value;
}

function makeAvcInit(width, height, profile = [0x4D, 0x40, 0x2A]) {
    const bytes = new Uint8Array(200);
    writeAscii(bytes, 4, "avc1"); // ftyp compatible brand, not a sample entry
    writeAscii(bytes, 32, "avc1");
    writeUint32(bytes, 28, 172);
    bytes[60] = width >> 8;
    bytes[61] = width & 0xFF;
    bytes[62] = height >> 8;
    bytes[63] = height & 0xFF;
    writeAscii(bytes, 120, "avcC");
    bytes[124] = 1;
    bytes[125] = profile[0];
    bytes[126] = profile[1];
    bytes[127] = profile[2];
    writeAscii(bytes, 160, "mp4a");
    return bytes;
}

function makeUnknownVideoInit(type, width, height) {
    const bytes = new Uint8Array(200);
    writeAscii(bytes, 32, type);
    writeUint32(bytes, 28, 172);
    bytes[60] = width >> 8;
    bytes[61] = width & 0xFF;
    bytes[62] = height >> 8;
    bytes[63] = height & 0xFF;
    writeAscii(bytes, 160, "mp4a");
    return bytes;
}

function makeHevcInit(type, width, height, {
    profileByte = 1,
    compatibility = [0x60, 0, 0, 0],
    constraints = [0xB0, 0, 0, 0, 0, 0],
    level = 93,
    version = 1
} = {}) {
    const bytes = new Uint8Array(200);
    writeAscii(bytes, 32, type);
    writeUint32(bytes, 28, 172);
    bytes[60] = width >> 8;
    bytes[61] = width & 0xFF;
    bytes[62] = height >> 8;
    bytes[63] = height & 0xFF;
    writeAscii(bytes, 120, "hvcC");
    bytes[124] = version;
    bytes[125] = profileByte;
    bytes.set(compatibility, 126);
    bytes.set(constraints, 130);
    bytes[136] = level;
    writeAscii(bytes, 170, "mp4a");
    return bytes;
}

function makeAudioInit() {
    const bytes = new Uint8Array(64);
    writeAscii(bytes, 20, "mp4a");
    return bytes;
}

function createPatchHarness(fetchImpl) {
    const self = {
        __TNS_EXPOSE_TEST_API__: true,
        fetch: fetchImpl
    };
    const context = {
        console: { debug() {}, error() {}, log() {}, warn() {} },
        Date,
        Headers,
        Math,
        Number,
        Promise,
        Response,
        self,
        Uint8Array,
        URL
    };

    vm.runInNewContext(patchSource, context, { filename: "src/patch_amazonworker.js" });
    vm.runInNewContext("__TNS_INSTALL_WORKER_PATCH__();", context);
    return self;
}

test("auto-installs only when legacy userscripts import it inside a worker", () => {
    class FakeWorkerGlobalScope {}
    const self = new FakeWorkerGlobalScope();
    self.fetch = async () => new Response("ok");
    const context = {
        console: { debug() {}, error() {}, log() {}, warn() {} },
        Date,
        Headers,
        Math,
        Number,
        Promise,
        Response,
        self,
        Uint8Array,
        URL,
        WorkerGlobalScope: FakeWorkerGlobalScope
    };

    vm.runInNewContext(patchSource, context, { filename: "src/patch_amazonworker.js" });

    assert.equal(self.__TNS_FETCH_PATCHED__, true);
});

test("parses Usher v1/v2 URLs without leaking query data into the VOD id", () => {
    const self = createPatchHarness(async () => new Response("ok"));
    const { getVodIdFromUsherUrl } = self.__TNS_TEST_API__;

    assert.equal(getVodIdFromUsherUrl("https://usher.ttvnw.net/vod/123.m3u8?token=secret"), "123");
    assert.equal(getVodIdFromUsherUrl("https://usher.ttvnw.net/vod/v2/456.m3u8?sig=secret"), "456");
    assert.equal(getVodIdFromUsherUrl("https://example.com/vod/123.m3u8"), null);
});

test("reads AVC codec and dimensions from an MP4 init segment", () => {
    const self = createPatchHarness(async () => new Response("ok"));
    const parsed = self.__TNS_TEST_API__.parseMp4InitSegment(makeAvcInit(1920, 1080));

    assert.deepEqual(
        { codec: parsed.codec, resolution: parsed.resolution, audioOnly: parsed.audioOnly },
        { codec: "avc1.4D402A", resolution: "1920x1080", audioOnly: false }
    );
});

test("reads exact HEVC profile, tier, level and constraints from hvcC", () => {
    const self = createPatchHarness(async () => new Response("ok"));
    const main = self.__TNS_TEST_API__.parseMp4InitSegment(makeHevcInit("hvc1", 1920, 1080));
    const main10 = self.__TNS_TEST_API__.parseMp4InitSegment(makeHevcInit("hev1", 3840, 2160, {
        profileByte: 0x62,
        compatibility: [0x20, 0, 0, 0],
        constraints: [0x90, 0, 1, 0, 0, 0],
        level: 153
    }));

    assert.equal(main.codec, "hvc1.1.6.L93.B0");
    assert.equal(main10.codec, "hev1.A2.4.H153.90.00.01");
});

test("does not invent a codec when MP4 configuration is invalid", () => {
    const self = createPatchHarness(async () => new Response("ok"));
    const avc = makeAvcInit(1280, 720);
    avc[124] = 2;
    const hevc = makeHevcInit("hvc1", 1920, 1080, { version: 2 });
    const av1 = makeUnknownVideoInit("av01", 2560, 1440);

    assert.equal(self.__TNS_TEST_API__.parseMp4InitSegment(avc).codec, null);
    assert.equal(self.__TNS_TEST_API__.parseMp4InitSegment(hevc).codec, null);
    const parsedAv1 = self.__TNS_TEST_API__.parseMp4InitSegment(av1);
    assert.deepEqual(
        {
            codec: parsedAv1.codec,
            audioCodec: parsedAv1.audioCodec,
            resolution: parsedAv1.resolution,
            audioOnly: parsedAv1.audioOnly
        },
        { codec: null, audioCodec: "mp4a.40.2", resolution: "2560x1440", audioOnly: false }
    );
});

test("keeps a metadata-less TS source distinct from its transcodes", async () => {
    const base = "https://video.cloudfront.net/hash";
    const tsPlaylist = "#EXTM3U\n#EXTINF:10.0,\n0.ts\n";
    const self = createPatchHarness(async input => {
        const url = typeof input === "string" ? input : input.url;
        if (url === `${base}/chunked/index-dvr.m3u8` || url === `${base}/720p60/index-dvr.m3u8`) {
            return new Response(tsPlaylist);
        }
        return new Response("missing", { status: 404 });
    });

    const variants = await self.__TNS_TEST_API__.discoverVariants({
        vodId: "123",
        domain: "video.cloudfront.net",
        specialId: "hash",
        broadcastType: "archive",
        ageInDays: 1,
        channelLogin: "channel"
    });
    const source = variants.find(variant => variant.source);
    const transcode = variants.find(variant => variant.key === "720p60");
    const playlist = self.__TNS_TEST_API__.buildMasterPlaylist(variants, true);
    const lines = playlist.trim().split("\n");
    const sourceAttributes = lines[lines.indexOf(source.url) - 1];

    assert.equal(variants.length, 2);
    assert.equal(source.resolution, null);
    assert.equal(source.frameRate, null);
    assert.equal(source.codec, null);
    assert.equal(transcode.resolution, "1280x720");
    assert.doesNotMatch(sourceAttributes, /CODECS=|RESOLUTION=|FRAME-RATE=/);
    assert.match(sourceAttributes, /IVS-NAME="Source"/);
    assert.match(playlist, /chunked\/index-dvr\.m3u8/);
    assert.match(playlist, /720p60\/index-dvr\.m3u8/);
});

test("builds a valid v2 master playlist without RESOLUTION=chunked", () => {
    const self = createPatchHarness(async () => new Response("ok"));
    const playlist = self.__TNS_TEST_API__.buildMasterPlaylist([{
        key: "chunked",
        name: "1080p60",
        source: true,
        audioOnly: false,
        resolution: "1920x1080",
        frameRate: 60,
        codec: "avc1.4D402A",
        url: "https://cdn.example/chunked/index-dvr.m3u8"
    }], true);

    assert.match(playlist, /RESOLUTION=1920x1080/);
    assert.match(playlist, /STABLE-VARIANT-ID="1080p60"/);
    assert.doesNotMatch(playlist, /RESOLUTION=chunked/);
});

test("reconstructs a denied Usher v2 playlist from discovered CDN qualities", async () => {
    const calls = [];
    const base = "https://video.cloudfront.net/hash";
    const mediaPlaylist = '#EXTM3U\n#EXT-X-MAP:URI="init-0.mp4"\n#EXTINF:10.0,\n0.mp4\n';

    async function fakeFetch(input) {
        const url = typeof input === "string" ? input : input.url;
        calls.push(url);

        if (url.startsWith("https://usher.ttvnw.net/vod/v2/123.m3u8")) {
            return new Response("subscriber only", { status: 403 });
        }
        if (url === "https://gql.twitch.tv/gql") {
            return Response.json({
                data: {
                    video: {
                        broadcastType: "ARCHIVE",
                        createdAt: "2026-07-01T00:00:00Z",
                        seekPreviewsURL: `${base}/storyboards/123-info.json`,
                        owner: { login: "channel" }
                    }
                }
            });
        }
        if (url === `${base}/chunked/index-dvr.m3u8`
            || url === `${base}/720p60/index-dvr.m3u8`
            || url === `${base}/audio_only/index-dvr.m3u8`) {
            return new Response(mediaPlaylist, { status: 200 });
        }
        if (url === `${base}/chunked/init-0.mp4`) {
            return new Response(makeAvcInit(1920, 1080));
        }
        if (url === `${base}/720p60/init-0.mp4`) {
            return new Response(makeAvcInit(1280, 720, [0x4D, 0x40, 0x20]));
        }
        if (url === `${base}/audio_only/init-0.mp4`) {
            return new Response(makeAudioInit());
        }

        return new Response("missing", { status: 403 });
    }

    const self = createPatchHarness(fakeFetch);
    const response = await self.fetch("https://usher.ttvnw.net/vod/v2/123.m3u8?sig=redacted");
    const playlist = await response.text();

    assert.equal(response.status, 200);
    assert.match(playlist, /RESOLUTION=1920x1080/);
    assert.match(playlist, /CODECS="avc1\.4D402A,mp4a\.40\.2"/);
    assert.match(playlist, /STABLE-VARIANT-ID="chunked"/);
    assert.match(playlist, /STABLE-VARIANT-ID="720p60"/);
    assert.match(playlist, /STABLE-VARIANT-ID="audio_only"/);
    assert.doesNotMatch(playlist, /RESOLUTION=chunked/);
    assert.ok(calls.includes("https://gql.twitch.tv/gql"));
});

test("rewrites muted CloudFront segment names while preserving response metadata", async () => {
    const self = createPatchHarness(async () => new Response("0-unmuted.ts\n", {
        status: 200,
        headers: { "Content-Type": "application/vnd.apple.mpegurl", "X-Test": "yes" }
    }));

    const response = await self.fetch("https://video.cloudfront.net/hash/chunked/index-dvr.m3u8");

    assert.equal(await response.text(), "0-muted.ts\n");
    assert.equal(response.headers.get("x-test"), "yes");
    assert.equal(response.headers.get("content-type"), "application/vnd.apple.mpegurl");
});
