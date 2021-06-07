const domains = [
    "https://vod-secure.twitch.tv",
    "https://vod-metro.twitch.tv",
    "https://vod-pop-secure.twitch.tv",
    "https://d2e2de1etea730.cloudfront.net",
    "https://dqrpb9wgowsf5.cloudfront.net",
    "https://ds0h3roq6wcgc.cloudfront.net",
    "https://d2nvs31859zcd8.cloudfront.net",
    "https://d2aba1wr3818hz.cloudfront.net",
    "https://d3c27h4odz752x.cloudfront.net",
    "https://dgeft87wbj63p.cloudfront.net",
    "https://d1m7jfoe9zdc1j.cloudfront.net",
];

$(window).on('load', function () {

    setTimeout(() => {



        let checkSub = getElementByXpath('//p[contains(@data-test-selector, "content-overlay-gate__text")]');

        if (checkSub != undefined) {
            const video = getElementByXpath('//div[contains(@class, "persistent-player")]');
            const className = video.className;

            video.remove();

            const contentStream = getElementByXpath('//div[contains(@data-target, "persistent-player-content")]');

            let vodId = "";
            let streamerName = "";
            let timeStamp = 0;

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
                        vodId = data.broadcast_id;
                        streamerName = data.channel.name;
                        timeStamp = toTimestamp(data.created_at) - 9;
                    }
                }
            });

            setTimeout(() => {

                let baseString = streamerName + "_" + vodId + "_" + timeStamp;
                let hash = sha1(baseString).substring(0, 20);
                let finalString = hash + "_" + baseString;

                const key = baseString;

                domains.forEach(domain => {
                    let fullUrl = domain + "/" + finalString + "/chunked/index-dvr.m3u8";

                    let check = checkUrl(fullUrl);

                    check.then((data, statut) => {
                        if (statut === "success") {
                            contentStream.innerHTML = '<div data-setup="{}" preload="auto" class="video-js vjs-16-9 vjs-big-play-centered vjs-controls-enabled vjs-workinghover vjs-v7 player-dimensions vjs-has-started vjs-paused vjs-user-inactive ' + className + '" id="player" tabindex="-1" lang="en" role="region" aria-label="Video Player"> <video id="video" class="vjs-tech" controls><source src="' + fullUrl + '" type="application/x-mpegURL" id="vod"></video></div>';

                            document.getElementById('video').onloadedmetadata = () => {
                                let time = window.localStorage.getItem(key + "_time");

                                if (time != undefined) {
                                    player.currentTime(time);
                                }

                                let volume = window.localStorage.getItem(key + "_volume");

                                if (volume != undefined) {
                                    player.volume(volume);
                                }

                                player.on('volumechange', () => {
                                    window.localStorage.setItem(key + "_volume", player.volume());
                                });

                                player.on('timeupdate', () => {
                                    window.localStorage.setItem(key + "_time", player.currentTime());
                                });
                            };

                            var player = videojs('video', {
                                playbackRates: [0.5, 1, 1.25, 1.5, 2]
                            });
                            player.play();
                        }
                    });
                });
            }, 2000);
        }
    }, 1500);
})