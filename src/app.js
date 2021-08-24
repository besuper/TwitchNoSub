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
                    "User-Agent": "Mozilla/5.0",
                    "Accept": "application/vnd.twitchtv.v5+json"
                },
                type: 'GET',
                dataType: 'json',
                success: function (data, statut) {
                    if (statut === "success") {
                        const thumbUrl = data.preview.small;
                        const splot = thumbUrl.split("//thumb/")[0].split("/");
                        const finalString = splot[splot.length - 1];
                        const domain = getDomain(data.animated_preview_url).trim();

                        setTimeout(() => {
                            video.remove();

                            retrieveVOD(domain, finalString, contentStream, className);
                        }, 1000);
                    }
                }
            });
        }
    }, 1500);
})

function getDomain(url) {
    return url.replace("http://", "").replace("https://", "").split("/")[0];
}

function retrieveVOD(domain, finalString, contentStream, className) {

    let found = false;

    const key = finalString;

    let fullUrl = "https://" + domain + "/" + finalString + "/chunked/index-dvr.m3u8";

    let check = checkUrl(fullUrl);

    check.then((data, statut) => {
        if (statut === "success") {
            found = true;
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
                playbackRates: [0.5, 1, 1.25, 1.5, 2]
            });
            player.play();

            setTimeout(() => {
                let index = 0;

                let messages = {
                    "comments": []
                };

                fetchChat(player.currentTime(), undefined).done(data => {
                    console.log("Received data");
                    messages = $.parseJSON(data);
                });

                setInterval(() => {
                    if (!player.paused() && messages != undefined && messages.comments.length > 0) {

                        if (messages.comments.length == index) {
                            console.log("Need refresh");

                            fetchChat(player.currentTime(), messages._next).done(data => {
                                console.log("Received data next");
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
    //}

    return found;
}