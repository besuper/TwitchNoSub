function injectScript(src) {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL(src);
    s.onload = () => s.remove();
    (document.head || document.documentElement).append(s);
}

localStorage.setItem("tns_internal_patch_url", chrome.runtime.getURL("src/patch_amazonworker.js"));

injectScript("src/app.js");