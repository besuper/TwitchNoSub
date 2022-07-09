const settings = {
    chat: {
        enabled: true,
    },
    current_watch: {
        "id": "",
        "link": "",
        "title": "",
        "time": 0.0,
        "max_time": 0.0
    }
};

let vodSetup = false;

chrome.storage.local.get(['chat_toggle'], function (result) {
    settings.chat.enabled = result.chat_toggle;
});

// On refresh
$(window).on('load', checkSubOnlyVOD);

// Listen when a sub only VOD is found
chrome.runtime.onMessage.addListener(function (request, _, sendResponse) {
    if (request.type === "load_vod") {
        if (vodSetup) {
            // If a VOD is already loaded reload the page
            // This prevent VOD to load twice
            location.reload();
        } else {
            checkSubOnlyVOD();
        }

        sendResponse({ success: true });
    }

    return true;
});

function checkSubOnlyVOD() {
    const currentURL = window.location.href.toString();

    if (!currentURL.includes("/videos/") && !currentURL.includes("/video/") && !vodSetup) {
        return;
    }

    vodSetup = true;

    console.log("[TwitchNoSub] Twitch VOD found");

    setTimeout(() => {

        // Check if the page contains Sub only VOD message
        let checkSub = $("div[data-a-target='player-overlay-content-gate']");

        // If we don't find VOD
        if (!checkSub.length) {
            checkSub = undefined;

            // Some twitch VODs are just black ?
            checkSub = $("span[data-test-selector='seekbar-segment__segment']");

            if (checkSub.length) {
                console.log("[TwitchNoSub] This is not a sub-only VOD");

                checkSub = undefined;
            }
        }

        if (checkSub != undefined) {
            console.log("[TwitchNoSub] Sub-only VOD found");

            // Replace sub only message with a loading gif
            checkSub.html('<img src="https://i.ibb.co/NTpWgM1/Rolling-1s-200px.gif" alt="Loading VOD">');

            // Get the current twitch player
            const video = $("div[class*=persistent-player]");
            const className = video.attr("class");

            console.log("" + className);

            const vodID = window.location.toString().split("/").pop();

            settings.current_watch["link"] = vodID;

            setTimeout(() => {
                // Remove the current player
                video.remove();

                // Add on click event on every left tab channels
                $("a[data-test-selector*='followed-channel']").click(onClick);

                // Add on click event on every vods
                $("img[src*='vods/']").click(onClick);

                retrieveVOD(className);
            }, 1000);
        }
    }, 1500);
}

