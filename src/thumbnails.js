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

        const controlBar = document.querySelector(".vjs-control-bar");

        const wrapper = document.createElement("div");
        wrapper.className = "vjs-thumbnail-wraper";

        const thumb = document.createElement("div");
        thumb.className = "vjs-thumbnail";

        const thumbTime = document.createElement("div");
        thumbTime.className = "vjs-thumbnail-time";

        wrapper.appendChild(thumb);
        wrapper.appendChild(thumbTime);

        controlBar.appendChild(wrapper);

        const thumbStyle = thumb.style;
        const wrapperStyle = wrapper.style;

        controlBar.addEventListener("mousemove", () => {
            wrapper.style.display = "flex";

            var currentTime = document.querySelector('.vjs-mouse-display .vjs-time-tooltip').textContent;
            var splitTime = currentTime.split(":");

            thumbTime.textContent = currentTime;

            currentTime = (+splitTime[0]) * 60 * 60 + (+splitTime[1]) * 60 + (+splitTime[2]);

            const position = controlBar.querySelector('.vjs-progress-control .vjs-mouse-display');
            const time = Math.floor(currentTime / frameEverySeconds);

            const fetchRow = Math.floor(time / rowSize);
            const fetchFrame = time % rowSize;

            thumbStyle.backgroundImage = `url(${sprites})`;
            thumbStyle.width = widthThumb + "px";
            thumbStyle.height = heightThumb + "px";
            thumbStyle.backgroundPositionX = `-${fetchFrame * widthThumb}px`;
            thumbStyle.backgroundPositionY = `-${fetchRow * heightThumb}px`;

            wrapperStyle.left = (position.offsetLeft - 30) + 'px';
            wrapperStyle.width = widthThumb + 'px';
            wrapperStyle.height = (heightThumb + 20) + 'px';
        });

        controlBar.addEventListener('mouseout', () => {
            wrapperStyle.display = "none";
        });

    };

    const img = new Image();
    img.onload = function () {
        loadImage(this.width, this.height);
    }
    img.src = sprites;
}