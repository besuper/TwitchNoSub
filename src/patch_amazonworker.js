globalThis.__TNS_INSTALL_WORKER_PATCH__ = function twitchNoSubWorkerPatch() {
    "use strict";

    if (self.__TNS_FETCH_PATCHED__) return;

    const TWITCH_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";
    const QUALITY_CANDIDATES = [
        { key: "chunked", name: "Source", source: true },
        { key: "2160p60", name: "2160p60", resolution: "3840x2160", frameRate: 60 },
        { key: "2160p30", name: "2160p", resolution: "3840x2160", frameRate: 30 },
        { key: "1440p60", name: "1440p60", resolution: "2560x1440", frameRate: 60 },
        { key: "1440p30", name: "1440p", resolution: "2560x1440", frameRate: 30 },
        { key: "1080p60", name: "1080p60", resolution: "1920x1080", frameRate: 60 },
        { key: "1080p30", name: "1080p", resolution: "1920x1080", frameRate: 30 },
        { key: "936p60", name: "936p60", resolution: "1664x936", frameRate: 60 },
        { key: "936p30", name: "936p", resolution: "1664x936", frameRate: 30 },
        { key: "900p60", name: "900p60", resolution: "1600x900", frameRate: 60 },
        { key: "864p60", name: "864p60", resolution: "1536x864", frameRate: 60 },
        { key: "720p60", name: "720p60", resolution: "1280x720", frameRate: 60 },
        { key: "720p30", name: "720p", resolution: "1280x720", frameRate: 30 },
        { key: "480p60", name: "480p60", resolution: "852x480", frameRate: 60 },
        { key: "480p30", name: "480p", resolution: "852x480", frameRate: 30 },
        { key: "360p60", name: "360p60", resolution: "640x360", frameRate: 60 },
        { key: "360p30", name: "360p", resolution: "640x360", frameRate: 30 },
        { key: "160p30", name: "160p", resolution: "284x160", frameRate: 30 },
        { key: "audio_only", name: "Audio Only", audioOnly: true }
    ];

    const oldFetch = self.fetch.bind(self);

    function createServingID() {
        const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
        let id = "";

        for (let i = 0; i < 32; i += 1) {
            id += alphabet[Math.floor(Math.random() * alphabet.length)];
        }

        return id;
    }

    function getRequestUrl(input) {
        if (typeof input === "string") return input;
        if (input && typeof input.url === "string") return input.url;
        return String(input);
    }

    function getVodIdFromUsherUrl(value) {
        try {
            const url = new URL(value);
            if (url.hostname !== "usher.ttvnw.net") return null;

            const match = url.pathname.match(/^\/vod\/(?:v2\/)?([0-9]+)\.m3u8$/);
            return match ? match[1] : null;
        } catch (_) {
            return null;
        }
    }

    async function fetchTwitchDataGQL(vodId) {
        const response = await oldFetch("https://gql.twitch.tv/gql", {
            method: "POST",
            body: JSON.stringify({
                query: "query TwitchNoSubVideo($id: ID!) { video(id: $id) { broadcastType createdAt seekPreviewsURL owner { login } } }",
                variables: { id: vodId }
            }),
            headers: {
                "Client-Id": TWITCH_CLIENT_ID,
                "Accept": "application/json",
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`Twitch GQL returned HTTP ${response.status}`);
        }

        const payload = await response.json();
        return payload && payload.data ? payload.data.video : null;
    }

    function findAscii(bytes, text, start = 0, end = bytes.length) {
        const expected = Array.from(text, character => character.charCodeAt(0));
        const searchEnd = Math.min(end, bytes.length);

        for (let i = start; i <= searchEnd - expected.length; i += 1) {
            let matches = true;

            for (let j = 0; j < expected.length; j += 1) {
                if (bytes[i + j] !== expected[j]) {
                    matches = false;
                    break;
                }
            }

            if (matches) return i;
        }

        return -1;
    }

    function readUint16(bytes, offset) {
        if (offset < 0 || offset + 1 >= bytes.length) return null;
        return (bytes[offset] << 8) | bytes[offset + 1];
    }

    function readUint32(bytes, offset) {
        if (offset < 0 || offset + 3 >= bytes.length) return null;
        return (bytes[offset] * 0x1000000
            + (bytes[offset + 1] << 16)
            + (bytes[offset + 2] << 8)
            + bytes[offset + 3]) >>> 0;
    }

    function toHex(value) {
        return value.toString(16).padStart(2, "0").toUpperCase();
    }

    function reverseBits32(value) {
        let reversed = value >>> 0;
        reversed = (((reversed >>> 1) & 0x55555555) | ((reversed & 0x55555555) << 1)) >>> 0;
        reversed = (((reversed >>> 2) & 0x33333333) | ((reversed & 0x33333333) << 2)) >>> 0;
        reversed = (((reversed >>> 4) & 0x0F0F0F0F) | ((reversed & 0x0F0F0F0F) << 4)) >>> 0;
        reversed = (((reversed >>> 8) & 0x00FF00FF) | ((reversed & 0x00FF00FF) << 8)) >>> 0;
        return ((reversed >>> 16) | (reversed << 16)) >>> 0;
    }

    function parseHevcCodec(bytes, type, configOffset, entryEnd) {
        const payload = configOffset + 4;
        if (payload + 22 >= entryEnd || bytes[payload] !== 1) return null;

        const profileByte = bytes[payload + 1];
        const profileSpace = ["", "A", "B", "C"][profileByte >>> 6];
        const tier = (profileByte & 0x20) ? "H" : "L";
        const profileIdc = profileByte & 0x1F;
        const compatibility = reverseBits32(readUint32(bytes, payload + 2)).toString(16).toUpperCase();
        const levelIdc = bytes[payload + 12];
        const constraints = Array.from(bytes.slice(payload + 6, payload + 12));

        while (constraints.length > 0 && constraints.at(-1) === 0) constraints.pop();
        const constraintSuffix = constraints.length > 0
            ? `.${constraints.map(toHex).join(".")}`
            : "";

        return `${type}.${profileSpace}${profileIdc}.${compatibility}.${tier}${levelIdc}${constraintSuffix}`;
    }

    function parseMp4InitSegment(buffer) {
        const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
        const visualTypes = ["avc1", "avc3", "hev1", "hvc1"];
        const audioCodec = findAscii(bytes, "mp4a") >= 0 ? "mp4a.40.2" : null;

        for (const type of visualTypes) {
            let searchFrom = 0;
            let sampleEntry = -1;

            while ((sampleEntry = findAscii(bytes, type, searchFrom)) >= 0) {
                searchFrom = sampleEntry + type.length;

                // Codec names may also occur in the ftyp compatible-brands
                // list. A real VisualSampleEntry has plausible dimensions.
                const width = readUint16(bytes, sampleEntry + 28);
                const height = readUint16(bytes, sampleEntry + 30);
                if (!width || !height || width > 16_384 || height > 16_384) continue;

                let codec = null;
                const boxStart = sampleEntry - 4;
                const boxSize = readUint32(bytes, boxStart);
                const entryEnd = boxSize && boxSize >= 86 && boxStart + boxSize <= bytes.length
                    ? boxStart + boxSize
                    : bytes.length;

                if (type === "avc1" || type === "avc3") {
                    const avcConfig = findAscii(bytes, "avcC", sampleEntry + 82, entryEnd);
                    if (avcConfig >= 0 && avcConfig + 7 < entryEnd && bytes[avcConfig + 4] === 1) {
                        codec = `${type}.${toHex(bytes[avcConfig + 5])}${toHex(bytes[avcConfig + 6])}${toHex(bytes[avcConfig + 7])}`;
                    }
                } else {
                    const hevcConfig = findAscii(bytes, "hvcC", sampleEntry + 82, entryEnd);
                    if (hevcConfig >= 0) codec = parseHevcCodec(bytes, type, hevcConfig, entryEnd);
                }

                return {
                    codec,
                    audioCodec,
                    resolution: `${width}x${height}`,
                    audioOnly: false
                };
            }
        }

        // Do not mistake an unsupported video track (for example AV1) plus an
        // AAC track for an audio-only rendition. Unknown video codecs are kept
        // without a CODECS attribute so the player can inspect the media.
        for (const type of ["av01", "vp09", "vp08", "dvh1", "dvhe"]) {
            let searchFrom = 0;
            let sampleEntry = -1;

            while ((sampleEntry = findAscii(bytes, type, searchFrom)) >= 0) {
                searchFrom = sampleEntry + type.length;
                const width = readUint16(bytes, sampleEntry + 28);
                const height = readUint16(bytes, sampleEntry + 30);
                if (!width || !height || width > 16_384 || height > 16_384) continue;

                return {
                    codec: null,
                    audioCodec,
                    resolution: `${width}x${height}`,
                    audioOnly: false
                };
            }
        }

        if (findAscii(bytes, "mp4a") >= 0) {
            return { codec: "mp4a.40.2", audioCodec: null, resolution: null, audioOnly: true };
        }

        return { codec: null, audioCodec: null, resolution: null, audioOnly: false };
    }

    function getInitSegmentUrl(playlist, playlistUrl) {
        const match = playlist.match(/#EXT-X-MAP:[^\n]*URI="([^"]+)"/);
        return match ? new URL(match[1], playlistUrl).href : null;
    }

    async function inspectQuality(candidate, playlistUrl) {
        const response = await oldFetch(playlistUrl, { cache: "force-cache" });
        if (!response.ok) return null;

        const playlist = await response.text();
        if (!playlist.includes("#EXTM3U") || (!playlist.includes("#EXTINF") && !playlist.includes("#EXT-X-MAP"))) {
            return null;
        }

        let mediaInfo = { codec: null, audioCodec: null, resolution: null, audioOnly: false };
        const initSegmentUrl = getInitSegmentUrl(playlist, playlistUrl);

        if (initSegmentUrl) {
            try {
                const initResponse = await oldFetch(initSegmentUrl, { cache: "force-cache" });
                if (initResponse.ok) {
                    mediaInfo = parseMp4InitSegment(await initResponse.arrayBuffer());
                }
            } catch (error) {
                console.debug(`[TNS] Unable to inspect init segment for ${candidate.key}`, error);
            }
        }

        const audioOnly = candidate.audioOnly || mediaInfo.audioOnly;
        return {
            key: candidate.key,
            name: candidate.name,
            source: Boolean(candidate.source),
            audioOnly,
            resolution: audioOnly ? null : (mediaInfo.resolution || candidate.resolution || null),
            frameRate: audioOnly ? null : (candidate.frameRate || null),
            codec: mediaInfo.codec,
            audioCodec: audioOnly ? null : mediaInfo.audioCodec,
            url: playlistUrl
        };
    }

    function getVodCdnContext(vodId, vodData) {
        if (!vodData || !vodData.seekPreviewsURL) return null;

        const previewUrl = new URL(vodData.seekPreviewsURL);
        const allowedHost = previewUrl.hostname.endsWith(".cloudfront.net")
            || previewUrl.hostname.endsWith(".twitchcdn.net");
        if (previewUrl.protocol !== "https:" || !allowedHost) return null;

        const paths = previewUrl.pathname.split("/").filter(Boolean);
        const storyboardIndex = paths.findIndex(path => path === "storyboards");
        if (storyboardIndex < 1) return null;

        const specialId = paths[storyboardIndex - 1];
        if (!/^[A-Za-z0-9_-]+$/.test(specialId)) return null;

        const broadcastType = String(vodData.broadcastType || "archive").toLowerCase();
        const createdAt = new Date(vodData.createdAt).getTime();
        const ageInDays = Number.isFinite(createdAt) ? (Date.now() - createdAt) / 86_400_000 : 0;

        return {
            vodId,
            domain: previewUrl.hostname,
            specialId,
            broadcastType,
            ageInDays,
            channelLogin: vodData.owner && vodData.owner.login ? vodData.owner.login : null
        };
    }

    function buildQualityUrl(context, qualityKey) {
        const base = `https://${context.domain}`;

        if (context.broadcastType === "highlight") {
            return `${base}/${context.specialId}/${qualityKey}/highlight-${context.vodId}.m3u8`;
        }

        if (context.broadcastType === "upload" && context.ageInDays > 7 && context.channelLogin) {
            return `${base}/${context.channelLogin}/${context.vodId}/${context.specialId}/${qualityKey}/index-dvr.m3u8`;
        }

        return `${base}/${context.specialId}/${qualityKey}/index-dvr.m3u8`;
    }

    async function discoverVariants(context) {
        const variants = [];
        const concurrency = 4;

        for (let index = 0; index < QUALITY_CANDIDATES.length; index += concurrency) {
            const batch = QUALITY_CANDIDATES.slice(index, index + concurrency);
            const results = await Promise.all(batch.map(async candidate => {
                try {
                    return await inspectQuality(candidate, buildQualityUrl(context, candidate.key));
                } catch (error) {
                    console.debug(`[TNS] Quality probe failed for ${candidate.key}`, error);
                    return null;
                }
            }));

            variants.push(...results.filter(Boolean));
        }

        return variants;
    }

    function estimateBandwidth(variant) {
        if (variant.audioOnly) return 200_000;
        if (!variant.resolution) return 8_500_000;

        const height = Number(variant.resolution.split("x")[1]);
        if (height >= 2160) return 20_000_000;
        if (height >= 1440) return 12_000_000;
        if (height >= 1080) return 8_500_000;
        if (height >= 900) return 6_500_000;
        if (height >= 720) return 4_500_000;
        if (height >= 480) return 1_800_000;
        if (height >= 360) return 900_000;
        return 350_000;
    }

    function getStableVariantId(variant) {
        if (variant.audioOnly) return "audio_only";
        if (!variant.source || !variant.resolution) return variant.key;
        if (!variant.frameRate) return variant.key;

        const height = Number(variant.resolution.split("x")[1]);
        return height ? `${height}p${variant.frameRate >= 50 ? "60" : "30"}` : "source";
    }

    function buildMasterPlaylist(variants, isUsherV2) {
        const lines = ["#EXTM3U"];

        if (isUsherV2) {
            lines.push(
                '#EXT-X-SESSION-DATA:DATA-ID="SUPPRESS",VALUE="false"',
                `#EXT-X-SESSION-DATA:DATA-ID="SERVING-ID",VALUE="${createServingID()}"`,
                '#EXT-X-SESSION-DATA:DATA-ID="CLUSTER",VALUE="cloudfront_vod"',
                '#EXT-X-SESSION-DATA:DATA-ID="ABS",VALUE="false"',
                '#EXT-X-SESSION-DATA:DATA-ID="MANIFEST-CLUSTER",VALUE="cloudfront_vod"',
                '#EXT-X-SESSION-DATA:DATA-ID="ORIGIN",VALUE="s3"'
            );
        } else {
            lines.push(`#EXT-X-TWITCH-INFO:ORIGIN="s3",B="false",SERVING-ID="${createServingID()}",CLUSTER="cloudfront_vod",MANIFEST-CLUSTER="cloudfront_vod"`);
        }

        for (const variant of variants) {
            const stableId = getStableVariantId(variant);
            const attributes = [
                `BANDWIDTH=${estimateBandwidth(variant)}`
            ];

            if (variant.codec) {
                const codecs = [variant.codec];
                if (!variant.audioOnly && variant.audioCodec) codecs.push(variant.audioCodec);
                attributes.push(`CODECS="${codecs.join(",")}"`);
            }

            if (variant.resolution) attributes.push(`RESOLUTION=${variant.resolution}`);
            if (variant.frameRate) attributes.push(`FRAME-RATE=${variant.frameRate.toFixed(3)}`);

            if (isUsherV2) {
                attributes.push(
                    `STABLE-VARIANT-ID="${stableId}"`,
                    `IVS-NAME="${variant.name}"`,
                    'IVS-VARIANT-SOURCE="source"'
                );
            } else if (!variant.audioOnly) {
                const enabled = variant.source ? "YES" : "NO";
                lines.push(`#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="${stableId}",NAME="${variant.name}",AUTOSELECT=${enabled},DEFAULT=${enabled}`);
                attributes.push(`VIDEO="${stableId}"`);
            }

            lines.push(`#EXT-X-STREAM-INF:${attributes.join(",")}`, variant.url);
        }

        return `${lines.join("\n")}\n`;
    }

    async function buildFallbackResponse(vodId, isUsherV2, originalResponse) {
        try {
            const vodData = await fetchTwitchDataGQL(vodId);
            const context = getVodCdnContext(vodId, vodData);

            if (!context) {
                console.warn(`[TNS] VOD ${vodId} has no usable CDN metadata`);
                return originalResponse;
            }

            const variants = await discoverVariants(context);
            if (variants.length === 0 || !variants.some(variant => !variant.audioOnly)) {
                console.warn(`[TNS] No playable video quality found for VOD ${vodId}`);
                return originalResponse;
            }

            console.log(`[TNS] Serving VOD ${vodId} with ${variants.length} discovered qualities`);
            return new Response(buildMasterPlaylist(variants, isUsherV2), {
                status: 200,
                headers: { "Content-Type": "application/vnd.apple.mpegurl" }
            });
        } catch (error) {
            console.error(`[TNS] Unable to build a fallback playlist for VOD ${vodId}`, error);
            return originalResponse;
        }
    }

    async function replaceMutedSegmentNames(response) {
        const body = await response.text();
        const headers = new Headers(response.headers);
        headers.delete("content-length");
        headers.delete("content-encoding");

        return new Response(body.replace(/-unmuted/g, "-muted"), {
            status: response.status,
            statusText: response.statusText,
            headers
        });
    }

    self.fetch = async function tnsFetch(input, options) {
        const url = getRequestUrl(input);
        const response = await oldFetch(input, options);

        try {
            const parsedUrl = new URL(url);
            if (response.ok && parsedUrl.hostname.endsWith(".cloudfront.net") && parsedUrl.pathname.endsWith(".m3u8")) {
                return await replaceMutedSegmentNames(response);
            }

            const vodId = getVodIdFromUsherUrl(url);
            if (vodId && !response.ok) {
                const isUsherV2 = new URL(url).pathname.startsWith("/vod/v2/");
                console.log(`[TNS] Usher ${isUsherV2 ? "v2" : "v1"} denied VOD ${vodId} (HTTP ${response.status})`);
                return await buildFallbackResponse(vodId, isUsherV2, response);
            }
        } catch (error) {
            console.error("[TNS] Worker fetch hook failed; returning the original response", error);
        }

        return response;
    };

    self.__TNS_FETCH_PATCHED__ = true;

    if (self.__TNS_EXPOSE_TEST_API__) {
        self.__TNS_TEST_API__ = {
            buildMasterPlaylist,
            discoverVariants,
            getVodIdFromUsherUrl,
            parseMp4InitSegment
        };
    }
};

// Userscript versions <= 1.2.2 import this file directly inside the IVS
// worker and expect it to install itself. Keep that upgrade path working,
// while the extension's MAIN-world content script only publishes the factory.
if (typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope) {
    globalThis.__TNS_INSTALL_WORKER_PATCH__();
}
