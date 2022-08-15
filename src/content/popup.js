const settings = {
    user: {
        chat: {
            enabled: false,
        }
    }
};

const chat_toggle_box = document.getElementById("chat_toggle");

chrome.storage.local.get(['user_settings'], function (result) {
    settings.user = JSON.parse(result.user_settings);
    chat_toggle_box.checked = settings.user.chat.enabled;
});

chat_toggle_box.onchange = () => {
    chrome.storage.local.set({ "user_settings": JSON.stringify(settings.user) }, function () {
        console.log('Updated user settings');
    });
}