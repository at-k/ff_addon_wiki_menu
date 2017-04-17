 
if(!net) { var net = {}; }
if(!net.pyrocufflink) { net.pyrocufflink = {}; }
 
net.pyrocufflink.resttest = {
 xhr: undefined,
 
 http_headers: {
  'Content-Type': [
   'application/x-www-form-urlencoded',
   'application/xml',
   'application/json',
   'text/xml',
   'text/plain'
  ],
  'Accept': [
   'application/xml',
   'application/json',
   'application/xhtml+xml',
   'text/html',
   'text/plain',
  ],
  'X-Requested-With': [
   'XMLHttpRequest'
  ]
 },
 
 switchHTTPMethod: function() {
  switch(document.getElementById("request-method").value) {
   case "GET":
   case "DELETE":
   case "HEAD":
   case "OPTIONS":
    document.getElementById("representation").disabled = true;
    break;
   default:
    document.getElementById("representation").disabled = false;
    break;
   }
  },
 
 testREST: function() {
  var parser = document.createElementNS("http://www.w3.org/1999/xhtml", "a");
  parser.href = document.getElementById("rest-uri").value;
  var uri = parser.href;
  var method = document.getElementById("request-method").value;
  var representation = document.getElementById("representation").value;
  var header_grid = document.getElementById("header-grid");
 
  if(!parser.hostname) {
   alert("Invalid URI: " + uri);
  } else {
   document.getElementById("rest-uri").value = uri;
   button = document.getElementById("goButton");
   button.label = "Stop";
   button.onclick = net.pyrocufflink.resttest.stopTest;
    
   xhr = new XMLHttpRequest();
   xhr.onreadystatechange = function() {
    document.getElementById("loadProgress").value = xhr.readyState / 4 * 100;
    switch(xhr.readyState) {
     case 1:
      document.getElementById("response-body").value = "";
      document.getElementById("response-headers").value = "";
      document.getElementById("loadStatus").setAttribute("label","Opening " + uri + "...");
      document.getElementById("loadProgress").setAttribute("hidden","false");
      break;
     case 2:
      try {
       document.getElementById("response-headers").value = "HTTP/1.1 " + xhr.status + " " + xhr.statusText + "\n" + xhr.getAllResponseHeaders();
       }
      catch (e) {
       alert("Failed to connect to '" + uri + "'");
       }
      break;
     case 3:
      document.getElementById("response-body").value = xhr.responseText;
      break;
     case 4:
      document.getElementById("loadStatus").setAttribute("label","Done");
      document.getElementById("loadProgress").setAttribute("hidden","true");
      button.label = "Submit";
      button.onclick = net.pyrocufflink.resttest.testREST;
      break;
     }
    };
   xhr.open(method,uri,true);
   var rowCollection = header_grid.getElementsByTagName("row");
   for(var i = 0; i < rowCollection.length; i++) {
    var row = rowCollection.item(i);
    var menulistCollection = row.getElementsByTagName("menulist");
    var header_name;
    var header_value;
    for(var e = 0; e < menulistCollection.length; e++) {
     var menulist = menulistCollection.item(e);
     switch(menulist.getAttribute("class")) {
      case "http-header-name":
       header_name = menulist.value;
       break;
      case "http-header-value":
       header_value = menulist.value;
       break;
      }
     }
    xhr.setRequestHeader(header_name, header_value);
    }
   switch(method.toUpperCase()) {
    case "GET":
    case "DELETE":
    case "HEAD":
    case "OPTIONS":
     var requestContent = null;
     break;
    default:
     xhr.setRequestHeader("Content-Length",representation.length);
     var requestContent = representation;
     break;
    }
    xhr.send(requestContent);
   }
  },
 
 stopTest: function() {
  xhr.abort();
  button = document.getElementById("goButton");
  button.label = "Submit";
  button.onclick = net.pyrocufflink.resttest.testREST;
  },
   
 removeHeader: function(button) {
  var row = button.parentNode;
  var grid = row.parentNode;
  grid.removeChild(row);
  },
 
 addHeader: function() {
  var grid = document.getElementById("header-grid");
  var rowCollection = grid.getElementsByTagName("row");
  var lastRow = rowCollection.item(rowCollection.length - 1);
  var rows = grid.getElementsByTagName("rows")[0];
  var newRow = net.pyrocufflink.resttest.createHeaderRow();
  rows.insertBefore(newRow, lastRow ? lastRow.nextSibling : null);
  },
 
 createHeaderRow: function() {
  var row = document.createElement("row");
  row.setAttribute("class", "http-header");
  var npr = net.pyrocufflink.resttest;
  row.appendChild(npr.createHeaderNameSelect());
  row.appendChild(npr.createHeaderValueSelect());
  row.appendChild(npr.createHeaderRemoveButton());
  return row;
  },
 
 createHeaderNameSelect: function() {
  var menu = document.createElement("menulist");
  menu.setAttribute("editable", "true");
  menu.setAttribute("class", "http-header-name");
  menu.addEventListener("command", function() {
   net.pyrocufflink.resttest.selectHeader(menu);
   }, false);
  var menupopup = document.createElement("menupopup");
  menu.appendChild(menupopup);
  menupopup.appendChild(document.createElement("menuitem"));
  for(header in net.pyrocufflink.resttest.http_headers) {
   var menuitem = document.createElement("menuitem");
   menuitem.setAttribute("label", header);
   menuitem.setAttribute("value", header);
   menupopup.appendChild(menuitem);
   }
  return menu;
  },
 
 createHeaderValueSelect: function() {
  var menu = document.createElement("menulist");
  menu.setAttribute("editable", "true");
  menu.setAttribute("class", "http-header-value");
  var menupopup = document.createElement("menupopup");
  menu.appendChild(menupopup);
  return menu;
  },
 
 createHeaderRemoveButton: function() {
  var button = document.createElement("button");
  button.onclick = function() {
   net.pyrocufflink.resttest.removeHeader(button);
  };
  button.setAttribute("label", "Remove");
  return button;
  },
 
 selectHeader: function(menu) {
  var npr = net.pyrocufflink.resttest;
  var row = menu.parentNode;
  var menulistCollection = row.getElementsByTagName("menulist");
  for(var i = 0; i < menulistCollection.length; i++) {
   var item = menulistCollection.item(i);
   if(item.getAttribute("class") == "http-header-value") {
    var values_menu = item;
    break;
    }
   }
  var menupopup = values_menu.getElementsByTagName("menupopup")[0];
  while(menupopup.hasChildNodes()) {
   menupopup.removeChild(menupopup.firstChild);
   }
  for(var i in npr.http_headers[menu.value]) {
   var menuitem = document.createElement("menuitem");
   var val = npr.http_headers[menu.value][i];
   menuitem.setAttribute("label", val);
   menuitem.setAttribute("value", val);
   menupopup.appendChild(menuitem);
   }
  values_menu.selectedIndex = 0;
  }
};
