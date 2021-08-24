$(window).on('load', function () {

    setTimeout(() => {

        let checkSub = getElementByXpath('//div[contains(@data-a-target, "player-overlay-content-gate")]');

        if (checkSub != undefined) {

            checkSub.innerHTML = '<img src="https://i.ibb.co/NTpWgM1/Rolling-1s-200px.gif" alt="Loading VOD">';

            const video = getElementByXpath('//div[contains(@class, "persistent-player")]');
            const className = video.className;

            const contentStream = getElementByXpath('//div[contains(@data-target, "persistent-player-content")]');

            $.ajax({
                url: "https://api.twitch.tv/kraken/videos/" + window.location.toString().split("/").pop(),
                headers: {
                    "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
                    "Accept": "application/vnd.twitchtv.v5+json"
                },
                type: 'GET',
                dataType: 'json',
                success: function (data, statut) {
                    if (statut === "success") {
                        const animated_preview_url = data.animated_preview_url;
                        const domain = animated_preview_url.split("/storyboards")[0].trim();

                        setTimeout(() => {
                            video.remove();

                            const chanels = getElementsByXPath('//a[contains(@data-test-selector, "followed-channel")]');

                            chanels.forEach(chanel => {
                                chanel.onclick = on_click;
                            });

                            const vods = getElementsByXPath('//img[contains(@src, "vods/")]');
                            vods.forEach(vod => {
                                vod.onclick = on_click;
                            });

                            retrieveVOD(domain, contentStream, className);

                        }, 1000);
                    }
                }
            });
        }
    }, 1500);
})

function on_click() {
    setTimeout(() => {
        document.location.reload();
    }, 200);
}

function getDomain(url) {
    return url.replace("http://", "").replace("https://", "").split("/")[0];
}

function retrieveVOD(domain, contentStream, className) {
    const key = domain.split("/")[3];

    let fullUrl = domain + "/chunked/index-dvr.m3u8";

    checkUrl(fullUrl).then((data, statut) => {
        if (statut === "success") {
            contentStream.innerHTML = '<div data-setup="{}" preload="auto" class="video-js vjs-16-9 vjs-big-play-centered vjs-controls-enabled vjs-workinghover vjs-v7 player-dimensions vjs-has-started vjs-paused vjs-user-inactive ' + className + '" id="player" tabindex="-1" lang="en" role="region" aria-label="Video Player"> <video id="video" class="vjs-tech vjs-matrix" controls><source src="' + fullUrl + '" type="application/x-mpegURL" id="vod"></video></div>';

            document.getElementById('video').onloadedmetadata = () => {
                let time = window.localStorage.getItem(key + "_time");

                if (time != undefined) {
                    player.currentTime(time);
                }

                let volume = window.localStorage.getItem("volume");

                if (volume != undefined) {
                    player.volume(volume);
                }

                player.on('volumechange', () => {
                    window.localStorage.setItem("volume", player.volume());
                });

                player.on('timeupdate', () => {
                    window.localStorage.setItem(key + "_time", player.currentTime());
                });
            };

            var player = videojs('video', {
                playbackRates: [0.5, 1, 1.25, 1.5, 2],
            });

            videojs.Hls.xhr.beforeRequest = function (options) {
                options.uri = options.uri.replace('unmuted.ts', 'muted.ts');
                return options;
            };

            player.play();

            setTimeout(() => {
                let index = 0;

                let messages = {
                    "comments": []
                };

                fetchChat(player.currentTime(), undefined).done(data => {
                    messages = $.parseJSON(data);
                });

                setInterval(() => {
                    if (!player.paused() && messages != undefined && messages.comments.length > 0) {

                        if (messages.comments.length == index) {
                            fetchChat(player.currentTime(), messages._next).done(data => {
                                messages = $.parseJSON(data);

                                index = 0;
                            });
                        }

                        messages.comments.forEach(comment => {
                            if (comment.content_offset_seconds <= player.currentTime()) {
                                addMessage(comment);
                                delete messages.comments[index];
                                index++;
                            }
                        });
                    }
                }, 1000);
            }, 1200);
        }
    });
}