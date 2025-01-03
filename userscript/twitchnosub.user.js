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
// @inject-into  page
// @grant        none
// ==/UserScript==
(function () {
    'use strict';

    var isVariantA = false;

    const originalAppendChild = document.head.appendChild;

    document.head.appendChild = function (element) {
        if (element.tagName === "SCRIPT") {
            if (element.src && element.src.includes("player-core-variant-a")) {
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

            if (!isVariantA) {
                this.addEventListener("message", (event) => {
                    const { data } = event;
                    if (data.id === 1 && data.type === 1) {
                        this.postMessage({ ...data, arg: [data.arg] });
                    }
                });
            }
        }
    }
})();