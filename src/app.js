var isVariantA = false;

const originalAppendChild = document.head.appendChild;

document.head.appendChild = function (element) {
    if (element?.tagName === "SCRIPT") {
        if (element?.src?.includes("player-core-variant-a")) {
            isVariantA = true;
        }
    }

    return originalAppendChild.call(this, element);
};

const oldWorker = window.Worker;

window.Worker = class Worker extends oldWorker {
    constructor(twitchBlobUrl) {
        super(twitchBlobUrl);

        console.log("[TNS] Patched worker with variant: " + (isVariantA ? "A" : "B"));

        this.addEventListener("message", (event) => {
            const { data } = event;

            if ((data.id === 1 || isVariantA) && data.type === 1) {
                try {
                    this.postMessage({ ...data, arg: [data.arg] });
                } catch (e) {
                    console.error("[TNS] Error when sending postMessage");
                    console.error(e);
                    console.error(data);

                    event.data.arg = [data.arg];

                    if ("srcObj" in data.arg) {
                        // Sometimes data contains MediaSourceHandle that is non-cloneable
                        // data.arg contains srcObj: MediaSourceHandle {}
                        console.log("[TNS] MediaSourceHandle found, can't post updated message");

                        // Can't post here, but only updating data still works fixing undefined mode
                    }
                }
            }
        });
    }
}