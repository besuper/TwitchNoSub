var isVariantA = false;
const originalAppendChild = document.head.appendChild;

document.head.appendChild = function (element) {
    if (element.tagName === "SCRIPT") {
        if (element.src.includes("player-core-variant-a")) {
            isVariantA = true;
        }
    }

    return originalAppendChild.call(this, element);
};

const oldWorker = window.Worker;

window.Worker = class Worker extends oldWorker {
    constructor(twitchBlobUrl) {
        super(twitchBlobUrl);

        this.addEventListener("message", (event) => {
            const data = event.data;

            if ((data.id == 1 || isVariantA) && data.type == 1) {
                const newData = event.data;

                newData.arg = [data.arg];

                this.postMessage(newData);
            }
        });
    }
}