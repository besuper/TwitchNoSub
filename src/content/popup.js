const chat_toggle_box = document.getElementById("chat_toggle");

chrome.storage.local.get(['chat_toggle'], function (result) {
    chat_toggle_box.checked = result.chat_toggle;
});

chat_toggle_box.onchange = () => {
    chrome.storage.local.set({ "chat_toggle": chat_toggle_box.checked }, function () {
        console.log('Updated chat_toggle');
    });
}