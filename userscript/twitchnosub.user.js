// ==UserScript==
// @name         TwitchNoSub
// @namespace    https://github.com/besuper/TwitchNoSub
// @version      1.2.3
// @description  Watch sub only VODs on Twitch
// @author       besuper
// @updateURL    https://raw.githubusercontent.com/besuper/TwitchNoSub/master/userscript/twitchnosub.user.js
// @downloadURL  https://raw.githubusercontent.com/besuper/TwitchNoSub/master/userscript/twitchnosub.user.js
// @icon         https://raw.githubusercontent.com/besuper/TwitchNoSub/master/assets/icons/icon.png
// @match        *://*.twitch.tv/*
// @run-at       document-start
// @inject-into  page
// @grant        none

// ==/UserScript==
(function () {
    'use strict';

    const patchUrl = 'https://cdn.jsdelivr.net/gh/besuper/TwitchNoSub@master/src/patch_amazonworker.js';

    function isTwitchWorkerUrl(value) {
        try {
            const url = new URL(String(value), window.location.href);
            const hostname = url.hostname || new URL(url.origin).hostname;
            return hostname === 'twitch.tv'
                || hostname.endsWith('.twitch.tv')
                || hostname === 'twitchcdn.net'
                || hostname.endsWith('.twitchcdn.net');
        } catch (_) {
            return false;
        }
    }

    function readWorkerSource(workerUrl) {
        const request = new XMLHttpRequest();
        request.open('GET', String(workerUrl), false);
        request.overrideMimeType('text/javascript');
        request.send();
        return request.responseText;
    }

    function createWorkerTrampoline(workerSource) {
        const compositeUrl = URL.createObjectURL(new Blob([
            `importScripts(${JSON.stringify(patchUrl)});\n`,
            `if (typeof self.__TNS_INSTALL_WORKER_PATCH__ === 'function') {\n`,
            `    self.__TNS_INSTALL_WORKER_PATCH__();\n`,
            `    delete self.__TNS_INSTALL_WORKER_PATCH__;\n`,
            `}\n`,
            workerSource
        ], { type: 'text/javascript' }));
        const trampolineUrl = URL.createObjectURL(new Blob([
            `importScripts('${compositeUrl}');`
        ], { type: 'text/javascript' }));

        return { compositeUrl, trampolineUrl };
    }

    function looksLikeAmazonIvsWorker(workerSource) {
        return /amazon[-_.]?ivs|ivs[-_.]?(?:wasm)?worker|amazon[-_.]?wasmworker/i.test(workerSource);
    }

    function revokeGeneratedUrls(generatedUrls) {
        URL.revokeObjectURL(generatedUrls.trampolineUrl);
        URL.revokeObjectURL(generatedUrls.compositeUrl);
    }

    const hookMarker = '__tns_worker_hook_installed__';
    if (!window[hookMarker]) {
        const PreviousWorker = window.Worker;

        const TwitchNoSubWorker = class Worker extends PreviousWorker {
            // besuper/TwitchNoSub worker hook compatibility marker
            constructor(workerUrl, options) {
                let targetUrl = workerUrl;
                let generatedUrls = null;

                const isClassicWorker = !options || options.type === undefined || options.type === 'classic';
                if (isClassicWorker && isTwitchWorkerUrl(workerUrl)) {
                    try {
                        const workerSource = readWorkerSource(workerUrl);
                        if (!looksLikeAmazonIvsWorker(workerSource)) {
                            super(targetUrl, options);
                            return;
                        }

                        generatedUrls = createWorkerTrampoline(workerSource);
                        targetUrl = generatedUrls.trampolineUrl;
                    } catch (error) {
                        console.error('[TNS] Unable to hook Twitch worker; using the original worker', error);
                    }
                }

                try {
                    super(targetUrl, options);
                } catch (error) {
                    if (generatedUrls) revokeGeneratedUrls(generatedUrls);
                    throw error;
                }

                if (generatedUrls) {
                    setTimeout(() => revokeGeneratedUrls(generatedUrls), 60_000);
                }
            }
        };

        Object.defineProperty(TwitchNoSubWorker, 'toString', {
            configurable: true,
            value: PreviousWorker.toString.bind(PreviousWorker)
        });
        window.Worker = TwitchNoSubWorker;
        window[hookMarker] = true;
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

    function startRestrictionRemover() {
        new RestrictionRemover();
    }

    if (document.body) {
        startRestrictionRemover();
    } else {
        document.addEventListener('DOMContentLoaded', startRestrictionRemover, { once: true });
    }
})();
