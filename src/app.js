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

            const vodID = window.location.toString().split("/").pop();

            settings.current_watch["link"] = vodID;

            // Fetch VOD data
            $.ajax({
                url: "https://api.twitch.tv/kraken/videos/" + vodID,
                headers: {
                    "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
                    "Accept": "application/vnd.twitchtv.v5+json"
                },
                type: 'GET',
                dataType: 'json',
                success: function (data, statut) {
                    if (statut === "success") {
                        console.log("[TwitchNoSub] Succefully fetched VOD data");

                        const animated_preview_url = data.animated_preview_url;
                        const domain = animated_preview_url.split("/storyboards")[0].trim();

                        console.log("[TwitchNoSub] Domain : " + domain);

                        setTimeout(() => {
                            // Remove the current player
                            video.remove();

                            // Add on click event on every left tab channels
                            $("a[data-test-selector*='followed-channel']").click(onClick);

                            // Add on click event on every vods
                            $("img[src*='vods/']").click(onClick);

                            retrieveVOD(domain, className);
                        }, 1000);
                    } else {
                        console.log("[TwitchNoSub] Unable to get VOD data");
                    }
                }
            });
        }
    }, 1500);
}

// Refresh current page on click to remove the extension player
function onClick() {
    setTimeout(() => {
        document.location.reload();
    }, 200);
}

function retrieveVOD(domain, className) {
    let currentURL = window.location.toString();

    // If the URL contains queries, remove them
    if (currentURL.includes("?")) {
        currentURL = currentURL.split("?")[0];
    }

    const vod_id = currentURL.split("/").pop();

    // Content twitch player
    const contentStream = $("div[data-target='persistent-player-content']");

    const key = domain.split("/")[3];

    const fullUrlsource = domain + "/chunked/index-dvr.m3u8";

    console.log("[TwitchNoSub] Start retrieving VOD links");
    console.log("[TwitchNoSub] Url : " + fullUrlsource);

    checkUrl(fullUrlsource).then((_, statut) => {
        if (statut === "success") {

            console.log("[TwitchNoSub] VOD links success");

            const fullUrl360 = domain + "/360p30/index-dvr.m3u8";
            const fullUrl480 = domain + "/480p30/index-dvr.m3u8";
            const fullUrl720 = domain + "/720p60/index-dvr.m3u8";
            const fullUrl160 = domain + "/160p30/index-dvr.m3u8";

            // Insert the new player
            contentStream.html(
                `<div data-setup="{}" preload="auto" class="video-js vjs-16-9 vjs-big-play-centered vjs-controls-enabled vjs-workinghover vjs-v7 player-dimensions vjs-has-started vjs-paused 
                      vjs-user-inactive ${className}" id="player" tabindex="-1" lang="en" role="region" aria-label="Video Player">

                    <video id="video" class="vjs-tech vjs-matrix" controls>
                        <source src="${fullUrlsource}" type="application/x-mpegURL" id="vod" label="Source" selected="true">
                        <source src="${fullUrl720}" type="application/x-mpegURL" id="vod" label="720p60">
                        <source src="${fullUrl480}" type="application/x-mpegURL" id="vod" label="480p30">
                        <source src="${fullUrl360}" type="application/x-mpegURL" id="vod" label="360p30">
                        <source src="${fullUrl160}" type="application/x-mpegURL" id="vod" label="160p30">
                    </video>

                </div>`
            );

            document.getElementById('video').onloadedmetadata = () => {
                settings.current_watch["title"] = $("h2[data-a-target='stream-title']").text();
                settings.current_watch["id"] = key;
                settings.current_watch["max_time"] = player.currentTime() + player.remainingTime();

                // Fetch current VOD time from background (local storage)
                chrome.runtime.sendMessage({ type: "fetch_data", id: key }, function (response) {
                    if (response.success) {

                        settings.current_watch["time"] = response.data["time"];

                        player.currentTime(settings.current_watch["time"]);
                    }
                });

                // Fetch current volume from local storage
                const volume = window.localStorage.getItem("volume");

                if (volume != undefined) {
                    player.volume(volume);
                }

                // Save new volume in local storage
                player.on('volumechange', () => {
                    window.localStorage.setItem("volume", player.muted() ? 0.0 : player.volume());
                });

                // Save new time in local storage
                player.on('timeupdate', () => {
                    settings.current_watch["time"] = player.currentTime();

                    chrome.runtime.sendMessage({ type: "update", id: key, data: settings.current_watch }, function (response) { });
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

                    player.currentTime(final_time);
                }
            };

            // Init the player
            var player = videojs('video', {
                playbackRates: [0.5, 1, 1.25, 1.5, 2],
                controlBar: {
                    children: [
                        'playToggle',
                        'volumePanel',
                        'progressControl',
                        'remainingTimeDisplay',
                        'PlaybackRateMenuButton',
                        'qualitySelector',
                        'fullscreenToggle',
                    ],
                },
            });

            // Add custom class on video player to have a perfect size on all screen
            player.addClass('channel-page__video-player');

            // Patch the m3u8 VOD file to be readable
            videojs.Vhs.xhr.beforeRequest = function (options) {
                options.uri = options.uri.replace('unmuted.ts', 'muted.ts');
                return options;
            };

            player.play();

            document.addEventListener('keydown', (event) => {
                const name = event.key;

                // Backward and forward with arrow keys
                if (name == "ArrowLeft") {
                    player.currentTime(player.currentTime() - 5);
                } else if (name == "ArrowRight") {
                    player.currentTime(player.currentTime() + 5);
                }
            }, false);

            if (!settings.chat.enabled) {
                return;
            }

            setTimeout(() => {
                let index = 0;

                let messages = {
                    comments: []
                };

                fetchChat(vod_id, player.currentTime(), undefined).done(data => {
                    messages = $.parseJSON(data);
                });

                setInterval(() => {
                    if (!player.paused() && (messages != undefined && messages.comments.length > 0) && settings.chat.enabled) {
                        if (messages.comments.length == index) {
                            fetchChat(vod_id, player.currentTime(), messages._next).done(data => {
                                messages = $.parseJSON(data);

                                index = 0;
                            });
                        }

                        messages.comments.forEach(comment => {
                            let diff = player.currentTime() - comment.content_offset_seconds;

                            if (diff < -200) {
                                // Player is too backward
                                messages._next = undefined;
                                index = messages.comments.length; // Force to send a request
                            } else {
                                if (comment.content_offset_seconds <= player.currentTime()) {
                                    addMessage(comment);
                                    delete messages.comments[index];
                                    index++;
                                } else {
                                    // Means the player is too forwad for the API
                                    // Reset current chat cursor
                                    messages._next = undefined;
                                }
                            }
                        });
                    }
                }, 1000);
            }, 1200);
        } else {
            console.log("[TwitchNoSub] VOD links not working");
        }
    });
}

function checkUrl(url) {
    return $.ajax({
        url: url,
        type: 'GET',
        dataType: 'html',
        async: false,
        success: function (_, statut) {
            return statut === "success";
        }
    });
}