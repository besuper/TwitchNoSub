var watch_list = {};
const watch_element = document.getElementById("watch");

function delete_vod(id) {
    chrome.runtime.sendMessage({ type: "delete", id: id }, function (response) {
        if (response.success) {
            delete watch_list[id]; // Remove the element locally

            document.getElementById(id).remove();
            document.getElementById(id + "-hr").remove();
        }
    });
}

setTimeout(() => {
    // Fetch watching list from background
    chrome.runtime.sendMessage({ type: "fetch" }, function (response) {
        if (response.success) {
            watch_list = response.data;

            console.log(watch_list);
            console.log("Len : " + watch_list.length);

            for (const [id, vod] of Object.entries(watch_list)) {
                const title = vod["title"];
                const formatted_title = title.length > 38 ? title.substring(0, 38) + "..." : title;

                const start_time = toHHMMSS(vod["time"]);
                const end_time = toHHMMSS(vod["max_time"]);

                const element = `
            <li class="watch_vod" id="${id}">
                <div class="information">
                    <div class="title" title="${title}">${formatted_title}</div>
                    <div class="meta">
                        <div class="channel_name">Channel: ${vod["channel"]}</div>
                    </div>
                </div>
                <div class="utilities">
                    <div class="btn">
                        <button title="Continue watching">
                            <a href="https://www.twitch.tv/videos/${vod["link"]}" target="_blank">Watch</a>
                        </button>
                        <button title="Delete VOD" id="delete_btn_${id}">X</button>
                    </div>
        
                    <div class="duration">${start_time} / ${end_time}</div>
                </div>
            </li>
            <hr id="${id}-hr">
            `;

                watch_element.innerHTML += element;

                document.getElementById("delete_btn_" + id).onclick = () => {
                    delete_vod(id);
                };
            }
        }
    });
}, 300);

// Format time and max_time
function toHHMMSS(sec_num) {
    const date = new Date(0);
    date.setSeconds(sec_num);
    const hours = date.getUTCHours() < 10 ? "0" + date.getUTCHours() : date.getUTCHours();
    const minutes = date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes();
    const seconds = date.getSeconds() < 10 ? "0" + date.getUTCHours() : date.getSeconds();
    return hours + ":" + minutes + ":" + seconds;
}