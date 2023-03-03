async function fetchTwitchDataGQL(vodID) {
    const resp = await fetch("https://gql.twitch.tv/gql", {
        method: 'POST',
        body: JSON.stringify([
            {
                "operationName": "VideoPlayer_VODSeekbarPreviewVideo",
                "variables": {
                    "includePrivate": false,
                    "videoID": vodID
                },
                "extensions": {
                    "persistedQuery": {
                        "version": 1,
                        "sha256Hash": "07e99e4d56c5a7c67117a154777b0baf85a5ffefa393b213f4bc712ccaf85dd6"
                    }
                }
            },
            {
                "operationName": "ComscoreStreamingQuery",
                "variables": {
                    "channel": "",
                    "clipSlug": "",
                    "isClip": false,
                    "isLive": false,
                    "isVodOrCollection": true,
                    "vodID": vodID
                },
                "extensions": {
                    "persistedQuery": {
                        "version": 1,
                        "sha256Hash": "e1edae8122517d013405f237ffcc124515dc6ded82480a88daef69c83b53ac01"
                    }
                }
            },
            {
                "operationName": "VodChannelLoginQuery",
                "variables": {
                    "videoID": vodID
                },
                "extensions": {
                    "persistedQuery": {
                        "version": 1,
                        "sha256Hash": "0c5feea4dad2565508828f16e53fe62614edf015159df4b3bca33423496ce78e"
                    }
                }
            }
        ]),
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

            const videoData = data[0].data.video;
            const vodData = data[1].data.video;
            const channelData = data[2].data.video.owner

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

            const currentURL = new URL(videoData.seekPreviewsURL);

            const domain = currentURL.host;
            const paths = currentURL.pathname.split("/");
            const vodSpecialID = paths[paths.findIndex(element => element.includes("storyboards")) - 1];

            let fakePlaylist = `#EXTM3U
#EXT-X-TWITCH-INFO:ORIGIN="s3",B="false",REGION="EU",USER-IP="127.0.0.1",SERVING-ID="${createServingID()}",CLUSTER="cloudfront_vod",USER-COUNTRY="BE",MANIFEST-CLUSTER="cloudfront_vod"`;
            let sources_ = [];

            const now = new Date("2023-02-10");
            const created = new Date(vodData.createdAt);

            const time_difference = now.getTime() - created.getTime();
            const days_difference = time_difference / (1000 * 3600 * 24);

            const broadcastType = vodData.broadcastType.toLowerCase();

            if (broadcastType === "highlight") {
                for ([resKey, resValue] of Object.entries(resolutions)) {
                    sources_.push({
                        src: `https://${domain}/${vodSpecialID}/${resKey}/highlight-${vodId}.m3u8`,
                        quality: resKey == "chunked" ? resValue.res.split("x")[1] + "p" : resKey,
                        resolution: resValue.res,
                        fps: Math.ceil(resValue.fps),
                        enabled: resKey == "chunked" ? "YES" : "NO"
                    });
                };
            } else if (broadcastType === "upload" && days_difference > 7) {
                // Only old uploaded VOD works with this method now

                for ([resKey, resValue] of Object.entries(resolutions)) {
                    sources_.push({
                        src: `https://${domain}/${channelData.login}/${vodId}/${vodSpecialID}/${resKey}/index-dvr.m3u8`,
                        quality: resKey == "chunked" ? resValue.res.split("x")[1] + "p" : resKey,
                        resolution: resValue.res,
                        fps: Math.ceil(resValue.fps),
                        enabled: resKey == "chunked" ? "YES" : "NO"
                    });
                };
            } else {
                for ([resKey, resValue] of Object.entries(resolutions)) {
                    sources_.push({
                        src: `https://${domain}/${vodSpecialID}/${resKey}/index-dvr.m3u8`,
                        quality: resKey == "chunked" ? resValue.res.split("x")[1] + "p" : resKey,
                        resolution: resValue.res,
                        ps: Math.ceil(resValue.fps),
                        enabled: resKey == "chunked" ? "YES" : "NO"
                    });
                }
            }

            let startQuality = 8534030;

            Object.entries(sources_).forEach(([_, value]) => {
                fakePlaylist += `
#EXT-X-MEDIA:TYPE=VIDEO,GROUP-ID="${value.quality}",NAME="${value.quality}",AUTOSELECT=${value.enabled},DEFAULT=${value.enabled}
#EXT-X-STREAM-INF:BANDWIDTH=${startQuality},CODECS="avc1.64002A,mp4a.40.2",RESOLUTION=${value.resolution},VIDEO="${value.quality}",FRAME-RATE=${value.fps}
${value.src}`;

                startQuality -= 100;
            });

            const header = new Headers();
            header.append('Content-Type', 'application/vnd.apple.mpegurl');

            return new Response(fakePlaylist, { status: 200, headers: header });
        }
    }

    return response;
}