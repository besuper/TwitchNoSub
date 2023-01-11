// Make background wake up
chrome.webNavigation.onBeforeNavigate.addListener(function () {

}, {
    url: [{ hostContains: "twitch" }]
});

var isChrome = chrome.declarativeNetRequest != undefined;

// Patching amazon service worker
if (isChrome) {
    // declarativeNetRequest only available on chrome
    chrome.declarativeNetRequest.updateDynamicRules({
        addRules: [{
            'id': 1001,
            'priority': 1,
            'action': {
                'type': 'redirect',
                'redirect': {
                    url: chrome.runtime.getURL("src/amazon-ivs-worker.min.js")
                }
            },
            'condition': {
                'urlFilter': 'https://static.twitchcdn.net/assets/amazon-ivs-wasmworker.min-*.js',
            }
        }],
        removeRuleIds: [1001]
    })
} else {
    // Support firefox here
    browser.webRequest.onBeforeRequest.addListener(function (details) {
        return { redirectUrl: browser.runtime.getURL("src/amazon-ivs-worker.min.js") };
    },
        {
            urls: [
                "https://static.twitchcdn.net/assets/amazon-ivs-wasmworker.min-*.js"
            ],
            types: ["main_frame", "script"]
        },
        ["blocking"]
    );
}