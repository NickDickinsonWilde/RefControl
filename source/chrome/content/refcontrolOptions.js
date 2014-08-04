
// for Help | About | Visit Home Page
function openURL(aURL)
{
	var windowService = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
	var currentWindow = windowService.getMostRecentWindow("navigator:browser");
	if (currentWindow)
	{
		try {
			currentWindow.delayedOpenTab(aURL);
		} catch(e) {
			currentWindow.open(aURL);
		}
	}
	else
		window.open(aURL);
}

var refcontrolOptions = {
	
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
	
	_aRefActions: null,
	aSortKeys: null,

	// everything except '@DEFAULT' sorted lexicographically
	sortKeys: function sortKeys(arr)
	{
		var ret = [];
		for (var sKey in arr)
		{
			if (sKey != '@DEFAULT')
				ret.push(sKey);
		}
		ret = ret.sort();
		return ret;
	},

	get aRefActions() { return this._aRefActions; },
	set aRefActions(val) { this._aRefActions = val; this.aSortKeys = this.sortKeys(this._aRefActions); },

	get tree() { return document.getElementById("actionsTree"); },
	
	view: {
		mgr: null,		// points back to refcontrolOptions
		atomBold: null,
		
		init: function init(mgr)
		{
			this.mgr = mgr;
			
			var svcAtom = Components.classes["@mozilla.org/atom-service;1"].getService(Components.interfaces.nsIAtomService);
			this.atomBold = svcAtom.getAtom("bold");
		},
		
		// Implement TreeView interface
		get rowCount() 
		{
			return this.mgr.aSortKeys.length; 
		},

		getCellText: function getCellText(aRow, aColumn)
		{
			try {
				var sColumn = (aColumn.id != undefined) ? aColumn.id : aColumn;
				if (sColumn == "siteCol")
				{
					return this.mgr.formatSite(this.mgr.aSortKeys[aRow]);
				}
				else if (sColumn == "actionCol")
				{
					return this.mgr.formatAction(this.mgr.aRefActions[this.mgr.aSortKeys[aRow]]);
				}
			} catch (ex) {
				this.mgr.dumpEx(ex);
			}
			return "";
		},
		
		isSeparator: function(aIndex) { return false; },
		isSorted: function() { return false; },
		isContainer: function(aIndex) { return false; },
		setTree: function(aTree){},
		getImageSrc: function(aRow, aColumn) {},
		getProgressMode: function(aRow, aColumn) {},
		getCellValue: function(aRow, aColumn) {},
		cycleHeader: function(aColId, aElt) {},
		getRowProperties: function(aRow, aProperty) {},
		getColumnProperties: function(aColumn, aColumnElement, aProperty) {},
		getCellProperties: function getCellProperties(aRow, aColumn, aProperty)
		{
			try {
				var bBold = false;
				var sColumn = (aColumn.id != undefined) ? aColumn.id : aColumn;
				var sValue;
				if (sColumn == "siteCol")
				{
					sValue = this.mgr.aSortKeys[aRow];
					bBold = (sValue.charAt(0) == '@');
				}
				else if (sColumn == "actionCol")
				{
					sValue = this.mgr.aRefActions[this.mgr.aSortKeys[aRow]].str;
					bBold = (sValue.charAt(0) == '@' || sValue == '');
				}
				if (bBold)
					aProperty.AppendElement(this.atomBold);
			} catch (ex) {
				this.mgr.dumpEx(ex);
			}
		},

		get selection() { return this._selection != undefined ? this._selection : this.mgr.tree.selection; },
		set selection(val) { return this._selection = val; }
		// end Implement TreeView interface
	},

	getActionsToExport: function getActionsToExport()
	{
		function myEncodeURI(sURI)
		{
			if (sURI.charAt(0) == '@')
				return sURI;
			else
				return encodeURI(sURI);
		}
		
		var aKVs = [];
		var myKeys = ['@DEFAULT'].concat(this.aSortKeys);
		for (var i = 0; i < myKeys.length; i++)
		{
			var sPrefix = this.aRefActions[myKeys[i]].if3rdParty ? '@3RDPARTY' + ':' : '';
			aKVs.push(myKeys[i] + "=" + sPrefix + myEncodeURI(this.aRefActions[myKeys[i]].str));
		}
		return aKVs;
	},

	getActionsFromImport: function getActionsFromImport(aActions, oldActions)
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

		var newActions = oldActions ? oldActions : [];
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
				newActions[aKV[1]] = res;
			}
		}
		
		return newActions;
	},
	
	getActionsFromBranch: function getActionsFromBranch(oPrefBranch)
	{
		var sActions = oPrefBranch.getCharPref('actions');
		
		var oldActions = [];
		oldActions['@DEFAULT'] = { str: '@NORMAL', if3rdParty: false };	// in case it is not in the pref
		
		return this.getActionsFromImport(sActions.split(' '), oldActions);
	},
	
	getActions: function getActions()
	{
		return this.getActionsFromBranch(refcontrolPrefs.getPrefBranch());
	},

	onLoad: function onLoad()
	{
		try {
			this.aRefActions = this.getActions();
	
			this.view.init(this);
			this.tree.treeBoxObject.view = this.view;
			this.onActionsSelected();
			this.onDefaultChanged();
			
			if (window.arguments != undefined &&
				window.arguments[0] != undefined &&
				window.arguments[0].contextSite != undefined)
			{
				// opened from context menu
				setTimeout(function(myThis, sSite) { myThis.contextEdit(sSite); },
							0,
							this, window.arguments[0].contextSite);
			}
		} catch (ex) {
			this.dumpEx(ex);
		}
	},
	
	onOK: function onOK()
	{
		try {
			var sActions = this.getActionsToExport().join(" ");

			var prefBranch = refcontrolPrefs.getPrefBranch();
			prefBranch.setCharPref("actions", sActions);

			return true;
		} catch (ex) {
			this.dumpEx(ex);
		}
		return false;
	},
	
	onHelp: function onHelp()
	{
		try {
			openURL('http://www.stardrifter.org/refcontrol/#help');
		} catch (ex) {
			this.dumpEx(ex);
		}
	},
	
	findRDFID: function findRDFID(extDB, sID)
	{
		var prefixes = [
			"urn:mozilla:extension:", 	// Firefox 1.0.x
			"urn:mozilla:item:"			// Firefox 1.5
		];
		var rdfs = Components.classes["@mozilla.org/rdf/rdf-service;1"].getService(Components.interfaces.nsIRDFService);
		
		for (var i in prefixes)
		{
			var sRDFID = prefixes[i] + sID;
			if (extDB.GetTarget(rdfs.GetResource(sRDFID), 
								rdfs.GetResource("http://www.mozilla.org/2004/em-rdf#name"), 
								true) !== null)
				return sRDFID;
		}
		
		return null;
	},
	
	onAbout: function onAbout()
	{
		var sID = "{455D905A-D37C-4643-A9E2-F6FEFAA0424A}";
		try {
			Components.utils["import"]("resource://gre/modules/AddonManager.jsm");
			AddonManager.getAddonByID(sID, function(addon) {
				if (addon)
					openDialog("chrome://mozapps/content/extensions/about.xul", "", "chrome,centerscreen,modal", addon);
			});
		} catch (ex) {
			var extMgr = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager);
			var extDB = extMgr.datasource;
			var sRDFID = this.findRDFID(extDB, sID);
			if (sRDFID !== null)
				openDialog("chrome://mozapps/content/extensions/about.xul", "", "chrome,centerscreen,modal", sRDFID, extDB);
			else
				alert("Cannot find about dialog");
		}
	},
	
	getLineBreak: function getLineBreak()
	{
		var p = navigator.platform;
		if (new RegExp("win", "i").test(p) || new RegExp("os/2", "i").test(p))
			return "\r\n";
		else
			return "\n";
	},
	
	onImport: function onImport()
	{
		var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
		fp.init(window, this.getString("ImportTitle"), fp.modeOpen);
		fp.appendFilters(fp.filterText);
		fp.appendFilters(fp.filterAll);
		
		if (fp.show() == fp.returnCancel)
			return;
		
		try {
			var fis = Components.classes["@mozilla.org/network/file-input-stream;1"].createInstance(Components.interfaces.nsIFileInputStream);
			fis.QueryInterface(Components.interfaces.nsILineInputStream);
			
			fis.init(fp.file, 
						0x01,	/* PR_RDONLY */
						0444,	/* r--r--r-- (unused?) */
						0);
			var lines = []
			var line = {};
			var eof;

			eof = !fis.readLine(line);
			if (line.value != '[RefControl]')
			{
				alert(this.getString("ImportInvalidFileAlert"));
				return;
			}
			
			while (!eof)
			{
				eof = !fis.readLine(line);
				if (line.value.charAt(0) == '[')
					break;
				if (line.value.charAt(0) == ';')
					continue;
				lines.push(line.value);
			}

			fis.close();
			
			this.aRefActions = this.getActionsFromImport(lines, this.aRefActions);
			if (this.view.selection)
			{
				this.view.selection.clearSelection();
				this.view.selection.currentIndex = -1;
			}
			this.tree.treeBoxObject.view = this.view;	/* refresh tree view */
			this.onDefaultChanged();					/* refresh default box, just in case */
		} catch(ex) {
			alert(this.getString("ImportErrorAlert") + ": " + ex);
		}
	},
	
	onExport: function onExport()
	{
		var fp = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
		fp.init(window, this.getString("ExportTitle"), fp.modeSave);
		fp.defaultExtension = "txt";
		fp.appendFilters(fp.filterText);
		fp.appendFilters(fp.filterAll);
		
		if (fp.show() == fp.returnCancel)
			return;

		try {
			var fos = Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
	
			fos.init(fp.file, 
						0x02 |	/* PR_WRONLY */
						0x08 | 	/* PR_CREATE_FILE */
						0x20,	/* PR_TRUNCATE */
						0644,	/* rw-r--r-- */
						0);
			
			/* remove first entry (@DEFAULT) and add '[RefControl]' at front */
			var arrLines = ['[RefControl]'].concat(this.getActionsToExport().slice(1));
			var sLines = arrLines.join(this.getLineBreak()) + this.getLineBreak();
			fos.write(sLines, sLines.length);
			fos.close();
		} catch(ex) {
			alert(this.getString("ExportErrorAlert") + ": " + ex);
		}
	},
	
	onActionsDblClick: function onActionsDblClick(aEvent)
	{
		try {
			if (aEvent.target._lastSelectedRow != -1)
				this.onEdit();
			else
				this.onAdd();
		} catch (ex) {
			this.dumpEx(ex);
		}
	},
	
	onActionsKeyPress: function onActionsKeyPress(aEvent)
	{
		if (aEvent.keyCode == 46)	/* Delete */
		{
			var btnRemove = document.getElementById("btnRemove");
			if (!btnRemove.disabled)
				this.onRemove();
		}
	},
	
	onActionsSelected: function onActionsSelected()
	{
		try {
			var selection = this.view.selection;
			var btnEdit = document.getElementById("btnEdit");
			var btnRemove = document.getElementById("btnRemove");

			btnEdit.disabled   = !(selection && (selection.count == 1));
			btnRemove.disabled = !(selection && (selection.count >= 1));

		} catch (ex) {
			this.dumpEx(ex);
		}
	},
	
	doEdit: function doEdit(oldSite, oldIndex)
	{
		if (oldIndex != -1)
		{
			if (this.view.selection)
				this.view.selection.select(oldIndex);
			this.tree.treeBoxObject.ensureRowIsVisible(oldIndex);
		}

		var oldAction = (this.aRefActions[oldSite] != undefined) ? 
						this.aRefActions[oldSite] : 
						{ str: '@NORMAL', if3rdParty: false };
		var arg = { site: oldSite, action: oldAction };

		openDialog("chrome://refcontrol/content/refcontrolEdit.xul", "", "centerscreen,chrome,modal,resizable=no", arg);
		
		if (!arg.ret)
			return;
			
		if (arg.site != oldSite)
			delete this.aRefActions[oldSite];
		this.aRefActions[arg.site] = arg.action;

		if (oldIndex == -1 || arg.site != oldSite)
		{
			this.aRefActions = this.aRefActions;		// yea for hidden side-effects
			if (this.view.selection)
			{
				this.view.selection.clearSelection();
				// don't know why, but we need this next line if called via
				// the setTimeout for the contextEdit
				this.view.selection.currentIndex = -1;
			}
			this.tree.treeBoxObject.view = this.view;	// force total refresh
		}
		else
		{
			this.tree.treeBoxObject.invalidateRow(oldIndex);
		}

		if (arg.site == '@DEFAULT')
			this.onDefaultChanged();
	},
	
	onAdd: function onAdd()
	{
		try {
			this.doEdit("", -1);
		} catch (ex) {
			this.dumpEx(ex);
		}
	},

	onEdit: function onEdit()
	{
		try {
			var selection = this.view.selection;
			var oldSite = this.aSortKeys[selection.currentIndex];
			
			this.doEdit(oldSite, selection.currentIndex);
		} catch (ex) {
			this.dumpEx(ex);
		}
	},

	contextEdit: function contextEdit(sSite)
	{
		try {
			this.doEdit(sSite, this.binarySearch(this.aSortKeys, sSite));
		} catch (ex) {
			this.dumpEx(ex);
		}
	},
	
	binarySearch: function binarySearch(arr, searchElement, lft, rgt)
	{
		if (lft == undefined || lft < 0) lft = 0;
		if (rgt == undefined || rgt > arr.length - 1) rgt = arr.length - 1;
		
		while (lft <= rgt)
		{
			var mid = Math.floor((rgt + lft) / 2);
			
			if (arr[mid] < searchElement)
				lft = mid + 1;
			else if (arr[mid] > searchElement)
				rgt = mid - 1;
			else if (arr[mid] == searchElement)
				return mid;
			else
				throw "Array contains invalid elements for binary search";
		}
		return -1;
	},
	
	onRemove: function onRemove()
	{
		try {
			var selection = this.view.selection;
			var oldIndex = selection.currentIndex;

			selection.selectEventsSuppressed = true;

			// remove selected items from aRefActions
			var rangeCount = selection.getRangeCount();
			for (var range = 0; range < rangeCount; range++)
			{
				var min = new Object(), max = new Object();
				selection.getRangeAt(range, min, max);
				for (var i = min.value; i <= max.value; i++)
				{
					delete this.aRefActions[this.aSortKeys[i]];
				}
			}

			// remove references from aSortKeys and refresh tree display
			for (i = 0; i < this.aSortKeys.length; i++)
			{
				if (this.aRefActions[this.aSortKeys[i]] == undefined)
				{
					var r = i;
					while (r < this.aSortKeys.length && this.aRefActions[this.aSortKeys[r]] == undefined)
						r++;
					this.aSortKeys.splice(i, r - i);
					this.tree.treeBoxObject.rowCountChanged(i, i - r);
				}
			}

			selection.selectEventsSuppressed = false;
			
			// fix selection
			if (oldIndex > this.view.rowCount - 1)
				oldIndex = this.view.rowCount - 1;
			this.view.selection.select(oldIndex);
			this.tree.treeBoxObject.ensureRowIsVisible(oldIndex);

		} catch (ex) {
			this.dumpEx(ex);
		}
	},

	onRemoveAll: function onRemoveAll()
	{
		try {
			if (!window.confirm(this.getString("ConfirmRemoveAll")))
				return;
			
			var newRefActions = {};
			var oldRowCount = this.view.rowCount;
			
			newRefActions['@DEFAULT'] = this.aRefActions['@DEFAULT'];
			this.aRefActions = newRefActions;

			this.tree.treeBoxObject.rowCountChanged(0, -oldRowCount);
			
			var selection = this.view.selection;
			if (selection)
				selection.clearSelection();
		} catch (ex) {
			this.dumpEx(ex);
		}
	},
	
	onDefaultChanged: function onDefaultChanged()
	{
		try {
			var txtDefault = document.getElementById("txtDefault");
			var act = this.aRefActions['@DEFAULT'];
			var bBold = (act.str.charAt(0) == '@' || act.str == '');

			txtDefault.value = this.formatAction(act);
			txtDefault.style.color = "#000000";
			txtDefault.style.fontWeight = bBold ? 'bold' : 'normal';
		} catch (ex) {
			this.dumpEx(ex);
		}
	},	

	onEditDefault: function onEditDefault()
	{
		try {
			this.doEdit('@DEFAULT', -1);
		} catch (ex) {
			this.dumpEx(ex);
		}
	},
	
	formatSite: function formatSite(sSite)
	{
		if (sSite == '@DEFAULT')
			return this.getString("SiteDefault");
		else
			return sSite;
	},
	
	formatAction: function formatAction(act)
	{
		var ret;
		if (act.str == '@NORMAL')
			ret = this.getString("ActionNormal");
		else if (act.str == '@FORGE')
			ret = this.getString("ActionForge");
		else if (act.str == '')
			ret = this.getString("ActionBlock");
		else
			ret = act.str;
		if (act.if3rdParty)
			ret = ret + " " + this.getString("Action3rdParty");
		return ret;
	}	
};

