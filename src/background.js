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
                    url: chrome.runtime.getURL("src/amazon-ivs-wasmworker.min.js")
                }
            },
            'condition': {
                'urlFilter': 'https://static.twitchcdn.net/assets/amazon-ivs-wasmworker.min-*.js',
            }
        },
        {
            'id': 1002,
            'priority': 1,
            'action': {
                'type': 'redirect',
                'redirect': {
                    url: chrome.runtime.getURL("src/amazon-ivs-wasmworker.min.wasm")
                }
            },
            'condition': {
                'urlFilter': 'https://static.twitchcdn.net/assets/amazon-ivs-wasmworker.min-*.wasm',
            }
        }],
        removeRuleIds: [1001, 1002]
    })
} else {
    // Support firefox here
    browser.webRequest.onBeforeRequest.addListener(
        function (details) {
            return { redirectUrl: browser.runtime.getURL("src/patched-amazon.js") };
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