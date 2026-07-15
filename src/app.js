(() => {
    "use strict";

    const workerPatchFactory = globalThis.__TNS_INSTALL_WORKER_PATCH__;
    delete globalThis.__TNS_INSTALL_WORKER_PATCH__;

    const hookMarker = "__tns_worker_hook_installed__";
    if (window[hookMarker]) return;

    if (typeof workerPatchFactory !== "function") {
        console.error("[TNS] The bundled worker patch is missing; the extension was not initialized");
        return;
    }

    const workerPatchSource = `(${workerPatchFactory.toString()})();\n`;

    function isTwitchWorkerUrl(value) {
        try {
            const url = new URL(String(value), window.location.href);
            const hostname = url.hostname || new URL(url.origin).hostname;
            return hostname === "twitch.tv"
                || hostname.endsWith(".twitch.tv")
                || hostname === "twitchcdn.net"
                || hostname.endsWith(".twitchcdn.net");
        } catch (_) {
            return false;
        }
    }

    // Based on the worker-loading approach used by TwitchAdSolutions/vaft.
    function readWorkerSource(workerUrl) {
        const request = new XMLHttpRequest();
        request.open("GET", String(workerUrl), false);
        request.overrideMimeType("text/javascript");
        request.send();

        if (request.status !== 0 && (request.status < 200 || request.status >= 300)) {
            throw new Error(`Unable to read Twitch worker (HTTP ${request.status})`);
        }

        return request.responseText;
    }

    function looksLikeAmazonIvsWorker(workerSource) {
        return /amazon[-_.]?ivs|ivs[-_.]?(?:wasm)?worker|amazon[-_.]?wasmworker/i.test(workerSource);
    }

    function createWorkerTrampoline(workerSource) {
        const compositeUrl = URL.createObjectURL(new Blob([
            workerPatchSource,
            workerSource
        ], { type: "text/javascript" }));

        // Some ad-blocking extensions inspect a worker blob and keep only the
        // first single-quoted importScripts URL. Point that URL at the complete
        // composite worker so both hooks remain active regardless of load order.
        const trampolineUrl = URL.createObjectURL(new Blob([
            `importScripts('${compositeUrl}');`
        ], { type: "text/javascript" }));

        return { compositeUrl, trampolineUrl };
    }

    function revokeGeneratedUrls(generatedUrls) {
        URL.revokeObjectURL(generatedUrls.trampolineUrl);
        URL.revokeObjectURL(generatedUrls.compositeUrl);
    }

    const PreviousWorker = window.Worker;

    const TwitchNoSubWorker = class Worker extends PreviousWorker {
        // besuper/TwitchNoSub worker hook compatibility marker
        constructor(workerUrl, options) {
            let targetUrl = workerUrl;
            let generatedUrls = null;

            const isClassicWorker = !options || options.type === undefined || options.type === "classic";
            if (isClassicWorker && isTwitchWorkerUrl(workerUrl)) {
                try {
                    const workerSource = readWorkerSource(workerUrl);
                    if (!workerSource) throw new Error("Twitch worker source is empty");

                    if (!looksLikeAmazonIvsWorker(workerSource)) {
                        super(targetUrl, options);
                        return;
                    }

                    generatedUrls = createWorkerTrampoline(workerSource);
                    targetUrl = generatedUrls.trampolineUrl;
                    console.debug("[TNS] Twitch worker hooked");
                } catch (error) {
                    console.error("[TNS] Unable to hook Twitch worker; using the original worker", error);
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

    // AdGuard Extra compares Worker.toString() with a clean iframe before it
    // installs its own hook. Preserve the previous constructor's representation.
    Object.defineProperty(TwitchNoSubWorker, "toString", {
        configurable: true,
        value: PreviousWorker.toString.bind(PreviousWorker)
    });

    window.Worker = TwitchNoSubWorker;
    window[hookMarker] = window.Worker === TwitchNoSubWorker;

    if (!window[hookMarker]) {
        console.warn("[TNS] Another extension prevented the Twitch worker hook from being installed");
    }
})();
