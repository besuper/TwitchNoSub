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
            'id': 1002,
            'priority': 1,
            'action': {
                'type': "modifyHeaders",
                'responseHeaders': [
                    {
                        'operation': "set",
                        'header': 'content-type',
                        'value': 'application/javascript',
                    }
                ]
            },
            'condition': {
                'requestDomains': ['raw.githubusercontent.com']
            }
        },
        {
            'id': 1001,
            'priority': 1,
            'action': {
                'type': 'redirect',
                'redirect': {
                    url: "https://raw.githubusercontent.com/besuper/TwitchNoSub/master/src/amazon-ivs-worker.min.js"
                }
            },
            'condition': {
                'urlFilter': 'https://static.twitchcdn.net/assets/amazon-ivs-wasmworker.min-*.js',
            }
        }],
        removeRuleIds: [1001, 1002]
    })
} else {
    // Support firefox here
    browser.webRequest.onBeforeRequest.addListener((details) => {
        return { redirectUrl: "https://raw.githubusercontent.com/besuper/TwitchNoSub/master/src/amazon-ivs-worker.min.js" };
    },
        {
            urls: ["https://static.twitchcdn.net/assets/amazon-ivs-wasmworker.min-*.js"],
            types: ["main_frame", "script"]
        },
        ["blocking"]
    );

    browser.webRequest.onHeadersReceived.addListener((details) => {
        details.responseHeaders.push({
            name: 'content-type',
            value: 'application/javascript'
        });

        return { responseHeaders: details.responseHeaders };
    },
        { urls: ["https://raw.githubusercontent.com/besuper/TwitchNoSub/master/src/amazon-ivs-worker.min.js"] },
        ["blocking", "responseHeaders"]
    );
}