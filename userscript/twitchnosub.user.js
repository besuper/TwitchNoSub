// ==UserScript==
// @name         TwitchNoSub
// @namespace    https://github.com/besuper/TwitchNoSub
// @version      1.1.0
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
            var workerUrl = workerString.replace("importScripts('", "").replace("')", "");

            const blobUrl = URL.createObjectURL(new Blob([`
                importScripts(
                    'https://cdn.jsdelivr.net/gh/besuper/TwitchNoSub/src/patch_amazonworker.js',
                    '${workerUrl}'
                );
            `]));
            super(blobUrl);
        }
    }
})();