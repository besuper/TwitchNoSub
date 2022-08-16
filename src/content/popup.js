const settings = {
    user: {
        chat: {
            enabled: false,
        },
        thumbnail_preview: false,
    }
};

const toggles = document.querySelectorAll(".checkbox");

chrome.storage.local.get(['user_settings'], (result) => {
    console.log("Load!");
    console.log(result);

    settings.user = JSON.parse(result.user_settings);

    toggles.forEach(toggle => {
        let update = toggle.getAttribute("data-update");
        if (update.includes(".")) {
            let split = update.split(".");
            // TODO: change this
            toggle.checked = settings.user[split[0]][split[1]];
        } else {
            toggle.checked = settings.user[update];
        }
    });
});

toggles.forEach(toggle => {
    toggle.onchange = () => {
        let update = toggle.getAttribute("data-update");
        if (update.includes(".")) {
            let split = update.split(".");
            // TODO: change this
            settings.user[split[0]][split[1]] = toggle.checked;
        } else {
            settings.user[update] = toggle.checked;
        }

        const data = JSON.stringify(settings.user);

        chrome.storage.local.set({ "user_settings": data }, () => {
            console.log('Updated user settings');
        });
    }
});