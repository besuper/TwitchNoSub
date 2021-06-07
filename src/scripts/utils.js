function getElementByXpath(path) {
    return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

function checkUrl(url) {
    return $.ajax({
        url: url,
        type: 'GET',
        dataType: 'html',
        async: false,
        success: function (data, statut) {
            if (statut === "success") {
                return true;
            }
        }
    });
}

function getMeta(doc, metaName) {
    const metas = doc.getElementsByTagName('meta');

    for (let i = 0; i < metas.length; i++) {
        if (metas[i].getAttribute('name') === metaName) {
            return metas[i].getAttribute('content');
        }
    }

    return '';
}

function toTimestamp(strDate) {
    var datum = Date.parse(strDate);
    return datum / 1000;
}