var watch_list = {};
var updated = false;
var loaded_vod = {};

// Fetch watching list from local storage
chrome.storage.local.get(['tns_watching_list'], function (result) {
    if (result.tns_watching_list != undefined) {
        watch_list = result.tns_watching_list;
    } else {
        watch_list = result;
    }
    console.log("Loaded");
});

// Add listener to all messages
chrome.runtime.onMessage.addListener(function (request, _, sendResponse) {

    // When watching a VOD the extension is sending update_time to keep the correct current VOD time
    if (request.type === "update_time") {
        const data = request.data;

        watch_list[data["id"]] = {
            "link": data["link"],
            "title": data["title"],
            "time": data["time"],
            "max_time": data["max_time"],
        };

        sendResponse({ success: true });
        return true;
    }

    // Feth a specific data with ID
    if (request.type === "fetch_data") {
        if (watch_list.hasOwnProperty(request.id)) {
            sendResponse({ success: true, data: watch_list[request.id] });
            return true;
        }

        sendResponse({ success: false });
        return true;
    }

    // Fetch the entire watching list
    if (request.type === "fetch") {
        sendResponse({ success: true, data: watch_list });
        return true;
    }

    // Update a VOD
    if (request.type === "update") {
        watch_list[request.id] = request.data;
        updated = true;
        sendResponse({ success: true });
        return true;
    }

    // Delete a VOD
    if (request.type === "delete") {
        delete watch_list[request.id];
        updated = true;
        sendResponse({ success: true });
        return true;
    }

    return true;
});

// Save changes into local storage every 1.2 seconds
setInterval(() => {
    if (updated) {
        chrome.storage.local.set({ "tns_watching_list": watch_list }, () => {
            updated = false;
        });
    }
}, 1200);

// On update in tabs
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    // If the link changed and contains specific VOD url
    if (details.transitionType === "link" && (details.url.includes("/videos/") || details.url.includes("/video/"))) {
        const key = details.tabId + "";

        // Don't send message twice cause event is fired twice
        if (key in loaded_vod) {
            delete loaded_vod[key];
            return;
        }

        loaded_vod[key] = true;

        // Send to the app script that the user is on a VOD
        setTimeout(() => {
            chrome.tabs.sendMessage(details.tabId, { type: "load_vod" }, function () { });
        }, 1200);
    }

}, { url: [{ urlMatches: 'https?://(www\\.)?twitch\\.tv/.*' }] });