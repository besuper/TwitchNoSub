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

// Save changes into local storage every 3 seconds
setInterval(() => {
    if (updated) {
        chrome.storage.local.set({ "tns_watching_list": watch_list }, () => {
            updated = false;
        });
    }
}, 3000);


// Listen to usher.ttvnw.net request (request acces to a VOD)
chrome.webRequest.onCompleted.addListener(data => {
    // If the request failed it means the VOD is sub-only
    if (data.url.includes("https://usher.ttvnw.net/vod/") && data.statusCode == 403) {
        setTimeout(() => {
            chrome.tabs.sendMessage(data.tabId, { type: "load_vod" }, function () { });
        }, 300);
    }

}, { urls: ["https://usher.ttvnw.net/*"] }, ["responseHeaders"]);

// Make background wake up
chrome.webNavigation.onBeforeNavigate.addListener(function () {

}, {
    url: [{ hostContains: "twitch" }]
});