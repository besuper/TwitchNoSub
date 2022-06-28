let chat = undefined;

function addMessage(comment) {
    let username = comment.commenter.display_name;
    let user_color = comment.message.user_color;
    let message = comment.message.body;

    if (chat == undefined || !chat.length) {
        chat = $("ul[class*='InjectLayout']");
    }

    chat.append(`
    <li class="InjectLayout-sc-588ddc-0 frwpku">
        <div class="Layout-sc-nxg1ff-0 custom-chat vod-message vod-message--timestamp" data-test-selector="message-layout">
            <div class="Layout-sc-nxg1ff-0 custom-chat-1 vod-message__header" data-test-selector="message-timestamp">
            
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
            <div class="Layout-sc-nxg1ff-0 fQeqDH">
                <div class="Layout-sc-nxg1ff-0 liFCyD">
                    <div class="Layout-sc-nxg1ff-0 aleoz">
                        <span></span>

                        <a data-test-selector="comment-author-selector"
                            data-tt_content="tab_videos" data-tt_medium="video-message-author"
                            class="ScCoreLink-sc-udwpw5-0 ktfxqP tw-link video-chat__message-author"
                             rel="noopener noreferrer" target="_blank" href="/${username}">

                            <span>
                                 <span class="chat-author__display-name" data-a-target="chat-message-username" 
                                    data-a-user="${username}" data-test-selector="message-username"
                                    style="color: ${user_color};">${username}</span>
                            </span>
                        </a>

                        <div class="Layout-sc-nxg1ff-0 duJXWu video-chat__message"
                            data-test-selector="comment-message-selector">

                            <span class="InjectLayout-sc-588ddc-0 eMvMmJ">:</span>
                            <span class="">
                                <span class="text-fragment" data-a-target="chat-message-text">${message}</span>
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
    </li>
    
    `);

    if (!$("div[class*='unsynced']").length) {
        chat[0].lastElementChild.scrollIntoView();
    }

    if (chat[0].childElementCount >= 50) {
        let nodes = chat[0].childNodes;

        for (i = 0; i < 10; i++) {
            nodes[i].remove();
        }
    }

}

function fetchChat(vod_id, offset, next) {
    let url = "https://api.twitch.tv/v5/videos/" + vod_id;

    if (next == undefined) {
        url += "/comments?content_offset_seconds=" + offset;
    } else {
        url += "/comments?cursor=" + next;
    }

    console.log(url);

    return $.ajax({
        url: url,
        headers: {
            "Client-Id": "kimne78kx3ncx6brgo4mv6wki5h1ko",
            "Accept": "application/vnd.twitchtv.v5+json"
        },
        type: 'GET',
        dataType: 'html'
    });

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
