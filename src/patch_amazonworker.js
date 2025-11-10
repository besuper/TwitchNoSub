async function fetchTwitchDataGQL(vodID) {
    const resp = await fetch("https://gql.twitch.tv/gql", {
        method: 'POST',
        body: JSON.stringify({
            "query": "query { video(id: \"" + vodID + "\") { broadcastType, createdAt, seekPreviewsURL, owner { login } }}"
        }),
        headers: {
            'Client-Id': 'kimne78kx3ncx6brgo4mv6wki5h1ko',
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    });

    return resp.json();
}

function createServingID() {
    const w = "0123456789abcdefghijklmnopqrstuvwxyz".split("");
    let id = "";

    for (let i = 0; i < 32; i++) {
        id += w[Math.floor(Math.random() * w.length)];
    }

    return id;
}

const defaultResolutions = (() => {
    const _defaultResolutions = {
        "160p30": {
            "name": "160p",
            "resolution": "284x160",
            "frameRate": 30
        },
        "360p30": {
            "name": "360p",
            "resolution": "640x360",
            "frameRate": 30
        },
        "480p30": {
            "name": "480p",
            "resolution": "854x480",
            "frameRate": 30
        },
        "720p60": {
            "name": "720p60",
            "resolution": "1280x720",
            "frameRate": 60
        },
        "1080p60": {
            "name": "1080p60",
            "resolution": "1920x1080",
            "frameRate": 60
        },
        "1440p60": {
            "name": "1440p60",
            "resolution": "2560x1440",
            "frameRate": 60
        },
        "chunked": {
            "name": "chunked",
            "resolution": "chunked",
            "frameRate": 60
        }
    };

    let sorted_dict = Object.keys(_defaultResolutions);
    sorted_dict = sorted_dict.reverse();

    let ordered_resolutions = {};

    for (const key in sorted_dict) {
        ordered_resolutions[sorted_dict[key]] = _defaultResolutions[sorted_dict[key]];
    }

    return ordered_resolutions;
})();

async function isValidQuality(url) {
    const response = await fetch(url, {
        cache: "force-cache"
    });

    if (response.ok) {
        const data = await response.text();

        if (data.includes(".ts")) {
            // ts files should still use the h264
            return { codec: "avc1.4D001E" };
        }

        if (data.includes(".mp4")) {
            // mp4 file use h265, but sometimes h264
            const mp4Request = await fetch(url.replace("index-dvr.m3u8", "init-0.mp4"), { cache: "force-cache" });

            if (mp4Request.ok) {
                const content = await mp4Request.text();

                return { codec: content.includes("hev1") ? "hev1.1.6.L93.B0" : "avc1.4D001E" };
            }

            return { codec: "hev1.1.6.L93.B0" };
        }
    }

    return null;
}

const oldFetch = self.fetch;

self.fetch = async function (input, opt) {
    let url = input instanceof Request ? input.url : input.toString();
    let response = await oldFetch(input, opt);

    // Patch playlist from unmuted to muted segments
    if (url.includes("cloudfront") && url.includes(".m3u8")) {
        const body = await response.text();

        return new Response(body.replace(/-unmuted/g, "-muted"), { status: 200 });
    }

    if (url.startsWith("https://usher.ttvnw.net/vod/")) {
        if (response.status != 200) {
            const isUsherV2 = url.includes("/vod/v2");

            console.log(`[TNS] Detected usher ${isUsherV2 ? 'v2' : 'v1'}`);

            const splitUsher = url.split(".m3u8")[0].split("/");

            const vodId = splitUsher.at(-1);

            const data = await fetchTwitchDataGQL(vodId);

            if (!data || !data?.data.video) {
                console.log("[TNS] Unable to fetch twitch data API");
                return new Response("Unable to fetch twitch data API", { status: 403 });
            }

            console.log(`[TNS] Found data for VOD ${vodId}`);

            const vodData = data.data.video;
            const channelData = vodData.owner;

            const currentURL = new URL(vodData.seekPreviewsURL);

            const domain = currentURL.host;
            const paths = currentURL.pathname.split("/");
            const vodSpecialID = paths[paths.findIndex(element => element.includes("storyboards")) - 1];

            let fakePlaylist = `#EXTM3U
#EXT-X-TWITCH-INFO:ORIGIN="s3",B="false",REGION="EU",USER-IP="127.0.0.1",SERVING-ID="${createServingID()}",CLUSTER="cloudfront_vod",USER-COUNTRY="BE",MANIFEST-CLUSTER="cloudfront_vod"`;

            const now = new Date("2023-02-10");
            const created = new Date(vodData.createdAt);

            const time_difference = now.getTime() - created.getTime();
            const days_difference = time_difference / (1000 * 3600 * 24);

            const broadcastType = vodData.broadcastType.toLowerCase();

            let startQuality = 8534030;

            for (const [resKey, resValue] of Object.entries(defaultResolutions)) {
                let playlistUrl = undefined;

                if (broadcastType === "highlight") {
                    playlistUrl = `https://${domain}/${vodSpecialID}/${resKey}/highlight-${vodId}.m3u8`;
                } else if (broadcastType === "upload" && days_difference > 7) {
                    // Only old uploaded VOD works with this method now

                    playlistUrl = `https://${domain}/${channelData.login}/${vodId}/${vodSpecialID}/${resKey}/index-dvr.m3u8`;
                } else {
                    playlistUrl = `https://${domain}/${vodSpecialID}/${resKey}/index-dvr.m3u8`;
                }

                if (!playlistUrl) continue;

                const result = await isValidQuality(playlistUrl);

                if (result) {
                    console.log(`[TNS] Found quality ${resKey}`);

                    if (isUsherV2) {
                        const variantSource = resKey == "chunked" ? "source" : "transcode";

                        fakePlaylist += `
#EXT-X-STREAM-INF:BANDWIDTH=${startQuality},CODECS="${result.codec},mp4a.40.2",RESOLUTION=${resValue.resolution},FRAME-RATE=${resValue.frameRate},STABLE-VARIANT-ID="${resKey}",IVS-NAME="${resValue.name}",IVS-VARIANT-SOURCE="${variantSource}"
${playlistUrl}`;
                    } else {
                        const enabled = resKey == "chunked" ? "YES" : "NO";

                        fakePlaylist += `
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="${resKey}",NAME="${resKey}",AUTOSELECT=${enabled},DEFAULT=${enabled}
#EXT-X-STREAM-INF:BANDWIDTH=${startQuality},CODECS="${result.codec},mp4a.40.2",RESOLUTION=${resValue.resolution},VIDEO="${resValue.name}",FRAME-RATE=${resValue.frameRate}
${playlistUrl}`;
                    }

                    startQuality -= 100;
                }
            }

            const header = new Headers();
            header.append('Content-Type', 'application/vnd.apple.mpegurl');

            return new Response(fakePlaylist, { status: 200, headers: header });
        }
    }

    return response;
}