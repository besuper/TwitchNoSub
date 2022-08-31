class MediaAPI {
    constructor(media) {
        this.media = media;
    }

    get inner() {
        return this.media;
    }

    play() {
        this.media.play();
    }

    pause() {
        this.media.pause();
    }

    duration() {
        return this.media.duration;
    }

    paused() {
        return this.media.paused;
    }

    muted() {
        return this.media.muted;
    }

    currentTime(time) {
        if (time != undefined) {
            this.media.currentTime = time;
            return;
        }

        return this.media.currentTime;
    }

    volume(volume) {
        if (volume != undefined) {
            this.media.volume = volume;
            return;
        }

        return this.media.volume;
    }

    remainingTime() {
        return this.duration() - this.currentTime();
    }

    addClass(className) {
        this.media.classList.add(className);
    }

    on(event, callback) {
        this.media.addEventListener(event, callback);
    }
}