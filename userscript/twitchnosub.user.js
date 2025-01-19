// ==UserScript==
// @name         TwitchNoSub
// @namespace    https://github.com/besuper/TwitchNoSub
// @version      1.0.4
// @description  Watch sub only VODs on Twitch
// @author       besuper
// @updateURL    https://raw.githubusercontent.com/besuper/TwitchNoSub/master/userscript/twitchnosub.user.js
// @downloadURL  https://raw.githubusercontent.com/besuper/TwitchNoSub/master/userscript/twitchnosub.user.js
// @icon         https://raw.githubusercontent.com/besuper/TwitchNoSub/master/assets/icons/icon.png
// @match        *://*.twitch.tv/*
// @run-at       document-end
// @inject-into  page
// @grant        none

// ==/UserScript==
(function () {
    'use strict';

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
        constructor() {
            const blobUrl = URL.createObjectURL(new Blob([`
                importScripts(
                    'https://cdn.jsdelivr.net/gh/besuper/TwitchNoSub/src/patch_amazonworker.js',
                    'https://cdn.jsdelivr.net/npm/amazon-ivs-player/dist/assets/amazon-ivs-worker.min.js'
                );
            `]));
            super(blobUrl);

            console.log("[TNS] Patched worker with variant: " + (isVariantA ? "A" : "B"));

            this.addEventListener("message", (event) => {
                const { data } = event;
                if ((data.id === 1 || isVariantA) && data.type === 1) {
                    // Sometimes there is a codec property undefined that cause Error 4000
                    // amazon-ivs-worker.min.js:2 Player stopping playback - error :2 (ErrorNotSupported code 4 - Failed to execute 'addSourceBuffer' on 'MediaSource': The type provided ('video/mp4;undefined') is unsupported.)

                    try {
                        this.postMessage({ ...data, arg: [data.arg] });
                    } catch (e) {
                        console.error("[TNS] Error when sending postMessage");
                        console.error(e);
                        console.error(data);

                        let isMediaSource = false;

                        for (const element of data.arg) {
                            if (typeof element === "object" && "srcObj" in element) {
                                isMediaSource = true;
                                break;
                            }
                        }

                        if (isMediaSource) {
                            // Sometimes data contains MediaSourceHandle that is non-cloneable
                            // data.arg contains srcObj: MediaSourceHandle {}
                            console.log("[TNS] MediaSourceHandle found, can't patch the message");
                            return;
                        }

                        // In case of other errors, still try post message
                        this.postMessage({ ...data, arg: [data.arg] });
                    }
                }
            });
        }
    }
})();