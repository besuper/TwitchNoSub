function setupThumbnails(player, sprites) {

    const loadImage = (width, heigth) => {
        const rowSize = 5;
        const widthThumb = width / rowSize;
        const heightThumb = 62;

        const mawRow = Math.floor(heigth / heightThumb);
        const maxFrame = mawRow * rowSize;

        const maxTime = Math.floor(player.duration());

        const frameEverySeconds = Math.floor(maxTime / maxFrame);

        console.log("Number of rows : " + mawRow);
        console.log("Number of frames : " + maxFrame);
        console.log("Maximum vod time : " + maxTime);
        console.log("Frame every seconds : " + frameEverySeconds);

        const controlBar = $(".vjs-control-bar");

        controlBar.append(`
        <div class="vjs-thumbnail-wraper">
            <div class="vjs-thumbnail"></div>
            <div class="vjs-thumbnail-time"></div>
        </div>
        `);

        const thumb = controlBar.find('.vjs-thumbnail');
        const thumbTime = controlBar.find('.vjs-thumbnail-time');
        const wrapper = controlBar.find('.vjs-thumbnail-wraper');

        controlBar.on("mousemove", '.vjs-progress-control', () => {
            wrapper.css("display", "flex");

            var currentTime = $('.vjs-mouse-display .vjs-time-tooltip').text();
            var splitTime = currentTime.split(":");

            thumbTime.text(currentTime);

            currentTime = (+splitTime[0]) * 60 * 60 + (+splitTime[1]) * 60 + (+splitTime[2]);

            const position = controlBar.find('.vjs-progress-control .vjs-mouse-display').position();
            const time = Math.floor(currentTime / frameEverySeconds);

            const fetchRow = Math.floor(time / rowSize);
            const fetchFrame = time % rowSize;

            thumb.css({
                "background-image": `url(${sprites})`,
                "width": widthThumb + "px",
                "height": heightThumb + "px",
                "background-position-x": `-${fetchFrame * widthThumb}px`,
                "background-position-y": `-${fetchRow * heightThumb}px`
            });

            wrapper.css({
                "left": (position.left - 30) + 'px',
                "width": widthThumb + 'px',
                "height": (heightThumb + 20) + 'px'
            });
        });

        controlBar.on('mouseout', '.vjs-progress-control', () => {
            wrapper.css("display", "none");
        });

    };

    const img = new Image();
    img.onload = function () {
        loadImage(this.width, this.height);
    }
    img.src = sprites;
}