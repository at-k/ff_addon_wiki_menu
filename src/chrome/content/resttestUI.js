// ロード時に初期化関数をコール
window.addEventListener("load", function load(event){
    window.removeEventListener("load", load, false); //remove listener, no longer needed
    wa2.init();
},false);

var wa2 = {
    prefs: null,

    init: function() {
        // preferenceの設定ロード
        this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
            .getService(Components.interfaces.nsIPrefService)
            .getBranch("extensions.wa2.");

        this.prefs.addObserver("", this, false);

        document.getElementById("post-Name").value =
            decodeURIComponent( escape(this.prefs.getCharPref("default.name") ));

        if( this.prefs.getBoolPref("wiki.enabled") == true) {
            document.getElementById("enable-Wiki").checked = true;
            this.on_checkbox_change();
        }

        // 親ウィンドウの基本情報取得・設定
        //document.getElementById("post-URL").value = window.opener.top.getBrowser().selectedBrowser.contentWindow.location.href; // こっちでも良い。
        document.getElementById("post-URL").value = window.opener.content.location.href;
        document.getElementById("post-Title").value = window.opener.content.document.title;
        document.getElementById("post-Memo").value = window.opener.content.document.getSelection().toString();

        var today = today_format();
        document.getElementById("post-Date").value = today.y + "/" + today.m + "/" + today.d;

        return;
    },

    // filepickerを使ったfile選択論理
    // input type=fileで代用したので、今は未使用
    selectFile: function() {
        var filePicker = Components.classes["@mozilla.org/filepicker;1"]
            .createInstance(Components.interfaces.nsIFilePicker);

        filePicker.init(window, "Choose a file.", filePicker.modeOpen);

        if (filePicker.show() == filePicker.returnOK) {
            var fileField = document.getElementById("myFileField");
            fileField.file = filePicker.file;
        }
        return;
    },

    on_checkbox_change: function() {
        console.log("wa2: checkbox change");

        var enable_wiki = document.getElementById("enable-Wiki").checked;

        if( enable_wiki ) {
            console.log("wa2: activate wiki");
            document.getElementById("jump-Wiki").setAttribute("disabled",false);
            document.getElementById("edit-Wiki").setAttribute("disabled",false);
            document.getElementById("wiki-URL").setAttribute("disabled",false);
            document.getElementById("wiki-Page").setAttribute("disabled",false);
            document.getElementById("wiki-body").removeAttribute("disabled");
            //document.getElementById("wiki-body").setAttribute("editable",true);

        }
        else {
            console.log("wa2: inactivate wiki");
            document.getElementById("jump-Wiki").setAttribute("disabled",true);
            document.getElementById("edit-Wiki").setAttribute("disabled",true);
            document.getElementById("wiki-URL").setAttribute("disabled",true);
            document.getElementById("wiki-Page").setAttribute("disabled",true);
            document.getElementById("wiki-body").setAttribute("disabled",true);
            //document.getElementById("wiki-body").setAttribute("editable",false);
        }

        this.update_wiki_form();
    },

    submit: function() {
        console.log("wa2: start submit");

        var conv = Components
            .classes['@mozilla.org/intl/scriptableunicodeconverter']
            .getService(Components.interfaces.nsIScriptableUnicodeConverter);
        conv.charset = 'Shift_JIS';

        var fd = this.extract_form_to_array();
        var boundary = "-----------hoge";

        var senddata = "";
        var form_str = "";
        for (name in fd) {
            form_str = conv.ConvertFromUnicode(fd[name]);
            form_str = form_str.replace(/\n/g,"\r\n");
            senddata += "--"+boundary+"\r\n"+
                "Content-Disposition: form-data; name=\""+name+"\"\r\n\r\n"+
                form_str +"\r\n";
        }

        if ( document.getElementById("input_file").value ) {
            var file = document.getElementById("input_file").files[0];
            senddata += "--"+boundary+"\r\n"+
                "Content-Disposition: form-data; name=\"ATACHED\"; "+
                "filename=\""+file.name+"\"\r\n"+
                "Content-Type: "+file.type+"\r\n\r\n";

            var reader = new FileReader();
            reader.onload = this.file_load_handler(senddata, boundary);

            reader.readAsBinaryString(file);
        } else {
            senddata += "--"+boundary+"--\r\n"; // terminate data format

            this.post_data(senddata, boundary);
        }

        return;
    },

    file_load_handler: function(senddata, boundary) {
        var post_func = this.post_data;

        return function(e) {
            senddata += e.target.result;
            senddata += "\r\n";

            senddata += "--"+boundary+"--\r\n"; // terminate data format
            post_func(senddata, boundary);
        }
    },

    post_data: function(senddata, boundary) {
        var xhr = new XMLHttpRequest();

        xhr.open('POST', URL, true);
        xhr.responseType = "document";
        xhr.setRequestHeader("content-type",
                "multipart/form-data; boundary="+boundary);

        var wiki_func = this.submit_to_wiki;

        xhr.onload = function(e) {
//            console.log(xhr.response);
//            console.log(xhr.response.body.textContent.length);

            var msg = xhr.response.body.textContent;

            if( msg.length > 2000 ) {
                // 応答サイズが2000以上だと多分正常
                console.log("post successfully");
                if( document.getElementById("enable-Wiki").checked )
                    wiki_func();
                else
                    window.close();
            }else {
                msg = msg.replace(/\[.*\]/g,"");
                window.alert(msg);
            }
        };

        xhr.sendAsBinary(senddata);

    },

    // wikipost.jsを利用
    submit_to_wiki: function() {
        console.log("wa2:post to wiki start");
        var url, page, msg, jflag;

        url = document.getElementById("wiki-URL").value;
        page = document.getElementById("wiki-Page").value;
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
    },

    // file以外抽出
    extract_form_to_array: function() {
        var fd = {};

        var postdate = document.getElementById("post-Date").value.split("/");
        if( postdate[1] < 10 && postdate[1].length == 1) postdate[1] = "0" + postdate[1];
        if( postdate[2] < 10 && postdate[2].length == 1) postdate[2] = "0" + postdate[2];

        var today = today_format();

        fd["DATE1"] = postdate[0];
        fd["DATE2"] = postdate[1];
        fd["DATE3"] = postdate[2];
        fd["LASTMODIFIED1"] = today.y;
        fd["LASTMODIFIED2"] = today.m;
        fd["LASTMODIFIED3"] = today.d;

        fd["TITLE"] = document.getElementById("post-Title").value;
        fd["COMPANY"] = document.getElementById("post-Vendor").value;
        fd["REFERENCE"] = document.getElementById("post-URL").value;
        fd["TYPE"] = document.getElementById("post-Cat").value;
        fd["MEMO"] = document.getElementById("post-Memo").value;
        fd["USER"] =  document.getElementById("post-Name").value;

        if( document.getElementById("enable-Wiki").checked ) {
            fd["WIKI"] = document.getElementById("wiki-URL").value + "?" +
                document.getElementById("wiki-Page").value;
        }else {
            fd["WIKI"] = "";
        }

        fd["PASS"] = "";
        fd["KEY"] = "";
        fd["MPASS"] = "";
        fd["SEARCH"] = "";
        fd["RND1"] = "";
        fd["RND2"] = "";
        fd["MODE"] = "insert";
        fd["SUBMIT"]= "新規登録";

        return fd;
    },

    array_to_formdata: function(array) {
        var fd = new FormData();

        for(key in array) {
            fd.append(key, array[key]);
        }

        return fd;
    },

    update_wiki_form: function() {
        if( document.getElementById("edit-Wiki").checked )
            return;

        // page
        var postdate = document.getElementById("post-Date").value.split("/");
        if( postdate[1] < 10 && postdate[1].length == 1) postdate[1] = "0" + postdate[1];
        if( postdate[2] < 10 && postdate[2].length == 1) postdate[2] = "0" + postdate[2];

        var wiki_page = NewsPage + "%2F" +
            document.getElementById("post-Vendor").value + "%2F" +
            postdate[0] + "-" + postdate[1] + "-" + postdate[2];

        document.getElementById("wiki-URL").value = WIKI_URL;
        document.getElementById("wiki-Page").value = wiki_page;

        // body
        var wiki_body = "- [["+document.getElementById("post-Title").value+">" +
            document.getElementById("post-URL").value + "]]\n";
        wiki_body += ("| 投稿者 |" + document.getElementById("post-Name").value + "|\n" +
                "| 企業名 |" + document.getElementById("post-Vendor").value + "|\n" +
                "| 分類 |" + document.getElementById("post-Cat").value + "|\n" +
                "| メモ |" + document.getElementById("post-Memo").value  + "|\n"
                 );

        document.getElementById("wiki-body").value = wiki_body;
    },

    // FormDataを使う版。
    // xhrが転送データをutf8に変換してしまうが、受け手側がsjisで読んでしまうので文字化け。
    // どうやってもxhrにutf8を諦めさせられないので別方法に変更。
    submit__: function() {
        // var form = document.getElementById("file_form");
        // var fd = new FormData(form);
        var array = this.extract_form_to_array();
        var fd = this.array_to_formdata(array);
        var xhr = new XMLHttpRequest();
        var conv = Components
            .classes['@mozilla.org/intl/scriptableunicodeconverter']
            .getService(Components.interfaces.nsIScriptableUnicodeConverter);

        if( document.getElementById("input_file").value ) {
            var file = document.getElementById("input_file").files[0];
            fd.append("ATACHED", file, file.name);
        }
        else {
            fd.append("ATACHED", "");
        }

        if( document.getElementById("enable-Wiki").value ) {
//            var wiki_page = this.submit_to_wiki_main();
//            fd.append("WIKI", wiki_page);
        }
        else {
            fd.append("WIKI", "");
        }

        xhr.open('POST', URL, true);
        xhr.responseType = "document";
//        xhr.setRequestHeader('Content-type', 'multipart/form-data, Boundary: "-------hogehogehoge"; charset=UTF-8');
        xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');

        // 結果刈り取り
        xhr.onload = function(e) {
            var msg = xhr.response.body.textContent;

            if( msg.length > 2000 ) {
                // 応答サイズが2000以上だと多分正常
                console.log("post successfully");
                window.close();
            }else {
                msg = msg.replace(/\[.*\]/g,"");
                window.alert(msg);
            }
        };

        xhr.send(fd);

        return;
    }
};

