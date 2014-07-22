
var refcontrolPrefs =
{
	getPrefBranch: function getPrefBranch()
	{
		var prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
		return prefService.getBranch("refcontrol.");
	},

	onPopupShowing: function onPopupShowing(aEvent)
	{
		// onpopupshowing is inherited by child elements.
		// avoid processing on these
		if (aEvent.target.id != "refcontrol-popupOptions")
			return true;
			
		var prefBranch = this.getPrefBranch();
		var bChecked;
	
		var arrMenuItems = aEvent.target.getElementsByTagName("menuitem");
		for (var i = 0; i < arrMenuItems.length; i++)
		{
			var type = arrMenuItems[i].getAttribute('type');
			switch (type)
			{
				case 'checkbox':
				case 'radio':
					try {
						if (type == 'checkbox')
							bChecked = prefBranch.getBoolPref(arrMenuItems[i].value);
						else if (type == 'radio')
							bChecked = (prefBranch.getIntPref(arrMenuItems[i].getAttribute('name')) == arrMenuItems[i].value);
					} catch (e) {
						bChecked = false;
					}
					if (bChecked)
						arrMenuItems[i].setAttribute("checked", true);
					else
						arrMenuItems[i].removeAttribute("checked");
					break;
			}
		}
		
		return true;
	},
	
	onChangeCheckboxPref: function onChangeCheckboxPref(aEvent)
	{
		this.getPrefBranch().setBoolPref(aEvent.target.value, !!aEvent.target.getAttribute('checked'));
	},
	
	onChangeRadioPref: function onChangeRadioPref(aEvent)
	{
		this.getPrefBranch().setIntPref(aEvent.target.getAttribute('name'), aEvent.target.value);
	},

	toggleBooleanPref: function toggleBooleanPref(aEvent)
	{
		var pref;
		if (aEvent.target.id == "refcontrol-toolbarbutton")
			pref = "enabled";
		else
			return;
		var prefBranch = this.getPrefBranch();
		prefBranch.setBoolPref(pref, !prefBranch.getBoolPref(pref));
	},
};
