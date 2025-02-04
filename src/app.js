// From vaft script (https://github.com/pixeltris/TwitchAdSolutions/blob/master/vaft/vaft.user.js#L299)
function getWasmWorkerJs(twitchBlobUrl) {
    var req = new XMLHttpRequest();
    req.open('GET', twitchBlobUrl, false);
    req.overrideMimeType("text/javascript");
    req.send();
    return req.responseText;
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