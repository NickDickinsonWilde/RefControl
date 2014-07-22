
var refcontrolOverlay = {

	monitoredPrefs:
	{
		enabled: 0,
		statusbar: 0,
		contextMenu: 0,
	},

	dump: function dump(aMessage)
	{
		var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
		consoleService.logStringMessage("RefControl: " + aMessage);
	},

	dumpEx: function dumpEx(aException)
	{
		Components.utils.reportError(aException);
		if ('stack' in aException)
		{
			var msg = new String(aException);
			msg += "\n" + aException.stack;
			this.dump(msg);
		}
	},

	getString: function getString(sStringName)
	{
		return document.getElementById('refcontrol-strings').getString(sStringName);
	},

	isOurURL: function isOurURL(sURL)
	{
		var svcIO = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
		try {
			var uri = svcIO.newURI(sURL, null, null);
		} catch (ex) {
			return false;
		}
		return (uri.schemeIs('http') || uri.schemeIs('https'));
	},

	getLinkURL: function getLinkURL(contextMenu)
	{
		return typeof(contextMenu.linkURL) == 'function' ? contextMenu.linkURL() : contextMenu.linkURL;
	},

	openOptions: function openOptions(sSite)
	{
		var winOptions = openDialog('chrome://refcontrol/content/refcontrolOptions.xul',
					'RefControlOptions',
					'centerscreen,chrome,resizable,dialog=no',
					(sSite !== undefined) ? { contextSite: sSite } : undefined);
		try {
			winOptions.focus();
		} catch (ex) {
		}
	},

	openOptionsURL: function openOptionsURL(sURL)
	{
		var svcIO = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
		var site = svcIO.newURI(sURL, null, null);
		this.openOptions(site.scheme + "://" + site.host);
	},

	toolsOptions: function toolsOptions()
	{
		this.openOptions();
	},

	contextOptions: function contextOptions()
	{
		var sSite;
		try {
			sSite = window._content.document.location.protocol + "//" + window._content.document.location.hostname;
		} catch (ex) {
		}
		this.openOptions(sSite);
	},

	contextOptionsLink: function contextOptionsLink()
	{
		this.openOptionsURL(this.getLinkURL(gContextMenu));
	},

	contextOptionsImage: function contextOptionsImage()
	{
		this.openOptionsURL(gContextMenu.imageURL);
	},

	onLoad: function onLoad()
	{
		window.addEventListener("unload", this, false);
		window.getBrowser().addProgressListener(this);
		document.getElementById("contentAreaContextMenu").addEventListener("popupshowing", this, false);

		this.prefBranch = refcontrolPrefs.getPrefBranch();
		this.prefBranch.QueryInterface(Components.interfaces.nsIPrefBranchInternal);

		if (this.prefBranch.getBoolPref('first_run'))
		{
			this.prefBranch.setBoolPref('first_run', false);

			// old value of 1 (show icon in statusbar) is no longer applicable
			if (this.prefBranch.getIntPref('statusbar') == 1)
				this.prefBranch.setIntPref('statusbar', 0);

			// add button to add-on bar if not already in a toolbar
			var id = 'refcontrol-toolbarbutton';
			if (!document.getElementById(id))
			{
				var toolbar = document.getElementById('addon-bar');
				if (!toolbar)
					toolbar = document.getElementById('nav-bar');
				if (toolbar)
				{
					toolbar.insertItem(id);
					toolbar.setAttribute("currentset", toolbar.currentSet);
					document.persist(toolbar.id, "currentset");
					if (toolbar.id == "addon-bar")
						toolbar.collapsed = false;
				}
			}
		}

		for (var sPref in this.monitoredPrefs)
		{
			this.prefBranch.addObserver(sPref, this, true);
			this.observe(this.prefBranch, 'nsPref:changed', sPref);
		}
	},

	onUnload: function onUnload()
	{
		window.removeEventListener("unload", this, false);

		for (var sPref in this.monitoredPrefs)
			this.prefBranch.removeObserver(sPref, this);
		this.prefBranch = null;

		document.getElementById("contentAreaContextMenu").removeEventListener("popupshowing", this, false);
		window.getBrowser().removeProgressListener(this);
	},

	onPopupShowing: function onPopupShowing(e)
	{
		var bShow = this.bShowContextMenu &&
					!gContextMenu.isTextSelected && !gContextMenu.onLink && !gContextMenu.onImage && !gContextMenu.onTextInput &&
					this.isOurURL(gContextMenu.target.ownerDocument.location.href);		// gContextMenu.docURL
		var bShowLink = this.bShowContextMenu &&
					gContextMenu.onLink &&
					this.isOurURL(this.getLinkURL(gContextMenu));
		var bShowImage = this.bShowContextMenu &&
					gContextMenu.onImage &&
					this.isOurURL(gContextMenu.imageURL);
		gContextMenu.showItem('refcontrol_sep', bShow || bShowLink || bShowImage);
		gContextMenu.showItem('refcontrol_options', bShow);
		gContextMenu.showItem('refcontrol_options_link', bShowLink);
		gContextMenu.showItem('refcontrol_options_image', bShowImage);
	},

	// Implement nsIEventListener
	handleEvent: function handleEvent(evt)
	{
		try {
			switch (evt.type)
			{
				case 'load':
					// workaround https://bugzilla.mozilla.org/show_bug.cgi?id=174320
					setTimeout(function(myThis) { window.removeEventListener("load", myThis, false); }, 0, this);
					return this.onLoad(evt);
				case 'popupshowing':
					return this.onPopupShowing(evt);
				case 'unload':
					return this.onUnload(evt);
				default:
					this.dump("handleEvent: unknown event: " + evt.type);
			}
		} catch (ex) {
			this.dumpEx(ex);
		}
		return undefined;
	},

	onChangeEnabled: function onChangeEnabled(oPrefBranch)
	{
		this.bEnabled = oPrefBranch.getBoolPref('enabled');
		this.updateToolbarButton();
	},

	onChangeStatusbar: function onChangeStatusbar(oPrefBranch)
	{
		this.showStatusbar = oPrefBranch.getIntPref("statusbar");
		this.updateStatusbar();
	},

	onChangeContextMenu: function onChangeContextMenu(oPrefBranch)
	{
		this.bShowContextMenu = oPrefBranch.getBoolPref('contextMenu');
	},

	// Implement nsIObserver
	observe: function observe(aSubject, aTopic, aData)
	{
		try {
			switch (aTopic)
			{
				case 'nsPref:changed':
					aSubject.QueryInterface(Components.interfaces.nsIPrefBranch);
					switch (aData)
					{
						case 'enabled':
							this.onChangeEnabled(aSubject);
							break;
						case 'statusbar':
							this.onChangeStatusbar(aSubject);
							break;
						case 'contextMenu':
							this.onChangeContextMenu(aSubject);
							break;
						default:
							this.dump("observe: unknown pref changing: " + aData);
							break;
					}
					break;

				default:
					this.dump("observe: unknown topic: " + aTopic);
					break;
			}
		} catch (ex) {
			this.dumpEx(ex);
		}
	},

	updateToolbarButton: function()
	{
		var tbb = document.getElementById("refcontrol-toolbarbutton");
		if (tbb)
			tbb.setAttribute("enabled", this.bEnabled ? "true" : "false");
	},

	updateStatusbar: function updateStatusbar()
	{
		var sb = document.getElementById("refcontrol-status");
		if (this.showStatusbar <= 1)
		{
				sb.setAttribute("collapsed", true);
				return;
		}

		var theWindow = ("gBrowser" in window) ? window.gBrowser.contentWindow : window.frames[0];
		var sRef = theWindow.document.referrer;
		var sRefDisp = (sRef ? sRef : this.getString("StatusbarNoReferer"));
		var sbText = document.getElementById("refcontrol-status-text");

		sbText.value = sRefDisp;
		sbText.setAttribute("tooltiptext", sRefDisp);
		sb.removeAttribute("collapsed");
	},

	// Implement nsIWebProgressListener
	onLocationChange: function onLocationChange(aWebProgress, aRequest, aLocation)
	{
		try {
			this.updateStatusbar();
		} catch (ex) {
			this.dumpEx(ex);
		}
	},
	onProgressChange: function(webProgress, request, curSelfProgress, maxSelfProgress, curTotalProgress, maxTotalProgress) {},
	onSecurityChange: function(webProgress, request, state) {},
	onStateChange: function(webProgress, request, stateFlags, status) {},
	onStatusChange: function(webProgress, request, status, message) {},
	// end Implement nsIWebProgressListener

	// see http://forums.mozillazine.org/viewtopic.php?t=49716
	onLinkIconAvailable: function(a) {},

	// Implement nsISupports
	QueryInterface: function QueryInterface(aIID)
	{
		if (aIID.equals(Components.interfaces.nsIObserver) ||
			aIID.equals(Components.interfaces.nsIWebProgressListener) ||
			aIID.equals(Components.interfaces.nsIEventListener) ||
			aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
			aIID.equals(Components.interfaces.nsISupports))
		{
			return this;
		}
		throw Components.results.NS_ERROR_NO_INTERFACE;
	}
};

window.addEventListener("load", refcontrolOverlay, false);

