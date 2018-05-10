sap.ui.define([
	"jquery.sap.global",
	"sap/m/MessageToast",
	"sap/ui/core/Fragment",
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/Filter",
	"sap/ui/model/json/JSONModel"
], function(jQuery, MessageToast, Fragment, Controller, Filter, JSONModel) {
	"use strict";

	return Controller.extend("com.gv.hackathon.Hackathon5.controller.WorkOrders", {
		_safetyCheck: false,
		onInit: function() {
			this._woModel = new sap.ui.model.json.JSONModel("mockData/WOmasterList.json");
			this._woModel.setDefaultBindingMode(sap.ui.model.BindingMode.OneWay);
			this.getView().setModel(this._woModel);

			var oLink = new sap.m.Link({
				text: "Perform safety measures check",
				press: this.performSafetyCheck.bind(this)
			});

			var oMessageTemplate = new sap.m.MessageItem({
				type: "{type}",
				title: "{title}",
				description: "{description}",
				subtitle: "{subtitle}",
				counter: "{counter}",
				link: oLink
			});

			this._oMessagePopover = new sap.m.MessagePopover({
				items: {
					path: "/",
					template: oMessageTemplate
				}
			});
			var sErrorDescription = "You have not yet performed the safety check. \n" +
				"Perform the check to start working on orders.";

			var aMessages = [{
				type: "Error",
				title: "Safety Measures Error",
				description: sErrorDescription,
				subtitle: "",
				counter: 1
			}];
			
			this._mModel = new JSONModel();
			this._mModel.setData(aMessages);
			this._oMessagePopover.setModel(this._mModel);
			
		},

		onListSelectionChange: function(oEvent) {
			var sPath = oEvent.getParameter("listItem").getBindingContext().sPath;
			var header = this.byId("orderHeader");
			header.bindElement(sPath);
			var infoForm = this.byId("infoForm");
			infoForm.bindElement(sPath);
		},

		priorityFormatter: function(prior) {
			if (prior === "High") {
				//return "Error";
				return sap.ui.core.ValueState.Error;
			} else if (prior === "Medium") {
				//return "Warning";
				return sap.ui.core.ValueState.Warning;
			} else if (prior === "Low") {
				//return "Success";
				return sap.ui.core.ValueState.Success;
			} else {
				//return "None";
				return sap.ui.core.ValueState.None;
			}
		},

		handleMessagePopoverPress: function(oEvent) {
			this._oMessagePopover.toggle(oEvent.getSource());
		},
		
		performSafetyCheck: function(evt) {
		   this._safetyCheck = true;	
		},
		
		onStart: function() {
			
		}

	});
});