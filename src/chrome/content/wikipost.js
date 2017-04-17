// ロード時に初期化関数をコール
window.addEventListener("load", function load(event){
    window.removeEventListener("load", load, false); //remove listener, no longer needed
    wa2_wiki.init();
},false);

var wa2_wiki = {
    prefs: null,

    init: function() {
        // 設定オブジェクト作成
        this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
            .getService(Components.interfaces.nsIPrefService)
            .getBranch("extensions.wa2.");

        this.prefs.addObserver("", this, false);

        var post_page = "";
        var body = "";
        var sel_txt = "";

        var date = today_format();

        sel_txt = window.opener.content.document.getSelection().toString();

        // 初期値作成
        post_page = this.prefs.getCharPref("wiki.mypage") + "%2F" + date.y
            + "-" + date.m + "-" + date.d;

        var flag = window.opener.GetMode();
        if( flag["diary"] == false) {
            body = "- [[" + window.opener.content.document.title + ">" + window.opener.content.location.href + "]]";
        }
        else {
            body = "- ";
        }

        if (sel_txt ) {
            var text = sel_txt.replace("\r\n","\n");
            text = text.replace(/^$/g, "");
            text = ">" + text;
            text = text.replace(/\n/g, "\n>");
            text += "\n<";

            body += ("\n" + text + "\n");
        }

        document.getElementById("post-Wiki").value = this.prefs.getCharPref("wiki.server");
        document.getElementById("post-Page").value = post_page;
        document.getElementById("wiki-body").value = body;
    },

    submit: function() {
        var url, page, msg, jflag;
        url = document.getElementById("post-Wiki").value;
        page = document.getElementById("post-Page").value;
        msg = document.getElementById("wiki-body").value;

        jflag = document.getElementById("jump-Wiki").checked;

        var wa = new wiki_agent(url, page, msg, function(e) {
            console.log("wa2: post finished");
            if(jflag) {
                // 対象ページへ移動
                var fulurl = url + "?" + page;
                window.opener.open(fulurl);
            }

            window.close();
        });
        wa.submit();
    }
};

// テスト用（未使用）
var wiki_post_agent = {
    url: "",
    page: "",
    msg: "",
    callback: null,

    init: function(url, page, msg) {
        this.url = url;
        this.page = page;
        this.msg = msg;
    },

    post: function(callback) {
        this.callback = callback;
        var xhr = new XMLHttpRequest();
        var url = "";

        url = this.url + "?cmd=edit&page=" + this.page;
        console.log(url);
        xhr.open("GET", url, true);
        xhr.responseType = "document";
        xhr.onload = this.post_form;
        xhr.send();
    },

    post_form: function(e) {
        var msg = "";
        var page = "";
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
        msg = original + this.msg;
        msg = encodeURIComponent(msg);

        var post_data = "";
        post_data="encode_hint=" + encode_hint + "&cmd=edit&page=" + page +
            "&digest=" + digest + "&ticket=" + ticket +
            "&id=&msg=" + msg + "&original=" + original + "&write=";

        // post
        var xhr = new XMLHttpRequest();
        console.log(this.url);
        console.log(this.msg);
        //console.log(post_data);
        xhr.open("POST", this.url, true);
        xhr.setRequestHeader("Content-Type","application/x-www-form-urlencoded");
        xhr.setRequestHeader("Content-Length", post_data.length);

        xhr.onload = this.callback;
        xhr.send(post_data);
    }
};
