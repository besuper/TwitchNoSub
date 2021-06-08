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

function toTimestamp(strDate) {
    var datum = Date.parse(strDate);
    return datum / 1000;
}