window.addEventListener("load", function load(event){
    window.removeEventListener("load", load, false); //remove listener, no longer needed
    myExtension.init();
},false);

alert("test");

var myExtension = {
    init: function() {
        alert("test");
        var appcontent = document.getElementById("appcontent");   // browser
        if(appcontent){
            appcontent.addEventListener("DOMContentLoaded", myExtension.onPageLoad, true);
        }
        var messagepane = document.getElementById("messagepane"); // mail
        if(messagepane){
            messagepane.addEventListener("load", function(event) { myExtension.onPageLoad(event); }, true);
        }
    },

    onPageLoad: function(aEvent) {
        var doc = aEvent.originalTarget; // doc is document that triggered "onload" event
        // do something with the loaded page.
        // doc.location is a Location object (see below for a link).
        // You can use it to make your code executed on certain pages only.
        if(doc.location.href.search("forum") > -1)
            alert("a forum page is loaded");

        // add event listener for page unload
        aEvent.originalTarget.defaultView.addEventListener("unload", function(event){ myExtension.onPageUnload(event); }, true);
    },

    onPageUnload: function(aEvent) {
        // do something
    }
};

var wa2 = {
    init: function() {
        alert("test");
        document.getElementById("post-Name").value="hogehoge";
    }
};

