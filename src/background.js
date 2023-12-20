// Make background wake up
chrome.webNavigation.onBeforeNavigate.addListener(function () {

}, {
    url: [{ hostContains: "twitch" }]
});

var isChrome = chrome.declarativeNetRequest != undefined;
var cdnLink = '';

if (isChrome) {
    // Fix brave extensions
    chrome.runtime.onStartup.addListener(() => {
        chrome.runtime.reload();
    });
}

// Patching amazon service worker
const app = () => {
    if (isChrome) {
        // declarativeNetRequest only available on chrome
        chrome.declarativeNetRequest.updateDynamicRules({
            addRules: [{
                'id': 1001,
                'priority': 1,
                'action': {
                    'type': 'redirect',
                    'redirect': { url: cdnLink }
                },
                'condition': { urlFilter: 'https://static.twitchcdn.net/assets/amazon-ivs-wasmworker.min-*.js' }
            }],
            removeRuleIds: [1001]
        });
    } else {
        // Support firefox here
        browser.webRequest.onBeforeRequest.addListener(() => {
            return { redirectUrl: cdnLink };
        }, {
            urls: ["https://static.twitchcdn.net/assets/amazon-ivs-wasmworker.min-*.js"],
            types: ["main_frame", "script"]
        }, ["blocking"]);
    }

};

(async () => {
    // Fetching current CDN link
    try {
        const response = await fetch("https://api.github.com/repos/besuper/TwitchNoSub/commits");
        const content = await response.json();

        var latestCommit = content[0].sha;

        console.log("Lastest commit sha: " + latestCommit);

        cdnLink = `https://cdn.jsdelivr.net/gh/besuper/TwitchNoSub@${latestCommit}/src/amazon-ivs-worker.min.js`;
    } catch (e) {
        console.log(e);

        cdnLink = `https://cdn.jsdelivr.net/gh/besuper/TwitchNoSub/src/amazon-ivs-worker.min.js`;
    }

    console.log("CDN link : " + cdnLink);

    app();
})();