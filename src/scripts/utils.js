function getElementByXpath(path) {
    return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

function getElementsByXPath(xpath, parent) {
    let results = [];
    let query = document.evaluate(xpath, parent || document,
        null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
    for (let i = 0, length = query.snapshotLength; i < length; ++i) {
        results.push(query.snapshotItem(i));
    }
    return results;
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

function toTimestamp(strDate) {
    var datum = Date.parse(strDate);
    return datum / 1000;
}