function injectScript(src, dataset = {}) {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL(src);
    Object.assign(s.dataset, dataset);
    s.onload = () => s.remove();
    (document.head || document.documentElement).append(s);
}

injectScript("src/app.js", { tnsPatchUrl: chrome.runtime.getURL("src/patch_amazonworker.js") });
