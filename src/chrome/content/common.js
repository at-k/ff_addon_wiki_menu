// 投稿先URL
var URL = 'http://da603-2/cgi-bin/herodb/herodb0.cgi?table=topic&view=M&recpoint=0';
var WIKI_URL = 'http://web8bu.sdl.hitachi.co.jp/pd6u/wiki/index.php';
var NewsPage = 'journal';

var today_format = function() {
    var fmt = {};
    var today = new Date();
    var month = today.getMonth() + 1;
    var date = today.getDate();
    if(month < 10) {
        month = "0" + month;
    }
    if(date < 10) {
        date = "0" + date;
    }
    fmt.y = today.getFullYear();
    fmt.m = month;
    fmt.d = date;

    return fmt;
};

function wiki_agent(url_i, page_i, msg_i, callback_i) {
    var url = url_i;
    var page = page_i;
    var msg = msg_i;
    var callback = callback_i;

    var post_form = function(e) {
        console.log("wa2: start posting data to wiki");
        var digest = "";
        var ticket = "";
        var original = "";
        var encode_hint = "";
        var i = 0;

        var xmlDoc = e.target.responseXML;

        if(!xmlDoc) {
            console.log("wa2-error: xmlDoc not found");
            return;
        }

        var input_tag = xmlDoc.getElementsByTagName("input");
        for( i = 0; i < input_tag.length; i++){
            if( input_tag[i].name == "digest" ) {
                digest = input_tag[i].value;
            }
            else if( input_tag[i].name == "ticket" ) {
                ticket = input_tag[i].value;
            }
            else if( input_tag[i].name == "page" ) {
                page = input_tag[i].value;
            }
            else if( input_tag[i].name == "encode_hint" ) {
                encode_hint = input_tag[i].value;
            }
        }

        original = xmlDoc.getElementById("msg").value;
        msg = original + msg;
        msg = encodeURIComponent(msg);

        var post_data = "";
        post_data="encode_hint=" + encode_hint + "&cmd=edit&page=" + page +
            "&digest=" + digest + "&ticket=" + ticket +
            "&id=&msg=" + msg + "&original=" + original + "&write=";

        // post
        var xhr = new XMLHttpRequest();
        console.log(url);
        console.log(msg);
        //console.log(post_data);
        xhr.open("POST", url, true);
        xhr.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
        xhr.setRequestHeader("Content-Length", post_data.length);

        xhr.onload = callback;
        xhr.send(post_data);
    }

    return {
        // wikiへの投稿は、まずget、その後にpost
        submit: function() {
            var xhr = new XMLHttpRequest();
            var fulurl = "";

            fulurl = url + "?cmd=edit&page=" + page;
            console.log(fulurl);
            xhr.open("GET", fulurl, true);
            xhr.responseType = "document";
            xhr.onload = post_form;
            xhr.send();
        }
    }
}

