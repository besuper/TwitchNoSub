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

async function isValidQuality(url) {
    const response = await fetch(url);

    if (response.ok) {
        const data = await response.text();

        return data.includes(".ts");
    }

    return false;
}

const oldFetch = self.fetch;

self.fetch = async function (url, opt) {
    let response = await oldFetch(url, opt);

    // Patch playlist from unmuted to muted segments
    if (url.includes("cloudfront") && url.includes(".m3u8")) {
        const body = await response.text();

        return new Response(body.replace(/-unmuted/g, "-muted"), { status: 200 });
    }

    if (url.startsWith("https://usher.ttvnw.net/vod/")) {
        if (response.status != 200) {
            const vodId = url.split("https://usher.ttvnw.net/vod/")[1].split(".m3u8")[0];
            const data = await fetchTwitchDataGQL(vodId);

            if (data == undefined) {
                return new Response("Unable to fetch twitch data API", 403);
            }

            const vodData = data.data.video;
            const channelData = vodData.owner

            let resolutions = {
                "160p30": {
                    "res": "284x160",
                    "fps": 30
                },
                "360p30": {
                    "res": "640x360",
                    "fps": 30
                },
                "480p30": {
                    "res": "854x480",
                    "fps": 30
                },
                "720p60": {
                    "res": "1280x720",
                    "fps": 60
                },
                "1080p60": {
                    "res": "1920x1080",
                    "fps": 60
                },
                "chunked": {
                    "res": "1920x1080",
                    "fps": 60
                }
            };

            let sorted_dict = Object.keys(resolutions);
            sorted_dict = sorted_dict.reverse();

            let ordered_resolutions = {};

            for (key in sorted_dict) {
                ordered_resolutions[sorted_dict[key]] = resolutions[sorted_dict[key]];
            }

            resolutions = ordered_resolutions;

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

            for ([resKey, resValue] of Object.entries(resolutions)) {
                var url = undefined;

                if (broadcastType === "highlight") {
                    url = `https://${domain}/${vodSpecialID}/${resKey}/highlight-${vodId}.m3u8`;
                } else if (broadcastType === "upload" && days_difference > 7) {
                    // Only old uploaded VOD works with this method now

                    url = `https://${domain}/${channelData.login}/${vodId}/${vodSpecialID}/${resKey}/index-dvr.m3u8`;
                } else {
                    url = `https://${domain}/${vodSpecialID}/${resKey}/index-dvr.m3u8`;
                }

                if (url == undefined) {
                    continue;
                }

                if (await isValidQuality(url)) {
                    const quality = resKey == "chunked" ? resValue.res.split("x")[1] + "p" : resKey;
                    const enabled = resKey == "chunked" ? "YES" : "NO";
                    const fps = resValue.fps;

                    fakePlaylist += `
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="${quality}",NAME="${quality}",AUTOSELECT=${enabled},DEFAULT=${enabled}
#EXT-X-STREAM-INF:BANDWIDTH=${startQuality},CODECS="avc1.64002A,mp4a.40.2",RESOLUTION=${resValue.res},VIDEO="${quality}",FRAME-RATE=${fps}
${url}`;

                    startQuality -= 100;
                }
            };

            const header = new Headers();
            header.append('Content-Type', 'application/vnd.apple.mpegurl');

            return new Response(fakePlaylist, { status: 200, headers: header });
        }
    }

    return response;
}