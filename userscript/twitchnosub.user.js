// ==UserScript==
// @name         TwitchNoSub
// @namespace    https://github.com/besuper/TwitchNoSub
// @version      1.2.1
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

    // From vaft script (https://github.com/pixeltris/TwitchAdSolutions/blob/master/vaft/vaft.user.js#L299)
    function getWasmWorkerJs(twitchBlobUrl) {
        var req = new XMLHttpRequest();
        req.open('GET', twitchBlobUrl, false);
        req.overrideMimeType("text/javascript");
        req.send();
        return req.responseText;
    }

    const oldWorker = window.Worker;

    window.Worker = class Worker extends oldWorker {
        constructor(twitchBlobUrl) {
            var workerString = getWasmWorkerJs(`${twitchBlobUrl.replaceAll("'", "%27")}`);

            const blobUrl = URL.createObjectURL(new Blob([`
                importScripts(
                    'https://cdn.jsdelivr.net/gh/besuper/TwitchNoSub@master/src/patch_amazonworker.js',
                );
                ${workerString}
            `]));
            super(blobUrl);
        }
    }

    class RestrictionRemover {
        constructor() {
            this.observer = null;

            this.removeExistingRestrictions();
            this.createObserver();
        }

        removeExistingRestrictions() {
            document.querySelectorAll('.video-preview-card-restriction').forEach(element => {
                element.remove();
            });
        }

        createObserver() {
            this.observer = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.processNode(node);
                        }
                    });
                });
            });

            this.observer.observe(document.body, {
                childList: true,
                subtree: true,
                attributes: false,
                characterData: false
            });
        }

        processNode(node) {
            if (node.classList && node.classList.contains('video-preview-card-restriction')) {
                node.remove();
                return;
            }

            node.querySelectorAll('.video-preview-card-restriction').forEach(restriction => {
                restriction.remove();
            });
        }
    }

    new RestrictionRemover();
})();