Components.utils.import("resource://wikiassist/common.js");
Components.utils.import("resource://wikiassist/messageCount.js");

// ロード時に初期化関数をコール
window.addEventListener("load", function load(event){
    window.removeEventListener("load", load, false); //remove listener, no longer needed
    WikiAssistChrome.BrowserOverlay.init();
},false);

/**
 * WikiAssistChrome namespace.
 */
if ("undefined" == typeof(WikiAssistChrome)) {
    var WikiAssistChrome = {};
};

//var URL = 'http://da603-2/cgi-bin/herodb/herodb0.cgi?table=topic&view=M&recpoint=0'
var global_flag = { "diary" : false };

function GetMode() {
    return global_flag;
}

WikiAssistChrome.BrowserOverlay = {
    prefs: null,

    init : function() {
        console.log("wa2: init browser overlay");

        // preferenceの設定ロード
        this.prefs = Components.classes["@mozilla.org/preferences-service;1"]
            .getService(Components.interfaces.nsIPrefService)
            .getBranch("extensions.wa2.");

        this.prefs.addObserver("", this, false);

        // accesskey 変更したいけど、よくわからん
        //console.log(document.getElementById("contentAreaContextMenu"));

        // accesskey設定
        document.getElementById("id_wa2").setAttribute("accesskey",
            this.prefs.getCharPref("main_access_key") );
        document.getElementById("id_db_post").setAttribute("accesskey",
            this.prefs.getCharPref("db_access_key") );
        document.getElementById("id_wiki_post").setAttribute("accesskey",
            this.prefs.getCharPref("wiki_access_key") );

    },

    post_to_db : function(aEvent) {
        var url   = document.location.href;
        var title = document.title;
        var select = window.getSelection().toString();

        // menuから起動したらwindowがchromeになるので、
        // URLとかdocumentとかをちゃんと取得できない
        // といいつつ、contentはchromeじゃないという。
        //
//        console.log(window.top.getBrowser().selectedBrowser.contentWindow.location.href);
//        console.log(window.content.location.href);
//        console.log(window.content.document.getSelection().toString());

        window.open("chrome://wikiassist/content/resttestUI.xul",
                "resttestUI",
                "chrome=yes,centerscreen=yes,resizable=yes,height=739,width=600");

    },

    post_to_wiki : function(aEvent, flag)
    {
        //console.log(flag);
        global_flag["diary"] = flag;
        window.open("chrome://wikiassist/content/wikipost.xul",
                "wikipost",
                "chrome=yes,centerscreen=yes,resizable=yes,height=739,width=600");
    }

};
