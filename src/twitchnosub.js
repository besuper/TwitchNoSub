function injectScript(src) {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL(src);
    s.onload = () => s.remove();
    (document.head || document.documentElement).append(s);
}

localStorage.setItem("tns_internal_patch_url", chrome.runtime.getURL("src/patch_amazonworker.js"));

const extensionType = window.chrome !== undefined ? "chrome" : "firefox";

console.log("[TNS] Found extension type : " + extensionType);

injectScript(`src/${extensionType}/app.js`);
injectScript("src/app.js");