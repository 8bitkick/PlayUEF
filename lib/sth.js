// Accesses STH archive.
// https://github.com/mattgodbolt/jsbeeb/blob/master/sth.js
//

function StairwayToHell(onStart, onCat, onError, tape) {
        var self = this;
        var baseUrl = document.location.protocol + "//www.stairwaytohell.com/bbc/archive/tapeimages/";
        var catalogUrl = "reclist.php?sort=name&filter=.zip";
        var catalog = [];

        self.populate = function () {
            onStart();
            if (catalog.length === 0) {
                var request = new XMLHttpRequest();
                request.open("GET", baseUrl + catalogUrl, true);
                request.onerror = function () {
                    if (onError) onError();
                };
                request.onload = function () {
                    var doc = $($.parseHTML(this.responseText, null, false));
                    doc.find("tr td:nth-child(3) a").each(function (_, link) {
                        var href = $(link).attr("href");
                        if (href.indexOf(".zip") > 0) catalog.push(href);
                    });
                    if (onCat) onCat(catalog);
                };
                request.send();
            } else {
                if (onCat) onCat(catalog);
            }
        };

        self.catalog = function () {
            return catalog;
        };

        self.fetch = function (file) {
            var name = baseUrl + file;
            console.log("Loading ZIP from " + name);
            return utils.loadData(name).then(function (data) {
                return utils.unzipDiscImage(data).data;
            });
        };
    };
