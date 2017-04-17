/*
//@line 44 "/builds/tinderbox/XR-Trunk/Linux_2.6.18-8.el5_Depend/mozilla/toolkit/mozapps/downloads/src/nsHelperAppDlg.js.in"
*/

/* This file implements the nsIHelperAppLauncherDialog interface.
 *
 * The implementation consists of a JavaScript "class" named nsUnknownContentTypeDialog,
 * comprised of:
 *   - a JS constructor function
 *   - a prototype providing all the interface methods and implementation stuff
 *
 * In addition, this file implements an nsIModule object that registers the
 * nsUnknownContentTypeDialog component.
 */

const PREF_BD_USEDOWNLOADDIR = "browser.download.useDownloadDir";

/* ctor
 */
function nsUnknownContentTypeDialog() {
    // Initialize data properties.
    this.mLauncher = null;
    this.mContext  = null;
    this.mSourcePath = null;
    this.chosenApp = null;
    this.givenDefaultApp = false;
    this.updateSelf = true;
    this.mTitle    = "";
}

nsUnknownContentTypeDialog.prototype = {
    nsIMIMEInfo  : Components.interfaces.nsIMIMEInfo,

    QueryInterface: function (iid) {
        if (!iid.equals(Components.interfaces.nsIHelperAppLauncherDialog) &&
            !iid.equals(Components.interfaces.nsITimerCallback) &&
            !iid.equals(Components.interfaces.nsISupports)) {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }
        return this;
    },

    // ---------- nsIHelperAppLauncherDialog methods ----------

    // show: Open XUL dialog using window watcher.  Since the dialog is not
    //       modal, it needs to be a top level window and the way to open
    //       one of those is via that route).
    show: function(aLauncher, aContext, aReason)  {
      this.mLauncher = aLauncher;
      this.mContext  = aContext;

      const nsITimer = Components.interfaces.nsITimer;
      this._timer = Components.classes["@mozilla.org/timer;1"]
                              .createInstance(nsITimer);
      this._timer.initWithCallback(this, 0, nsITimer.TYPE_ONE_SHOT);
    },

    // When opening from new tab, if tab closes while dialog is opening,
    // (which is a race condition on the XUL file being cached and the timer
    // in nsExternalHelperAppService), the dialog gets a blur and doesn't
    // activate the OK button.  So we wait a bit before doing opening it.
    reallyShow: function() {
        try {
          var ir = this.mContext.QueryInterface(Components.interfaces.nsIInterfaceRequestor);
          var dwi = ir.getInterface(Components.interfaces.nsIDOMWindowInternal);
          var ww = Components.classes["@mozilla.org/embedcomp/window-watcher;1"]
                             .getService(Components.interfaces.nsIWindowWatcher);
          this.mDialog = ww.openWindow(dwi,
                                       "chrome://mozapps/content/downloads/unknownContentType.xul",
                                       null,
                                       "chrome,centerscreen,titlebar,dialog=yes,dependent",
                                       null);
        } catch (ex) {
          // The containing window may have gone away.  Break reference
          // cycles and stop doing the download.
          const NS_BINDING_ABORTED = 0x804b0002;
          this.mLauncher.cancel(NS_BINDING_ABORTED);
          return;
        }

        // Hook this object to the dialog.
        this.mDialog.dialog = this;

        // Hook up utility functions.
        this.getSpecialFolderKey = this.mDialog.getSpecialFolderKey;

        // Watch for error notifications.
        this.progressListener.helperAppDlg = this;
        this.mLauncher.setWebProgressListener(this.progressListener);
    },

    // promptForSaveToFile:  Display file picker dialog and return selected file.
    //                       This is called by the External Helper App Service
    //                       after the ucth dialog calls |saveToDisk| with a null
    //                       target filename (no target, therefore user must pick).
    //
    //                       Alternatively, if the user has selected to have all
    //                       files download to a specific location, return that
    //                       location and don't ask via the dialog. 
    //
    // Note - this function is called without a dialog, so it cannot access any part
    // of the dialog XUL as other functions on this object do. 
    promptForSaveToFile: function(aLauncher, aContext, aDefaultFile, aSuggestedFileExtension) {
      var result = null;
      
      this.mLauncher = aLauncher;

      // Check to see if the user wishes to auto save to the default download
      // folder without prompting.  This preferences may not be set, so default
      // to not prompting.
      let prefs = Components.classes["@mozilla.org/preferences-service;1"]
                            .getService(Components.interfaces.nsIPrefBranch);
      let autodownload = true;
      try {
        autodownload = prefs.getBoolPref(PREF_BD_USEDOWNLOADDIR);
      } catch (e) { }
      
      if (autodownload) {
        // Retrieve the user's default download directory
        var dnldMgr = Components.classes["@mozilla.org/download-manager;1"]
                                .getService(Components.interfaces.nsIDownloadManager);
        var defaultFolder = dnldMgr.userDownloadsDirectory;
        result = this.validateLeafName(defaultFolder, aDefaultFile, aSuggestedFileExtension);
      }
      
      // Check to make sure we have a valid directory, otherwise, prompt
      if (result)
        return result;
      
      // Use file picker to show dialog.
      var nsIFilePicker = Components.interfaces.nsIFilePicker;
      var picker = Components.classes["@mozilla.org/filepicker;1"].createInstance(nsIFilePicker);

      var bundle = Components.classes["@mozilla.org/intl/stringbundle;1"].getService(Components.interfaces.nsIStringBundleService);
      bundle = bundle.createBundle("chrome://mozapps/locale/downloads/unknownContentType.properties");

      var windowTitle = bundle.GetStringFromName("saveDialogTitle");
      var parent = aContext.QueryInterface(Components.interfaces.nsIInterfaceRequestor).getInterface(Components.interfaces.nsIDOMWindowInternal);
      picker.init(parent, windowTitle, nsIFilePicker.modeSave);
      picker.defaultString = aDefaultFile;

      if (aSuggestedFileExtension) {
        // aSuggestedFileExtension includes the period, so strip it
        picker.defaultExtension = aSuggestedFileExtension.substring(1);
      } 
      else {
        try {
          picker.defaultExtension = this.mLauncher.MIMEInfo.primaryExtension;
        } 
        catch (ex) { }
      }

      var wildCardExtension = "*";
      if (aSuggestedFileExtension) {
        wildCardExtension += aSuggestedFileExtension;
        picker.appendFilter(this.mLauncher.MIMEInfo.description, wildCardExtension);
      }

      picker.appendFilters( nsIFilePicker.filterAll );

      // Default to lastDir if it's valid, use the user's default
      // downloads directory otherwise.
      var dnldMgr = Components.classes["@mozilla.org/download-manager;1"]
                              .getService(Components.interfaces.nsIDownloadManager);
      try {
        var lastDir = prefs.getComplexValue("browser.download.lastDir",
                            Components.interfaces.nsILocalFile);
        if (lastDir.exists())
          picker.displayDirectory = lastDir;
        else
          picker.displayDirectory = dnldMgr.userDownloadsDirectory;
      } catch (ex) {
        picker.displayDirectory = dnldMgr.userDownloadsDirectory;
      }

      if (picker.show() == nsIFilePicker.returnCancel) {
        // null result means user cancelled.
        return null;
      }

      // Be sure to save the directory the user chose through the Save As... 
      // dialog  as the new browser.download.dir since the old one
      // didn't exist.
      result = picker.file;

      if (result) {
        try {
          // Remove the file so that it's not there when we ensure non-existence later;
          // this is safe because for the file to exist, the user would have had to
          // confirm that he wanted the file overwritten.
          if (result.exists())
            result.remove(false);
        }
        catch (e) { }
        var newDir = result.parent;
        prefs.setComplexValue("browser.download.lastDir", Components.interfaces.nsILocalFile, newDir);
        result = this.validateLeafName(newDir, result.leafName, null);
      }
      return result;
    },

    /**
     * Ensures that a local folder/file combination does not already exist in
     * the file system (or finds such a combination with a reasonably similar
     * leaf name), creates the corresponding file, and returns it.
     *
     * @param   aLocalFile
     *          the folder where the file resides
     * @param   aLeafName
     *          the string name of the file (may be empty if no name is known,
     *          in which case a name will be chosen)
     * @param   aFileExt
     *          the extension of the file, if one is known; this will be ignored
     *          if aLeafName is non-empty
     * @returns nsILocalFile
     *          the created file
     */
    validateLeafName: function (aLocalFile, aLeafName, aFileExt)
    {
      if (!aLocalFile || !aLocalFile.exists())
        return null;

      // Remove any leading periods, since we don't want to save hidden files
      // automatically.
      aLeafName = aLeafName.replace(/^\.+/, "");

      if (aLeafName == "")
        aLeafName = "unnamed" + (aFileExt ? "." + aFileExt : "");
      aLocalFile.append(aLeafName);

      this.makeFileUnique(aLocalFile);

//@line 293 "/builds/tinderbox/XR-Trunk/Linux_2.6.18-8.el5_Depend/mozilla/toolkit/mozapps/downloads/src/nsHelperAppDlg.js.in"

      return aLocalFile;
    },

    /**
     * Generates and returns a uniquely-named file from aLocalFile.  If
     * aLocalFile does not exist, it will be the file returned; otherwise, a
     * file whose name is similar to that of aLocalFile will be returned.
     */
    makeFileUnique: function (aLocalFile)
    {
      try {
        // Note - this code is identical to that in 
        //   toolkit/content/contentAreaUtils.js.
        // If you are updating this code, update that code too! We can't share code
        // here since this is called in a js component. 
        var collisionCount = 0;
        while (aLocalFile.exists()) {
          collisionCount++;
          if (collisionCount == 1) {
            // Append "(2)" before the last dot in (or at the end of) the filename
            // special case .ext.gz etc files so we don't wind up with .tar(2).gz
            if (aLocalFile.leafName.match(/\.[^\.]{1,3}\.(gz|bz2|Z)$/i)) {
              aLocalFile.leafName = aLocalFile.leafName.replace(/\.[^\.]{1,3}\.(gz|bz2|Z)$/i, "(2)$&");
            }
            else {
              aLocalFile.leafName = aLocalFile.leafName.replace(/(\.[^\.]*)?$/, "(2)$&");
            }
          }
          else {
            // replace the last (n) in the filename with (n+1)
            aLocalFile.leafName = aLocalFile.leafName.replace(/^(.*\()\d+\)/, "$1" + (collisionCount+1) + ")");
          }
        }
        aLocalFile.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);
      }
      catch (e) {
        dump("*** exception in validateLeafName: " + e + "\n");
        if (aLocalFile.leafName == "" || aLocalFile.isDirectory()) {
          aLocalFile.append("unnamed");
          if (aLocalFile.exists())
            aLocalFile.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0600);
        }
      }
    },
    
    // ---------- implementation methods ----------

    // Web progress listener so we can detect errors while mLauncher is
    // streaming the data to a temporary file.
    progressListener: {
        // Implementation properties.
        helperAppDlg: null,

        // nsIWebProgressListener methods.
        // Look for error notifications and display alert to user.
        onStatusChange: function( aWebProgress, aRequest, aStatus, aMessage ) {
            if ( aStatus != Components.results.NS_OK ) {
                // Get prompt service.
                var prompter = Components.classes[ "@mozilla.org/embedcomp/prompt-service;1" ]
                                   .getService( Components.interfaces.nsIPromptService );
                // Display error alert (using text supplied by back-end).
                prompter.alert( this.dialog, this.helperAppDlg.mTitle, aMessage );

                // Close the dialog.
                this.helperAppDlg.onCancel();
                if ( this.helperAppDlg.mDialog ) {
                    this.helperAppDlg.mDialog.close();
                }
            }
        },

        // Ignore onProgressChange, onProgressChange64, onStateChange, onLocationChange, onSecurityChange, and onRefreshAttempted notifications.
        onProgressChange: function( aWebProgress,
                                    aRequest,
                                    aCurSelfProgress,
                                    aMaxSelfProgress,
                                    aCurTotalProgress,
                                    aMaxTotalProgress ) {
        },

        onProgressChange64: function( aWebProgress,
                                      aRequest,
                                      aCurSelfProgress,
                                      aMaxSelfProgress,
                                      aCurTotalProgress,
                                      aMaxTotalProgress ) {
        },



        onStateChange: function( aWebProgress, aRequest, aStateFlags, aStatus ) {
        },

        onLocationChange: function( aWebProgress, aRequest, aLocation ) {
        },

        onSecurityChange: function( aWebProgress, aRequest, state ) {
        },

        onRefreshAttempted: function( aWebProgress, aURI, aDelay, aSameURI ) {
          return true;
	}
    },

    // initDialog:  Fill various dialog fields with initial content.
    initDialog : function() {
      // Put file name in window title.
      var suggestedFileName = this.mLauncher.suggestedFileName;

      // Some URIs do not implement nsIURL, so we can't just QI.
      var url   = this.mLauncher.source;
      var fname = "";
      this.mSourcePath = url.prePath;
      try {
          url = url.QueryInterface( Components.interfaces.nsIURL );
          // A url, use file name from it.
          fname = url.fileName;
          this.mSourcePath += url.directory;
      } catch (ex) {
          // A generic uri, use path.
          fname = url.path;
          this.mSourcePath += url.path;
      }

      if (suggestedFileName)
        fname = suggestedFileName;
      
      var displayName = fname.replace(/ +/g, " ");

      this.mTitle = this.dialogElement("strings").getFormattedString("title", [displayName]);
      this.mDialog.document.title = this.mTitle;

      // Put content type, filename and location into intro.
      this.initIntro(url, fname, displayName);

      var iconString = "moz-icon://" + fname + "?size=16&contentType=" + this.mLauncher.MIMEInfo.MIMEType;
      this.dialogElement("contentTypeImage").setAttribute("src", iconString);

      // if always-save and is-executable and no-handler
      // then set up simple ui
      var mimeType = this.mLauncher.MIMEInfo.MIMEType;
      var shouldntRememberChoice = (mimeType == "application/octet-stream" || 
                                    mimeType == "application/x-msdownload" ||
                                    this.mLauncher.targetFileIsExecutable);
      if (shouldntRememberChoice && !this.openWithDefaultOK()) {
        // hide featured choice 
        this.mDialog.document.getElementById("normalBox").collapsed = "true";
        // show basic choice 
        this.mDialog.document.getElementById("basicBox").collapsed = "false";
        // change button labels
        this.mDialog.document.documentElement.getButton("accept").label = this.dialogElement("strings").getString("unknownAccept.label");
        this.mDialog.document.documentElement.getButton("cancel").label = this.dialogElement("strings").getString("unknownCancel.label");
        // hide other handler
        this.mDialog.document.getElementById("openHandler").collapsed = "true";
        // set save as the selected option
        this.dialogElement("mode").selectedItem = this.dialogElement("save");
      }
      else {
        this.initAppAndSaveToDiskValues();

        // Initialize "always ask me" box. This should always be disabled
        // and set to true for the ambiguous type application/octet-stream.
        // We don't also check for application/x-msdownload here since we
        // want users to be able to autodownload .exe files. 
        var rememberChoice = this.dialogElement("rememberChoice");

//@line 479 "/builds/tinderbox/XR-Trunk/Linux_2.6.18-8.el5_Depend/mozilla/toolkit/mozapps/downloads/src/nsHelperAppDlg.js.in"
        if (shouldntRememberChoice) {
          rememberChoice.checked = false;
          rememberChoice.disabled = true;
        }
        else {
          rememberChoice.checked = !this.mLauncher.MIMEInfo.alwaysAskBeforeHandling;
        }
        this.toggleRememberChoice(rememberChoice);

        // XXXben - menulist won't init properly, hack. 
        var openHandler = this.dialogElement("openHandler");
        openHandler.parentNode.removeChild(openHandler);
        var openHandlerBox = this.dialogElement("openHandlerBox");
        openHandlerBox.appendChild(openHandler);
      }

      this.mDialog.setTimeout("dialog.postShowCallback()", 0);
      
      this.mDialog.document.documentElement.getButton("accept").disabled = true;
      const nsITimer = Components.interfaces.nsITimer;
      this._timer = Components.classes["@mozilla.org/timer;1"]
                              .createInstance(nsITimer);
      this._timer.initWithCallback(this, 250, nsITimer.TYPE_ONE_SHOT);
    },

    _timer: null,
    notify: function (aTimer) {
      if (!this.mDialog) {
        this.reallyShow();
      } else {
        // The user may have already canceled the dialog.
        try {
          if (!this._blurred) {
            this.mDialog.document.documentElement.getButton("accept").disabled = false;
          }
        } catch (ex) {}
        this._delayExpired = true;
      }
      // The timer won't release us, so we have to release it.
      this._timer = null;
    },

    postShowCallback: function () {
      this.mDialog.sizeToContent();

      // Set initial focus
      this.dialogElement("mode").focus();
    },

    // initIntro:
    initIntro: function(url, filename, displayname) {
        this.dialogElement( "location" ).value = displayname;
        this.dialogElement( "location" ).setAttribute("realname", filename);
        this.dialogElement( "location" ).setAttribute("tooltiptext", displayname);

        // if mSourcePath is a local file, then let's use the pretty path name instead of an ugly
        // url...
        var pathString = this.mSourcePath;
        try 
        {
          var fileURL = url.QueryInterface(Components.interfaces.nsIFileURL);
          if (fileURL)
          {
            var fileObject = fileURL.file;
            if (fileObject)
            {
              var parentObject = fileObject.parent;
              if (parentObject)
              {
                pathString = parentObject.path;
              }
            }
          }
        } catch(ex) {}

        if (pathString == this.mSourcePath)
        {
          // wasn't a fileURL
          var tmpurl = url.clone(); // don't want to change the real url
          try {
            tmpurl.userPass = "";
          } catch (ex) {}
          pathString = tmpurl.prePath;
        }

        // Set the location text, which is separate from the intro text so it can be cropped
        var location = this.dialogElement( "source" );
        location.value = pathString;
        location.setAttribute("tooltiptext", this.mSourcePath);
        
        // Show the type of file. 
        var type = this.dialogElement("type");
        var mimeInfo = this.mLauncher.MIMEInfo;
        
        // 1. Try to use the pretty description of the type, if one is available.
        var typeString = mimeInfo.description;
        
        if (typeString == "") {
          // 2. If there is none, use the extension to identify the file, e.g. "ZIP file"
          var primaryExtension = "";
          try {
            primaryExtension = mimeInfo.primaryExtension;
          }
          catch (ex) {
          }
          if (primaryExtension != "")
            typeString = this.dialogElement("strings").getFormattedString("fileType", [primaryExtension.toUpperCase()]);
          // 3. If we can't even do that, just give up and show the MIME type. 
          else
            typeString = mimeInfo.MIMEType;
        }
        
        type.value = typeString;
    },
    
    _blurred: false,
    _delayExpired: false, 
    onBlur: function(aEvent) {
      this._blurred = true;
      this.mDialog.document.documentElement.getButton("accept").disabled = true;
    },
    
    onFocus: function(aEvent) {
      this._blurred = false;
      if (this._delayExpired) {
        var script = "document.documentElement.getButton('accept').disabled = false";
        this.mDialog.setTimeout(script, 250);
      }
    },

    // Returns true if opening the default application makes sense.
    openWithDefaultOK: function() {
        // The checking is different on Windows...
//@line 623 "/builds/tinderbox/XR-Trunk/Linux_2.6.18-8.el5_Depend/mozilla/toolkit/mozapps/downloads/src/nsHelperAppDlg.js.in"
            // On other platforms, default is Ok if there is a default app.
            // Note that nsIMIMEInfo providers need to ensure that this holds true
            // on each platform.
        return this.mLauncher.MIMEInfo.hasDefaultHandler;
//@line 628 "/builds/tinderbox/XR-Trunk/Linux_2.6.18-8.el5_Depend/mozilla/toolkit/mozapps/downloads/src/nsHelperAppDlg.js.in"
    },
    
    // Set "default" application description field.
    initDefaultApp: function() {
      // Use description, if we can get one.
      var desc = this.mLauncher.MIMEInfo.defaultDescription;
      if (desc) {
        var defaultApp = this.dialogElement("strings").getFormattedString("defaultApp", [desc]);
        this.dialogElement("defaultHandler").label = defaultApp;
      }
      else {
        this.dialogElement("modeDeck").setAttribute("selectedIndex", "1");
        // Hide the default handler item too, in case the user picks a 
        // custom handler at a later date which triggers the menulist to show.
        this.dialogElement("defaultHandler").hidden = true;
      }
    },

    // getPath:
    getPath: function (aFile) {
//@line 651 "/builds/tinderbox/XR-Trunk/Linux_2.6.18-8.el5_Depend/mozilla/toolkit/mozapps/downloads/src/nsHelperAppDlg.js.in"
      return aFile.path;
//@line 653 "/builds/tinderbox/XR-Trunk/Linux_2.6.18-8.el5_Depend/mozilla/toolkit/mozapps/downloads/src/nsHelperAppDlg.js.in"
    },

    // initAppAndSaveToDiskValues:
    initAppAndSaveToDiskValues: function() {
      var modeGroup = this.dialogElement("mode");

      // We don't let users open .exe files or random binary data directly 
      // from the browser at the moment because of security concerns. 
      var openWithDefaultOK = this.openWithDefaultOK();
      var mimeType = this.mLauncher.MIMEInfo.MIMEType;
      if (this.mLauncher.targetFileIsExecutable || (
          (mimeType == "application/octet-stream" ||
           mimeType == "application/x-msdownload") && 
           !openWithDefaultOK)) {
        this.dialogElement("open").disabled = true;
        var openHandler = this.dialogElement("openHandler");
        openHandler.disabled = true;
        openHandler.selectedItem = null;
        modeGroup.selectedItem = this.dialogElement("save");
        return;
      }
    
      // Fill in helper app info, if there is any.
      try {
        this.chosenApp =
          this.mLauncher.MIMEInfo.preferredApplicationHandler
              .QueryInterface(Components.interfaces.nsILocalHandlerApp);
      } catch (e) {
        this.chosenApp = null;
      }
      // Initialize "default application" field.
      this.initDefaultApp();

      var otherHandler = this.dialogElement("otherHandler");
              
      // Fill application name textbox.
      if (this.chosenApp && this.chosenApp.executable && 
          this.chosenApp.executable.path) {
        otherHandler.setAttribute("path",
                                  this.getPath(this.chosenApp.executable));
        otherHandler.label = this.chosenApp.executable.leafName;
        otherHandler.hidden = false;
      }

      var useDefault = this.dialogElement("useSystemDefault");
      var openHandler = this.dialogElement("openHandler");
      openHandler.selectedIndex = 0;

      if (this.mLauncher.MIMEInfo.preferredAction == this.nsIMIMEInfo.useSystemDefault) {
        // Open (using system default).
        modeGroup.selectedItem = this.dialogElement("open");
      } else if (this.mLauncher.MIMEInfo.preferredAction == this.nsIMIMEInfo.useHelperApp) {
        // Open with given helper app.
        modeGroup.selectedItem = this.dialogElement("open");
        openHandler.selectedIndex = 1;
      } else {
        // Save to disk.
        modeGroup.selectedItem = this.dialogElement("save");
      }
      
      // If we don't have a "default app" then disable that choice.
      if (!openWithDefaultOK) {
        var useDefault = this.dialogElement("defaultHandler");
        var isSelected = useDefault.selected;
        
        // Disable that choice.
        useDefault.hidden = true;
        // If that's the default, then switch to "save to disk."
        if (isSelected) {
          openHandler.selectedIndex = 1;
          modeGroup.selectedItem = this.dialogElement("save");
        }
      }
      
      otherHandler.nextSibling.hidden = otherHandler.nextSibling.nextSibling.hidden = false;
      this.updateOKButton();
    },

    // Returns the user-selected application
    helperAppChoice: function() {
      return this.chosenApp;
    },
    
    get saveToDisk() {
      return this.dialogElement("save").selected;
    },
    
    get useOtherHandler() {
      return this.dialogElement("open").selected && this.dialogElement("openHandler").selectedIndex == 1;
    },
    
    get useSystemDefault() {
      return this.dialogElement("open").selected && this.dialogElement("openHandler").selectedIndex == 0;
    },
    
    toggleRememberChoice: function (aCheckbox) {
        this.dialogElement("settingsChange").hidden = !aCheckbox.checked;
        this.mDialog.sizeToContent();
    },
    
    openHandlerCommand: function () {
      var openHandler = this.dialogElement("openHandler");
      if (openHandler.selectedItem.id == "choose")
        this.chooseApp();
      else
        openHandler.setAttribute("lastSelectedItemID", openHandler.selectedItem.id);
    },

    updateOKButton: function() {
      var ok = false;
      if (this.dialogElement("save").selected) {
        // This is always OK.
        ok = true;
      } 
      else if (this.dialogElement("open").selected) {
        switch (this.dialogElement("openHandler").selectedIndex) {
        case 0:
          // No app need be specified in this case.
          ok = true;
          break;
        case 1:
          // only enable the OK button if we have a default app to use or if 
          // the user chose an app....
          ok = this.chosenApp || /\S/.test(this.dialogElement("otherHandler").getAttribute("path")); 
        break;
        }
      }

      // Enable Ok button if ok to press.
      this.mDialog.document.documentElement.getButton("accept").disabled = !ok;
    },
    
    // Returns true iff the user-specified helper app has been modified.
    appChanged: function() {
      return this.helperAppChoice() != this.mLauncher.MIMEInfo.preferredApplicationHandler;
    },

    updateMIMEInfo: function() {
      var needUpdate = false;
      // If current selection differs from what's in the mime info object,
      // then we need to update.
      if (this.saveToDisk) {
        needUpdate = this.mLauncher.MIMEInfo.preferredAction != this.nsIMIMEInfo.saveToDisk;
        if (needUpdate)
          this.mLauncher.MIMEInfo.preferredAction = this.nsIMIMEInfo.saveToDisk;
      } 
      else if (this.useSystemDefault) {
        needUpdate = this.mLauncher.MIMEInfo.preferredAction != this.nsIMIMEInfo.useSystemDefault;
        if (needUpdate)
          this.mLauncher.MIMEInfo.preferredAction = this.nsIMIMEInfo.useSystemDefault;
      } 
      else {
        // For "open with", we need to check both preferred action and whether the user chose
        // a new app.
        needUpdate = this.mLauncher.MIMEInfo.preferredAction != this.nsIMIMEInfo.useHelperApp || this.appChanged();
        if (needUpdate) {
          this.mLauncher.MIMEInfo.preferredAction = this.nsIMIMEInfo.useHelperApp;
          // App may have changed - Update application
          var app = this.helperAppChoice();
          this.mLauncher.MIMEInfo.preferredApplicationHandler = app;
        }
      }
      // We will also need to update if the "always ask" flag has changed.
      needUpdate = needUpdate || this.mLauncher.MIMEInfo.alwaysAskBeforeHandling != (!this.dialogElement("rememberChoice").checked);

      // One last special case: If the input "always ask" flag was false, then we always
      // update.  In that case we are displaying the helper app dialog for the first
      // time for this mime type and we need to store the user's action in the mimeTypes.rdf
      // data source (whether that action has changed or not; if it didn't change, then we need
      // to store the "always ask" flag so the helper app dialog will or won't display
      // next time, per the user's selection).
      needUpdate = needUpdate || !this.mLauncher.MIMEInfo.alwaysAskBeforeHandling;

      // Make sure mime info has updated setting for the "always ask" flag.
      this.mLauncher.MIMEInfo.alwaysAskBeforeHandling = !this.dialogElement("rememberChoice").checked;

      return needUpdate;        
    },
    
    // See if the user changed things, and if so, update the
    // mimeTypes.rdf entry for this mime type.
    updateHelperAppPref: function() {
      var ha = new this.mDialog.HelperApps();
      ha.updateTypeInfo(this.mLauncher.MIMEInfo);
      ha.destroy();
    },
    
    // onOK:
    onOK: function() {
      // Verify typed app path, if necessary.
      if (this.useOtherHandler) {
        var helperApp = this.helperAppChoice();
        if (!helperApp || !helperApp.executable ||
            !helperApp.executable.exists()) {
          // Show alert and try again.        
          var bundle = this.dialogElement("strings");                    
          var msg = bundle.getFormattedString("badApp", [this.dialogElement("otherHandler").path]);
          var svc = Components.classes["@mozilla.org/embedcomp/prompt-service;1"].getService(Components.interfaces.nsIPromptService);
          svc.alert(this.mDialog, bundle.getString("badApp.title"), msg);

          // Disable the OK button.
          this.mDialog.document.documentElement.getButton("accept").disabled = true;
          this.dialogElement("mode").focus();          

          // Clear chosen application.
          this.chosenApp = null;

          // Leave dialog up.
          return false;
        }
      }
        
      // Remove our web progress listener (a progress dialog will be
      // taking over).
      this.mLauncher.setWebProgressListener(null);

      // saveToDisk and launchWithApplication can return errors in 
      // certain circumstances (e.g. The user clicks cancel in the
      // "Save to Disk" dialog. In those cases, we don't want to
      // update the helper application preferences in the RDF file.
      try {
        var needUpdate = this.updateMIMEInfo();
        
        if (this.dialogElement("save").selected) {
          // If we're using a default download location, create a path
          // for the file to be saved to to pass to |saveToDisk| - otherwise
          // we must ask the user to pick a save name.

//@line 895 "/builds/tinderbox/XR-Trunk/Linux_2.6.18-8.el5_Depend/mozilla/toolkit/mozapps/downloads/src/nsHelperAppDlg.js.in"
          // Since saveToDisk may open a file picker and therefore block this routine,
          // we should only call it once the dialog is closed.
          var _delayedSaveToDisk = function(aSelf) {
            aSelf.mLauncher.saveToDisk(null, false);
          }
          this.mDialog.opener.setTimeout(_delayedSaveToDisk, 0, this);
        }
        else
          this.mLauncher.launchWithApplication(null, false);

        // Update user pref for this mime type (if necessary). We do not
        // store anything in the mime type preferences for the ambiguous
        // type application/octet-stream. We do NOT do this for 
        // application/x-msdownload since we want users to be able to 
        // autodownload these to disk. 
        if (needUpdate && this.mLauncher.MIMEInfo.MIMEType != "application/octet-stream")
          this.updateHelperAppPref();
      } catch(e) { }

      // Unhook dialog from this object.
      this.mDialog.dialog = null;

      // Close up dialog by returning true.
      return true;
    },

    // onCancel:
    onCancel: function() {
      // Remove our web progress listener.
      this.mLauncher.setWebProgressListener(null);

      // Cancel app launcher.
      try {
        const NS_BINDING_ABORTED = 0x804b0002;
        this.mLauncher.cancel(NS_BINDING_ABORTED);
      } catch(exception) {
      }

      // Unhook dialog from this object.
      this.mDialog.dialog = null;

      // Close up dialog by returning true.
      return true;
    },

    // dialogElement:  Convenience. 
    dialogElement: function(id) {
      return this.mDialog.document.getElementById(id);
    },

    // Retrieve the pretty description from the file
    getFileDisplayName: function getFileDisplayName(file)
    { 
//@line 956 "/builds/tinderbox/XR-Trunk/Linux_2.6.18-8.el5_Depend/mozilla/toolkit/mozapps/downloads/src/nsHelperAppDlg.js.in"
        return file.leafName;
    },

    // chooseApp:  Open file picker and prompt user for application.
    chooseApp: function() {
//@line 1027 "/builds/tinderbox/XR-Trunk/Linux_2.6.18-8.el5_Depend/mozilla/toolkit/mozapps/downloads/src/nsHelperAppDlg.js.in"
      var nsIFilePicker = Components.interfaces.nsIFilePicker;
      var fp = Components.classes["@mozilla.org/filepicker;1"]
                         .createInstance(nsIFilePicker);
      fp.init(this.mDialog,
              this.dialogElement("strings").getString("chooseAppFilePickerTitle"),
              nsIFilePicker.modeOpen);

      fp.appendFilters(nsIFilePicker.filterApps);

      if (fp.show() == nsIFilePicker.returnOK && fp.file) {
        // Show the "handler" menulist since we have a (user-specified) 
        // application now.
        this.dialogElement("modeDeck").setAttribute("selectedIndex", "0");
        
        // Remember the file they chose to run.
        var localHandlerApp = 
          Components.classes["@mozilla.org/uriloader/local-handler-app;1"].
          createInstance(Components.interfaces.nsILocalHandlerApp);
        localHandlerApp.executable = fp.file;
        this.chosenApp = localHandlerApp;
        
        // Update dialog.
        var otherHandler = this.dialogElement("otherHandler");
        otherHandler.removeAttribute("hidden");
        otherHandler.setAttribute("path", this.getPath(this.chosenApp.executable));
        otherHandler.label = this.chosenApp.executable.leafName;
        this.dialogElement("openHandler").selectedIndex = 1;
        this.dialogElement("openHandler").setAttribute("lastSelectedItemID", "otherHandler");
        
        this.dialogElement("mode").selectedItem = this.dialogElement("open");
      }
      else {
        var openHandler = this.dialogElement("openHandler");
        var lastSelectedID = openHandler.getAttribute("lastSelectedItemID");
        if (!lastSelectedID)
          lastSelectedID = "defaultHandler";
        openHandler.selectedItem = this.dialogElement(lastSelectedID);
      }
//@line 1066 "/builds/tinderbox/XR-Trunk/Linux_2.6.18-8.el5_Depend/mozilla/toolkit/mozapps/downloads/src/nsHelperAppDlg.js.in"
    },

    // Turn this on to get debugging messages.
    debug: false,

    // Dump text (if debug is on).
    dump: function( text ) {
        if ( this.debug ) {
            dump( text ); 
        }
    },

    // dumpInfo:
    doDebug: function() {
        const nsIProgressDialog = Components.interfaces.nsIProgressDialog;
        // Open new progress dialog.
        var progress = Components.classes[ "@mozilla.org/progressdialog;1" ]
                         .createInstance( nsIProgressDialog );
        // Show it.
        progress.open( this.mDialog );
    },

    // dumpObj:
    dumpObj: function( spec ) {
         var val = "<undefined>";
         try {
             val = eval( "this."+spec ).toString();
         } catch( exception ) {
         }
         this.dump( spec + "=" + val + "\n" );
    },

    // dumpObjectProperties
    dumpObjectProperties: function( desc, obj ) {
         for( prop in obj ) {
             this.dump( desc + "." + prop + "=" );
             var val = "<undefined>";
             try {
                 val = obj[ prop ];
             } catch ( exception ) {
             }
             this.dump( val + "\n" );
         }
    }
}

