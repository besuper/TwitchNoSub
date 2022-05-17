var watch_list = {};

// Fetch watching list from local storage
chrome.storage.local.get(['tns_watching_list'], function (result) {
    if (result.tns_watching_list != undefined) {
        watch_list = result.tns_watching_list;
    } else {
        watch_list = result;
    }
});

// Add listener to all messages
chrome.runtime.onMessage.addListener(
    function (request, _, sendResponse) {

        // When watching a VOD the extension is sending update_time to keep the correct current VOD time
        if (request.type === "update_time") {

            const data = request.data;

            watch_list[data["id"]] = {
                "link": data["link"],
                "title": data["title"],
                "time": data["time"],
                "max_time": data["max_time"],
            };

            //chrome.storage.local.set({ "tns_watching_list": watch_list }, () => { });
        }

        // Feth a specific data with ID
        if (request.type === "fetch_data") {
            if (watch_list.hasOwnProperty(request.id)) {
                sendResponse({ success: true, data: watch_list[request.id] });
                return;
            }

            sendResponse({ success: false });
            return;
        }

        // Fetch the entire watching list
        if (request.type === "fetch") {
            sendResponse({ success: true, data: watch_list });
            return;
        }

        // Update a VOD
        if (request.type === "update") {
            watch_list[request.id] = request.data;

            //chrome.storage.local.set({ "tns_watching_list": watch_list }, () => { });
        }

        // Delete a VOD
        if (request.type === "delete") {
            delete watch_list[request.id];

            //chrome.storage.local.set({ "tns_watching_list": watch_list }, () => { });
        }

        sendResponse({ success: true });
    }
);

setInterval(() => {
    chrome.storage.local.set({ "tns_watching_list": watch_list }, () => { });
}, 1200);