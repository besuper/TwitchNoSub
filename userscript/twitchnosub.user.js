// ==UserScript==
// @name         TwitchNoSub
// @namespace    https://github.com/besuper/TwitchNoSub
// @version      2.0.0
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

    if (window.__twitchNoSub) return;
    Object.defineProperty(window, '__twitchNoSub', {
        value: true,
        configurable: false,
        enumerable: false,
        writable: false
    });

    const WORKER_URL_CACHE = new Map();
    const PATCH_URL = 'https://cdn.jsdelivr.net/gh/besuper/TwitchNoSub@master/src/patch_amazonworker.js';
    const IVS_WORKER_RE = /amazon-ivs-wasmworker[\w.-]*\.js/i;
    const IMPORT_RE = /importScripts\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

    function fetchSync(url) {
        try {
            const req = new XMLHttpRequest();
            req.open('GET', url, false);
            req.overrideMimeType('text/javascript');
            req.send();

            if (req.status === 0 || (req.status >= 200 && req.status < 300)) {
                return req.responseText || '';
            }
        } catch (e) {
            console.warn('[TNS] Failed to fetch worker source:', url, e);
        }

        return null;
    }

    function chainLeadsToIvsWorker(initialUrl, maxDepth = 5) {
        if (WORKER_URL_CACHE.has(initialUrl)) {
            return WORKER_URL_CACHE.get(initialUrl);
        }

        let url = String(initialUrl);
        let result = false;

        for (let depth = 0; depth < maxDepth; depth++) {
            if (IVS_WORKER_RE.test(url)) {
				result = true;
				break;
			}

            const src = fetchSync(url);
            if (!src) break;

            IMPORT_RE.lastIndex = 0;

            let match;
            let nextBlobUrl = null;

            while ((match = IMPORT_RE.exec(src))) {
                const importedUrl = match[1];

                if (IVS_WORKER_RE.test(importedUrl)) {
                    result = true;
                    break;
                }

                if (!nextBlobUrl && importedUrl.startsWith('blob:')) {
                    nextBlobUrl = importedUrl;
                }
            }

            if (result) break;
            if (!nextBlobUrl) break;
            url = nextBlobUrl;
        }

        WORKER_URL_CACHE.set(initialUrl, result);
        return result;
    }

    function buildPatchedBlobUrl(originalScriptUrl) {
        const bootstrap = `"use strict";
try {
    importScripts(${JSON.stringify(PATCH_URL)});
} catch (error) {
    console.error('[TNS] patch_amazonworker failed:', error);
}
importScripts(${JSON.stringify(String(originalScriptUrl))});
try { self.postMessage({ __tns: 'ready' }); } catch (_) {}
`;

        return URL.createObjectURL(
            new Blob([bootstrap], {
                type: 'text/javascript'
            })
        );
    }

    const NativeWorker = window.Worker;

    if (typeof NativeWorker === 'function') {
        window.Worker = new Proxy(NativeWorker, {
            construct(target, args) {
                let [scriptUrl, options] = args;

                if (scriptUrl == null || options?.type === 'module' || !chainLeadsToIvsWorker(scriptUrl)) {
                    return new target(scriptUrl, options);
                }

                const patchedUrl = buildPatchedBlobUrl(scriptUrl);
                const workerInstance = new target(patchedUrl, options);

                let revoked = false;
                const revoke = () => {
                    if (revoked) return;
                    revoked = true;
                    URL.revokeObjectURL(patchedUrl);
                    workerInstance.removeEventListener('message', onMessage);
                    workerInstance.removeEventListener('error', onError);
                };

                const onMessage = (event) => {
                    if (event.data?.__tns === 'ready') revoke();
                };

                const onError = () => revoke();

                workerInstance.addEventListener('message', onMessage);
                workerInstance.addEventListener('error', onError);
                setTimeout(revoke, 5000);

                return workerInstance;
            }
        });
    }

    function removeFromNode(node) {
        if (!node || node.nodeType !== 1) return;

        if (node.classList?.contains('video-preview-card-restriction')) {
            node.remove();
            return;
        }

        const restrictions = node.getElementsByClassName?.(
            'video-preview-card-restriction'
        );

        if (!restrictions?.length) return;

        for (let index = restrictions.length - 1; index >= 0; index--) {
            restrictions[index].remove();
        }
    }

    function sweepExisting() {
        const restrictions = document.getElementsByClassName(
            'video-preview-card-restriction'
        );

        while (restrictions.length) {
            restrictions[0].remove();
        }
    }

    sweepExisting();

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            if (mutation.addedNodes) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType === 1) {
                        removeFromNode(node);
                    }
                }
            }

            if (
                mutation.type === 'attributes' &&
                mutation.target?.classList?.contains('video-preview-card-restriction')
            ) {
                mutation.target.remove();
            }
        }
    });

    const observerTarget = document.getElementById('root') || document.body;

    if (observerTarget) {
        observer.observe(observerTarget, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class']
        });
    }

    window.addEventListener(
        'beforeunload',
        () => observer.disconnect(),
        { once: true, passive: true }
    );
})();