// This Component's module implementation.  All the code below is used to get this
// component registered and accessible via XPCOM.
var module = {
    firstTime: true,

    // registerSelf: Register this component.
    registerSelf: function (compMgr, fileSpec, location, type) {
        if (this.firstTime) {
            this.firstTime = false;
            throw Components.results.NS_ERROR_FACTORY_REGISTER_AGAIN;
        }
        compMgr = compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);

        compMgr.registerFactoryLocation( this.cid,
                                         "Unknown Content Type Dialog",
                                         this.contractId,
                                         fileSpec,
                                         location,
                                         type );
    },

    // getClassObject: Return this component's factory object.
    getClassObject: function (compMgr, cid, iid) {
        if (!cid.equals(this.cid)) {
            throw Components.results.NS_ERROR_NO_INTERFACE;
        }

        if (!iid.equals(Components.interfaces.nsIFactory)) {
            throw Components.results.NS_ERROR_NOT_IMPLEMENTED;
        }

        return this.factory;
    },

    /* CID for this class */
    cid: Components.ID("{F68578EB-6EC2-4169-AE19-8C6243F0ABE1}"),

    /* Contract ID for this class */
    contractId: "@mozilla.org/helperapplauncherdialog;1",

    /* factory object */
    factory: {
        // createInstance: Return a new nsProgressDialog object.
        createInstance: function (outer, iid) {
            if (outer != null)
                throw Components.results.NS_ERROR_NO_AGGREGATION;

            return (new nsUnknownContentTypeDialog()).QueryInterface(iid);
        }
    },

    // canUnload: n/a (returns true)
    canUnload: function(compMgr) {
        return true;
    }
};

// NSGetModule: Return the nsIModule object.
function NSGetModule(compMgr, fileSpec) {
    return module;
}
