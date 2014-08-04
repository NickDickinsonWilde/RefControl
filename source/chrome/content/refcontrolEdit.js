
var refcontrolEdit = {

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

	onLoad: function onLoad()
	{
		try {
			var fldSite			= document.getElementById("fldSite");
			var fldActionGroup	= document.getElementById("fldActionGroup");
			var fldActionNormal	= document.getElementById("fldActionNormal");
			var fldActionBlock	= document.getElementById("fldActionBlock");
			var fldActionForge	= document.getElementById("fldActionForge");
			var fldActionCustom	= document.getElementById("fldActionCustom");
			var fldAction		= document.getElementById("fldAction");
			var fld3rdParty     = document.getElementById("fld3rdParty");

			var site	= window.arguments[0].site;
			var action	= window.arguments[0].action;

			if (site == '@DEFAULT')
			{
				fldSite.value = this.getString("SiteDefault");
				fldSite.style.fontWeight = "bold";
				fldSite.disabled = true;
			}
			else
			{
				fldSite.value = site;
			}

			switch (action.str)
			{
				case '@NORMAL':
					fldActionGroup.selectedItem = fldActionNormal;
					fldAction.value = "";
					fldAction.disabled = true;
					break;
				case '':
					fldActionGroup.selectedItem = fldActionBlock;
					fldAction.value = "";
					fldAction.disabled = true;
					break;
				case '@FORGE':
					fldActionGroup.selectedItem = fldActionForge;
					fldAction.value = "";
					fldAction.disabled = true;
					break;
				default:
					fldActionGroup.selectedItem = fldActionCustom;
					fldAction.value = action.str;
					fldAction.disabled = false;
					break;
			}

			fld3rdParty.checked = action.if3rdParty;
		} catch (ex) {
			this.dumpEx(ex);
		}
	},

	onOK: function onOK()
	{
		try {
			var fldSite			= document.getElementById("fldSite");
			var fldActionGroup	= document.getElementById("fldActionGroup");
			var fldActionNormal	= document.getElementById("fldActionNormal");
			var fldActionBlock	= document.getElementById("fldActionBlock");
			var fldActionForge	= document.getElementById("fldActionForge");
			var fldActionCustom	= document.getElementById("fldActionCustom");
			var fldAction		= document.getElementById("fldAction");
			var fld3rdParty     = document.getElementById("fld3rdParty");

			var site;
			var type;
			var action = {};

			if (fldSite.disabled)
				site = '@DEFAULT';
			else
			{
				// if user specified a complete URL, extract just the host from it
				try {
					var svcIO = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
					site = svcIO.newURI(fldSite.value, null, null);
					site = site.scheme + "://" + site.host;
				} catch (ex) {
					site = fldSite.value;
				}
				// strip off any leading "*." components
				// "example.com" will do what users expect from "*.example.com"
				while (site.search(/^\*\./) != -1)
					site = site.substr(2);
				if (site === "")
				{
					window.alert(this.getString("SiteNotFilledInAlert"));
					return false;
				}
				if (site.search(/[ =*]/) != -1)
				{
					window.alert(this.getString("SiteInvalidCharactersAlert"));
					return false;
				}
			}

			switch (fldActionGroup.selectedItem)
			{
				case fldActionNormal:
					action.str = '@NORMAL';
					break;
				case fldActionBlock:
					action.str = '';
					break;
				case fldActionForge:
					action.str = '@FORGE';
					break;
				case fldActionCustom:
					action.str = fldAction.value;
					break;
				default:
					window.alert("Unable to determine selected action.");
					return false;
			}

			action.if3rdParty = fld3rdParty.checked;

			window.arguments[0].site = site;
			window.arguments[0].action = action;
			window.arguments[0].ret = true;
			return true;
		} catch (ex) {
			this.dumpEx(ex);
		}
		return false;
	},

	onActionChange: function onActionChange(aEvent)
	{
		var fldAction		= document.getElementById("fldAction");
		fldAction.disabled = !(aEvent.target.id == "fldActionCustom");
	}
};

