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

    // Twitch marks every quality of a sub-only VOD as restricted in the playback
    // token. The player reads that list, renders the subscribe gate and never
    // calls usher, so the worker patch below never gets a request to intercept.
    // Clearing the list lets playback carry on to usher, where the patch takes over.
    function clearRestrictedBitrates(payload) {
        const token = payload?.data?.videoPlaybackAccessToken;

        if (!token || typeof token.value !== "string") {
            return false;
        }

        const value = JSON.parse(token.value);

        if (!value?.chansub?.restricted_bitrates?.length) {
            return false;
        }

        console.log(`[TNS] Clearing ${value.chansub.restricted_bitrates.length} restricted qualities`);

        value.chansub.restricted_bitrates = [];
        token.value = JSON.stringify(value);

        return true;
    }

    // The gate is also rendered straight from the video metadata, before the
    // player ever asks for a token, so the restriction has to be cleared there as
    // well. The field turns up under several operations, hence the blind walk.
    //
    // Only subscription gating is ours to clear. Geo blocks, takedowns and
    // parental controls travel under the same field names, so leave anything else
    // alone and say so: if the gate ever comes back, the log names the type.
    const RESTRICTION_MARKERS = ["restricted_bitrates", "resourceRestriction", "isRestricted"];
    const VIDEO_SCOPE_KEYS = new Set(["video", "videos", "vod", "vods"]);

    function stripRestrictions(node, inVideo = false, seen = new Set()) {
        if (!node || typeof node !== "object" || seen.has(node)) {
            return false;
        }

        seen.add(node);

        let changed = false;

        if (Array.isArray(node)) {
            for (const item of node) {
                changed = stripRestrictions(item, inVideo, seen) || changed;
            }

            return changed;
        }

        for (const [key, value] of Object.entries(node)) {
            if (key === "resourceRestriction" && value) {
                const type = String(value.type || "unknown");

                if (/SUB/i.test(type)) {
                    node[key] = null;
                    changed = true;
                } else {
                    console.log(`[TNS] Leaving the ${type} restriction in place`);
                }

                continue;
            }

            if (key === "isRestricted" && value === true && inVideo) {
                node[key] = false;
                changed = true;
                continue;
            }

            changed = stripRestrictions(value, inVideo || VIDEO_SCOPE_KEYS.has(key), seen) || changed;
        }

        return changed;
    }

    const oldFetch = window.fetch;

    window.fetch = async function (input, init) {
        const url = input instanceof Request ? input.url : String(input);

        if (!url.includes("gql.twitch.tv/gql")) {
            return oldFetch(input, init);
        }

        const response = await oldFetch(input, init);

        let text;

        try {
            text = await response.clone().text();
        } catch (e) {
            return response;
        }

        if (!RESTRICTION_MARKERS.some(marker => text.includes(marker))) {
            return response;
        }

        try {
            const payload = JSON.parse(text);
            const entries = Array.isArray(payload) ? payload : [payload];

            const changed = entries
                .map(entry => [clearRestrictedBitrates(entry), stripRestrictions(entry)].some(Boolean))
                .some(Boolean);

            if (!changed) {
                return response;
            }

            // The rewritten body has a different length and is no longer encoded,
            // so the original values for those headers would be lies.
            const headers = new Headers(response.headers);

            headers.delete("content-length");
            headers.delete("content-encoding");

            return new Response(JSON.stringify(payload), {
                status: response.status,
                statusText: response.statusText,
                headers
            });
        } catch (e) {
            console.log("[TNS] Unable to patch the GraphQL response", e);

            return response;
        }
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