function retrieveVOD(className) {
    let currentURL = window.location.toString();

    // If the URL contains queries, remove them
    if (currentURL.includes("?")) {
        currentURL = currentURL.split("?")[0];
    }

    const vod_id = currentURL.split("/").pop();

    let seeked = false;

    fetchTwitchData(vod_id, (data) => {
        // Insert the new video player
        const contentStream = $("div[data-target='persistent-player-content']");
        contentStream.html(`<video id="player" class="${className}" playsinline controls></video>`);

        const video = document.querySelector('#player');
        const resolutions = data.resolutions;

        console.log("[TwitchNoSub] Start retrieving VOD links");
        console.log("[TwitchNoSub] VOD resolutions : " + JSON.stringify(resolutions));

        const currentURL = new URL(data.animated_preview_url);

        const domain = currentURL.host;
        const vodSpecialID = currentURL.pathname.split("/")[1];

        console.log("[TwitchNoSub] VOD ID : " + vodSpecialID);

        const availableURLS = Object.entries(resolutions).map(([resKey, resVal]) => {
            return {
                "resolution": resVal,
                "fps": data.fps[resKey],
                "url": "https://" + domain + "/" + vodSpecialID + "/" + resKey + "/index-dvr.m3u8"
            };
        });

        const playlistString = createM3u8Playlist(availableURLS);
        const encodedPlaylistString = new TextEncoder().encode(playlistString);
        const blobUrl = URL.createObjectURL(new Blob([encodedPlaylistString]));

        const hls = new Hls({
            xhrSetup: (xhr, _url) => {
                // Patch the m3u8 VOD file to be readable
                xhr.open('GET', _url.replace('unmuted.ts', 'muted.ts'), true);
            },
        });

        hls.loadSource(blobUrl);

        // When m3u8 is parsed
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            const availableQualities = hls.levels.map((l) => l.height);

            const player = new Plyr(video, {
                invertTime: false,
                quality: {
                    default: availableQualities[0],
                    options: availableQualities,
                    forced: true,
                    onChange: (quality) => updateQuality(quality, hls),
                },
            });

            hls.attachMedia(video);

            player.play();

            document.addEventListener('keydown', (event) => {
                const name = event.key;

                // Backward and forward with arrow keys
                if (name == "ArrowLeft") {
                    player.currentTime = player.currentTime - 5;
                } else if (name == "ArrowRight") {
                    player.currentTime = player.currentTime + 5;
                }

                if (name == " ") {
                    event.preventDefault();

                    if (player.paused) {
                        player.play();
                    } else {
                        player.pause();
                    }
                }
            }, false);

            video.onloadedmetadata = () => {
                // Fetch current VOD informations
                settings.current_watch["title"] = $("h2[data-a-target='stream-title']").text();
                settings.current_watch["id"] = vodSpecialID;
                settings.current_watch["max_time"] = player.duration;

                // Fetch current VOD time from background (local storage)
                chrome.runtime.sendMessage({ type: "fetch_data", id: vodSpecialID }, function (response) {
                    if (response.success) {

                        settings.current_watch["time"] = response.data["time"];

                        player.currentTime = settings.current_watch["time"];
                    }
                });

                // Fetch current volume from local storage
                const volume = window.localStorage.getItem("volume");

                if (volume != undefined) {
                    player.volume = volume;
                }

                // Save new volume in local storage
                player.on('volumechange', () => {
                    window.localStorage.setItem("volume", player.muted ? 0.0 : player.volume);
                });

                // Save new time in local storage
                player.on('timeupdate', () => {
                    settings.current_watch["time"] = player.currentTime;

                    chrome.runtime.sendMessage({ type: "update", id: vodSpecialID, data: settings.current_watch }, function (response) { });
                });

                // User moved forward or backard in the VOD
                player.on('seeked', () => {
                    seeked = true;
                });

                // Support for time query in URL (?t=1h15m56s)
                const params = (new URL(document.location)).searchParams;
                const time = params.get("t");

                if (time != undefined) {
                    let final_time = 0;

                    const first_split = time.split("h");
                    let hours = parseInt(first_split[0]);
                    const second_split = first_split[1].split("m");
                    let minutes = parseInt(second_split[0]);
                    let seconds = parseInt(second_split[1].replace("s", ""));

                    final_time += (hours * 3600);
                    final_time += (minutes * 60);
                    final_time += seconds;

                    player.currentTime = final_time;
                }
            };

            // Chat
            if (!settings.chat.enabled) {
                return;
            }

            setTimeout(() => {
                let index = 0;

                let messages = {
                    comments: []
                };

                fetchChat(vod_id, player.currentTime, undefined).done(data => {
                    messages = $.parseJSON(data);
                });

                setInterval(() => {
                    if (!player.paused && (messages != undefined && messages.comments.length > 0) && settings.chat.enabled) {
                        if (seeked) {
                            seeked = false;

                            // If seeked reset the current chat cursor
                            fetchChat(vod_id, player.currentTime, undefined).done(data => {
                                messages = $.parseJSON(data);
                                index = 0;
                            });

                            return;
                        }

                        if (messages.comments.length <= index) {
                            fetchChat(vod_id, player.currentTime, messages._next).done(data => {
                                messages = $.parseJSON(data);
                                index = 0;
                            });
                        }

                        messages.comments.forEach(comment => {
                            if (comment.content_offset_seconds <= player.currentTime) {
                                addMessage(comment);
                                delete messages.comments[index];
                                index++;
                            }
                        });
                    }
                }, 1000);
            }, 1200);
        });
    });
}

// Fetch data from Twitch API for the VOD
function fetchTwitchData(vodID, success) {
    $.ajax({
        url: "https://api.twitch.tv/kraken/videos/" + vodID,
        headers: {
            "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
            "Accept": "application/vnd.twitchtv.v5+json"
        },
        type: 'GET',
        dataType: 'json',
        async: true,
        success: function (data, statut) {
            success(data);
        }
    });
}

// Generate a m3u8 playlist with VODs url of all resolutions
function createM3u8Playlist(urls) {
    let stream = '';
    urls.forEach((data, val) => {
        stream += `#EXT-X-STREAM-INF:BANDWIDTH=${100 - val},RESOLUTION=${data.resolution},FRAME-RATE=${data.fps}\n`;
        stream += `${data.url}\n`;
    });
    return '#EXTM3U\n' + stream;
}

// Fired when the quality is updated
function updateQuality(quality, hlsInstance) {
    hlsInstance.levels.forEach((level, idx) => {
        if (level.height === quality) {
            hlsInstance.currentLevel = idx;
        }
    });
};

// Refresh current page on click to remove the extension player
function onClick() {
    setTimeout(() => {
        document.location.reload();
    }, 200);
}