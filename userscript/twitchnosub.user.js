// ==UserScript==
// @name         TwitchNoSub
// @namespace    https://github.com/besuper/TwitchNoSub
// @version      1.0.2
// @description  Watch sub only VODs on Twitch
// @author       besuper
// @match        *://*.twitch.tv/videos/*
// @match        *://*.twitch.tv/*/video/*
// @updateURL    https://raw.githubusercontent.com/besuper/TwitchNoSub/master/userscript/twitchnosub.user.js
// @downloadURL  https://raw.githubusercontent.com/besuper/TwitchNoSub/master/userscript/twitchnosub.user.js
// @icon         https://raw.githubusercontent.com/besuper/TwitchNoSub/master/assets/icons/icon.png
// @run-at       document-start
// @inject-into  page
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

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
        constructor() {
            super(URL.createObjectURL(new Blob(["importScripts('https://cdn.jsdelivr.net/gh/besuper/TwitchNoSub/src/patch_amazonworker.js', 'https://cdn.jsdelivr.net/npm/amazon-ivs-player/dist/assets/amazon-ivs-worker.min.js');"])));

            if (!isVariantA) {
                this.addEventListener("message", (event) => {
                    const data = event.data;

                    if (data.id == 1 && data.type == 1) {
                        const newData = event.data;

                        newData.arg = [data.arg];

                        this.postMessage(newData);
                    }
                });
            }
        }
    }
})();
