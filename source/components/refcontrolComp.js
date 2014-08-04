Components.utils.import("resource://gre/modules/devtools/Console.jsm");
console.log("RefControl: Initializing");

function refcontrolObserver() {}
refcontrolObserver.prototype = {
	
	bEnabled: true,
	aRefActions: {},
	
	dump: function dump(aMessage)
	{
		//var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
		//consoleService.logStringMessage("RefControl: " + aMessage);
		Components.utils.import("resource://gre/modules/devtools/Console.jsm");
		console.log("RefControlb: " + aMessage);
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

	is3rdPartyRequest: function is3rdPartyRequest(oChannel)
	{
		return	(oChannel.referrer != null) && 
				(oChannel.URI.host != oChannel.referrer.host);
	},
	
	genRandLabel: function genRandLabel()
	{
		var chain =
		{
			a: 'lnrst',
			d: 'e',
			e: 'adnrst',
			h: 'aei',
			i: 'nst',
			l: 'de',
			n: 'dgt',
			o: 'fnru',
			r: 'ae',
			s: 'aeit',
			t: 'ehio',
			u: 'r',
			v: 'e',
		};
		var ret = '';
		var len = 3 + parseInt(Math.random() * 8);
		var next_chars = undefined;
		for (i = 0; i < len; i++)
		{
			if (next_chars === undefined)
				next_chars = "adehilnorstuv";
			var ch = next_chars[parseInt(Math.random() * next_chars.length)];
			ret += ch;
			next_chars = chain[ch];
		}
		return ret;
	},
	
	performVariableInterpolation: function performVariableInterpolation(oChannel, sRef)
	{
		var vars = { '$': '$' };	// $$ is a literal $
		var arr = 
		[ 
			{ name: 'URL', uri: oChannel.URI }, 
			{ name: 'REF', uri: oChannel.referrer }
		];
		for (var i in arr)
		{
			var o = arr[i];
			if (o.uri)
			{
				vars[o.name]				= o.uri.spec;
				vars[o.name + "_PREPATH"]	= o.uri.prePath;
				vars[o.name + "_SCHEME"]	= o.uri.scheme;
				vars[o.name + "_USERPASS"]	= o.uri.userPass;
				vars[o.name + "_USERNAME"]	= o.uri.username;
				vars[o.name + "_PASSWORD"]	= o.uri.password;
				vars[o.name + "_HOSTPORT"]	= o.uri.hostPort;
				vars[o.name + "_HOST"]		= o.uri.host;
				vars[o.name + "_PORT"]		= 
					o.uri.port != -1 ? 
					o.uri.port : 
					o.uri.schemeIs('http') ? 80 : 
					o.uri.schemeIs('https') ? 443 : 
					o.uri.port;
				vars[o.name + "_PATH"]		= o.uri.path;
			}
		}

		var genRandLabel = this.genRandLabel;
		return sRef.replace(
						/\$\{(\$|[a-zA-Z0-9_]*)\}|\$(\$|[a-zA-Z0-9_]*)/g, 
						function (str, match1, match2)
						{
							var var_name = match1 ? match1 : match2;
							if (var_name == 'RAND')
								return genRandLabel();
							else
								return vars[var_name] ? vars[var_name] : "";
						}
					);
	},

	adjustRef: function adjustRef(oChannel, sSite)
	{
		try {
			var sRef;
			var refAction = this.aRefActions[sSite];
			if (refAction == undefined)
				return false;

			if (refAction.if3rdParty && !this.is3rdPartyRequest(oChannel))
				return false;
				
			if (refAction.str.charAt(0) == '@')
			{
				// special actions
				switch (refAction.str)
				{
					case '@NORMAL':		// act as if we weren't here
						return true;
					case '@FORGE':		// use target's prepath
//						sRef = oChannel.URI.prepath;
						sRef = oChannel.URI.scheme + "://" + oChannel.URI.hostPort + "/";
						break;
					default:
						this.dump("adjustRef: unknown RefAction: " + refAction.str);
						return false;
				}
			}
			else
				sRef = this.performVariableInterpolation(oChannel, refAction.str);

//this.dump("adjustRef: setting Referer for " + oChannel.URI.spec + " to " + sRef);
			oChannel.setRequestHeader("Referer", sRef, false);
			if (oChannel.referrer)
				oChannel.referrer.spec = sRef;

			return true;
		} catch (ex) {
			this.dumpEx(ex);
		}
		return false;
	},

	onModifyRequest: function onModifyRequest(oHttpChannel)
	{
		if (!this.bEnabled)
			return;
		
		oHttpChannel.QueryInterface(Components.interfaces.nsIChannel);

		// handle wildcarding
		// try matching "www.foo.example.com", "foo.example.com", "example.com", ...
		for (var s = oHttpChannel.URI.scheme + "://" + oHttpChannel.URI.host; s != ""; s = s.replace(/^.*?(\.|$)/, ""))
		{
			//Components.utils.import("resource://gre/modules/devtools/Console.jsm");
//console.log("RefControl: " + s);
			if (this.adjustRef(oHttpChannel, s))
				return;
		}
		// didn't find any matches, fall back on configured default action
		this.adjustRef(oHttpChannel, '@DEFAULT');
	},

	getActionsFromBranch: function getActionsFromBranch(oPrefBranch)
	{
		function myDecodeURI(sEncodedURI)
		{
			if (sEncodedURI.charAt(0) == '@')
				return sEncodedURI;
			try {
				return decodeURI(sEncodedURI);
			} catch (ex) {
				return sEncodedURI;
			}
		}

		var sActions = oPrefBranch.getCharPref('actions');
		
		var aRefActions = {};
		aRefActions['@DEFAULT'] = { str: '@NORMAL', if3rdParty: false };	// in case it is not in the pref
		
		var aActions = sActions.split(' ');
		for (var i in aActions)
		{
			var aKV = aActions[i].match(/(.*?)=(.*)/);
			if (aKV != null)
			{
				var s3rdParty = '@3RDPARTY';
				var res;
				if (aKV[2].substr(0, s3rdParty.length) == s3rdParty)
					res = { str: myDecodeURI(aKV[2].substr(s3rdParty.length + 1)), if3rdParty: true };
				else
					res = { str: myDecodeURI(aKV[2]), if3rdParty: false };
				aRefActions[aKV[1]] = res;
			}
		}
		
		return aRefActions;
	},

	onChangeEnabled: function onChangeEnabled(oPrefBranch)
	{
		this.bEnabled = oPrefBranch.getBoolPref('enabled');
	},
	
	onChangeActions: function onChangeActions(oPrefBranch)
	{
		this.aRefActions = this.getActionsFromBranch(oPrefBranch);
	},

	onAppStartup: function onAppStartup()
	{
		var observerService = Components.classes["@mozilla.org/observer-service;1"].getService(Components.interfaces.nsIObserverService);
		observerService.addObserver(this, "http-on-modify-request", true);
		
		var prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
		this.prefBranch = prefService.getBranch("refcontrol.");
		this.prefBranch.QueryInterface(Components.interfaces.nsIPrefBranchInternal);
		this.prefBranch.addObserver("enabled", this, true);
		this.prefBranch.addObserver("actions", this, true);
		this.onChangeEnabled(this.prefBranch);
		this.onChangeActions(this.prefBranch);
	},

	// Implement nsIObserver
	observe: function observe(aSubject, aTopic, aData)
	{
//this.dump("observe: " + aTopic);
		try {
			switch (aTopic)
			{
				case 'http-on-modify-request':
					if (aSubject instanceof Components.interfaces.nsIHttpChannel) {
						this.onModifyRequest(aSubject);
					}
					break;
				
				case 'nsPref:changed':
					aSubject.QueryInterface(Components.interfaces.nsIPrefBranch);
					switch (aData)
					{
						case 'enabled':
							this.onChangeEnabled(aSubject);
							break;
						case 'actions':
							this.onChangeActions(aSubject);
							break;
						default:
							this.dump("observe: unknown pref changing: " + aData);
							break;
					}
					break;
					
				case 'app-startup':
				case 'profile-after-change':
					this.onAppStartup();
					break;
					
				default:
					this.dump("observe: unknown topic: " + aTopic);
					break;
			}
		} catch (ex) {
			this.dumpEx(ex);
		}
	},
	
	// Implement nsISupports
	QueryInterface: function QueryInterface(iid)
	{
		if (!iid.equals(Components.interfaces.nsISupports) &&
			!iid.equals(Components.interfaces.nsIObserver) &&
			!iid.equals(Components.interfaces.nsISupportsWeakReference))
			throw Components.results.NS_ERROR_NO_INTERFACE;
		
		return this;
    },
	
	classDescription: "RefControl observer",
	contractID: "@mozilla.org/refcontrol;1",
	classID: Components.ID("{07C3DD15-0F44-4723-94DE-720B3B2FF9AF}"),
	_xpcom_categories: [{category: 'profile-after-change'}]
};

try {
	Components.utils["import"]("resource://gre/modules/XPCOMUtils.jsm");
	
	if (XPCOMUtils.generateNSGetFactory) {
		// moz-2.0+
		var NSGetFactory = XPCOMUtils.generateNSGetFactory([refcontrolObserver]);
	}
	else {
		// moz-1.9
		if (!XPCOMUtils.defineLazyGetter) {
			// moz < 1.9.2; no profile-after-change category, needs service:true
			refControlObserver.prototype._xpcom_categories = [{category: 'app-startup', service: true}];
		}
		function NSGetModule() { return XPCOMUtils.generateModule([refcontrolObserver]); }
	}	
}
catch (ex) {
	// legacy code < moz-1.9
	var refcontrolModule = {
		firstTime:		true,

		// Implement nsIModule
		registerSelf: function registerSelf(compMgr, fileSpec, location, type)
		{
			var rcp = refcontrolObserver.prototype;
			if (this.firstTime)
			{
				this.firstTime = false;
				throw Components.results.NS_ERROR_FACTORY_REGISTER_AGAIN;
			}

			compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
			compMgr.registerFactoryLocation(rcp.classID, rcp.classDescription, rcp.contractID,
											fileSpec, location, type);

			var catMan = Components.classes["@mozilla.org/categorymanager;1"].getService(Components.interfaces.nsICategoryManager);
			catMan.addCategoryEntry("app-startup", "RefControl", rcp.contractID, true, true);
		},

		unregisterSelf: function unregisterSelf(compMgr, fileSpec, location)
		{
			var rcp = refcontrolObserver.prototype;
			
			// Remove the auto-startup
			compMgr.QueryInterface(Components.interfaces.nsIComponentRegistrar);
			compMgr.unregisterFactoryLocation(rcp.classID, fileSpec);

			var catMan = Components.classes["@mozilla.org/categorymanager;1"].getService(Components.interfaces.nsICategoryManager);
			catMan.deleteCategoryEntry("app-startup", rcp.contractID, true);
		},

		getClassObject: function getClassObject(compMgr, cid, iid)
		{
			var rcp = refcontrolObserver.prototype;
			if (!cid.equals(rcp.classID))
				throw Components.results.NS_ERROR_FACTORY_NOT_REGISTERED;

			if (!iid.equals(Components.interfaces.nsIFactory))
				throw Components.results.NS_ERROR_NO_INTERFACE;

			return this.myFactory;
		},

		canUnload: function canUnload(compMgr) { return true; },
		// end Implement nsIModule

		myFactory: {
			// Implement nsIFactory
			obj: null,
			createInstance: function createInstance(outer, iid)
			{
				if (outer != null)
					throw Components.results.NS_ERROR_NO_AGGREGATION;
				
				if (!this.obj) {
					this.obj = new refcontrolObserver();
				}
				return this.obj.QueryInterface(iid);
			}
		}
	};

	/* module initialisation */
	function NSGetModule(comMgr, fileSpec) { return refcontrolModule; }
}