let chat = undefined;

function addMessage(comment) {
    if (chat == undefined || !chat.length) {
        chat = document.querySelector("ul[class*='InjectLayout']");
    }

    if (comment == undefined) {
        return;
    }

    if (comment.message == undefined) {
        return;
    }

    if (comment.message.fragments == undefined) {
        return;
    }

    let username = comment.commenter.display_name;
    let user_color = comment.message.user_color;
    let fragments_element = "";

    comment.message.fragments.forEach(fragment => {
        if (fragment.emoticon == undefined) {
            //No emoticons, text fragment
            fragments_element += `<span class="text-fragment" data-a-target="chat-message-text">${fragment.text}</span>`;
        } else {
            let url = `https://static-cdn.jtvnw.net/emoticons/v2/${fragment.emoticon.emoticon_id}`;

            fragments_element += `
            <div class="InjectLayout-sc-588ddc-0 emoticon">
                <span data-a-target="emote-name" aria-describedby="${comment._id}">
                    <div class="Layout-sc-nxg1ff-0 emoticon-1 chat-image__container">
                        <img alt="${fragment.text}" class="chat-image chat-line__message--emote" src="${url}/default/dark/1.0" srcset="${url}/default/dark/1.0 1x,${url}/default/dark/2.0 2x,${url}/dark/3.0 4x">
                    </div>
                </span>
            </div>
            `;
        }
    });

    const li_element = document.createElement("li");
    li_element.className = "InjectLayout-sc-588ddc-0 chat-element";

    li_element.innerHTML = `
        <div class="Layout-sc-nxg1ff-0 custom-chat vod-message vod-message--timestamp" data-test-selector="message-layout">
            <div class="Layout-sc-nxg1ff-0 separator custom-chat-1 vod-message__header" data-test-selector="message-timestamp">
            
                <div class="Layout-sc-nxg1ff-0 hdbMZz">
                    <div aria-describedby="${comment._id}" class="Layout-sc-nxg1ff-0 ScAttachedTooltipWrapper-sc-v8mg6d-0 custom-chat-2">
                        <button class="ScInteractableBase-sc-awmohi-0 ScInteractableDefault-sc-awmohi-1 isiepY hZWZXL tw-interactable">
                            <div class="Layout-sc-nxg1ff-0 csWXEI">
                                <p class="CoreText-sc-cpl358-0 hGjPna">${parseSeconds(comment.content_offset_seconds)}</p>
                            </div>
                        </button>
                        <div class="ScAttachedTooltip-sc-v8mg6d-1 fpvEsi tw-tooltip" data-a-target="tw-tooltip-label" role="tooltip" id="${comment._id}" direction="top"></div>
                    </div>
                </div>

            </div>
            <div class="Layout-sc-nxg1ff-0 chat-element">
                <div class="Layout-sc-nxg1ff-0 custom-chat-3">
                    <div class="Layout-sc-nxg1ff-0 aleoz">
                        <span></span>

                        <a data-test-selector="comment-author-selector"
                            data-tt_content="tab_videos" data-tt_medium="video-message-author"
                            class="ScCoreLink-sc-udwpw5-0 username tw-link video-chat__message-author"
                            rel="noopener noreferrer" target="_blank" href="/${username}">

                            <span>
                                <span class="chat-author__display-name" data-a-target="chat-message-username" 
                                    data-a-user="${username}" data-test-selector="message-username"
                                    style="color: ${user_color};">${username}</span>
                            </span>
                        </a>

                        <div class="Layout-sc-nxg1ff-0 inline video-chat__message" data-test-selector="comment-message-selector">
                            <span class="InjectLayout-sc-588ddc-0 separator">:</span>
                            <span class="">
                                ${fragments_element}
                            </span>
                        </div>

                    </div>

                    <div class="Layout-sc-nxg1ff-0 kxZWcq video-chat__message-menu"
                        data-test-selector="menu-options-wrapper">
                        <div class="Layout-sc-nxg1ff-0 dbbxYG"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    chat.appendChild(li_element);

    if (!document.querySelector("div[class*='unsynced']")) {
        chat.lastElementChild.scrollIntoView();
    }

    if (chat.childElementCount >= 50) {
        let nodes = chat.childNodes;

        for (i = 0; i < 10; i++) {
            nodes[i].remove();
        }
    }

}

async function fetchChat(vod_id, offset, next) {
    let url = "https://api.twitch.tv/v5/videos/" + vod_id;

    if (next == undefined) {
        url += "/comments?content_offset_seconds=" + offset;
    } else {
        url += "/comments?cursor=" + next;
    }

    return fetch(url, {
        method: 'GET',
        headers: {
            "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
            "Accept": "application/vnd.twitchtv.v5+json"
        }
    }).then(repsonse => repsonse.json());
}

function parseSeconds(sec_num) {
    var hours = Math.floor(sec_num / 3600);
    var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
    var seconds = Math.round(sec_num - (hours * 3600) - (minutes * 60));

    if (hours < 10) { hours = "0" + hours; }
    if (minutes < 10) { minutes = "0" + minutes; }
    if (seconds < 10) { seconds = "0" + seconds; }
    return hours + ':' + minutes + ':' + seconds;
}
