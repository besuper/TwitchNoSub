let chat = undefined;

function addMessage(comment) {

    let username = comment.commenter.display_name;
    let user_color = comment.message.user_color;
    let message = comment.message.body;

    if (chat == undefined) {
        chat = getElementByXpath('//ul[contains(@class, "InjectLayout")]');
    }

    let injectLayout = document.createElement("li");
    injectLayout.classList.add("InjectLayout-sc-588ddc-0", "gDeqEh");

    injectLayout.innerHTML += `
        <div class="sc-AxjAm lmpqF vod-message vod-message--timestamp" data-test-selector="message-layout">
            <div class="sc-AxjAm fzeiWJ">
                <div class="sc-AxjAm eFjVnh">
                    <div class="sc-AxjAm dVmHJR">
                        <div class="sc-AxjAm cOQKWc video-chat__message"
                            data-test-selector="comment-message-selector">
                            <a data-test-selector="comment-author-selector" data-tt_content="tab_videos"
                                data-tt_medium="video-message-author"
                                class="ScCoreLink-udwpw5-0 FXIKh tw-link video-chat__message-author"
                                rel="noopener noreferrer" target="_blank" href="/`+ username + `"><span><span
                                        class="chat-author__display-name" data-a-target="chat-message-username"
                                        data-a-user="`+ username + `" data-test-selector="message-username"
                                        style="color: `+ user_color + `;">` + username + `</span></span></a>
                            <span class="InjectLayout-sc-588ddc-0 cQDIBe">: </span><span class=""><span
                                    class="text-fragment" data-a-target="chat-message-text">`+ message + `</span></span>
                        </div>
                    </div>
                    <div class="sc-AxjAm YOLYM video-chat__message-menu" data-test-selector="menu-options-wrapper">
                        <div class="sc-AxjAm tCXbA"></div>
                    </div>
                </div>
            </div>
        </div>`;

    chat.appendChild(injectLayout);

    if (getElementByXpath('//div[contains(@class, "unsynced")]') == undefined) {
        injectLayout.scrollIntoView();
    }

    if (chat.childElementCount >= 50) {
        let nodes = chat.childNodes;

        for (i = 0; i < 10; i++) {
            nodes[i].remove();
        }
    }

}

function fetchChat(offset, next) {

    let url = "https://api.twitch.tv/v5/videos/" + window.location.toString().split("/").pop();

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