(function () {
    'use strict';

    // Prevent double-injection (e.g. multiple content-script frames / reloads)
    if (window.__twitchNoSub) return;
    Object.defineProperty(window, '__twitchNoSub', {
        value: true,
        configurable: false,
        enumerable: false,
        writable: false
    });

    const patch_url = localStorage.getItem("tns_internal_patch_url");

    if (typeof patch_url === 'undefined' || !patch_url) {
        console.error('[TNS] patch_url is not defined – worker patch cannot be applied');
        return;
    }

    const WORKER_URL_CACHE = new Map();
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

    /**
     * Walk a possible importScripts chain (blob → blob → …) looking for the
     * Amazon IVS WASM worker. Only those workers need the patch.
     */
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

    /**
     * Build a small bootstrap blob that loads the patch first, then the
     * original worker script through importScripts(). This avoids
     * inlining the whole worker source (more efficient and less fragile).
     */
    function buildPatchedBlobUrl(originalScriptUrl) {
        const bootstrap = `"use strict";
try {
    importScripts(${JSON.stringify(patch_url)});
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
})();
