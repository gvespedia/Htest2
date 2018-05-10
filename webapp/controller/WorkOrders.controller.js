sap.ui.define([
	"jquery.sap.global",
	"sap/m/MessageToast",
	"sap/ui/core/Fragment",
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/Filter",
	"sap/ui/model/json/JSONModel",
	"sap/ui/vk/ContentResource",
	"sap/suite/ui/commons/networkgraph/layout/LayeredLayout",
	"sap/suite/ui/commons/networkgraph/layout/ForceBasedLayout",
	"sap/suite/ui/commons/networkgraph/ActionButton",
	"sap/suite/ui/commons/networkgraph/Node",
	"sap/suite/ui/commons/library"
], function(jQuery, MessageToast, Fragment, Controller, Filter, JSONModel) {
	"use strict";

	return Controller.extend("com.gv.hackathon.Hackathon5.controller.WorkOrders", {
		_safetyCheck: false,
		_viewerContentResource: null,
		STARTING_PROFILE: "9878787",
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

			this.byId("viewer").setVisible(false);
			this.manageDetailToolbar("None");
		},

		onListSelectionChange: function(oEvent) {
			var sPath = oEvent.getParameter("listItem").getBindingContext().sPath;
			var header = this.byId("orderHeader");
			header.bindElement(sPath);
			var infoForm = this.byId("infoForm");
			infoForm.bindElement(sPath);
			var taskTab = this.byId("operationsTable");
			taskTab.bindElement(sPath);
			var componentsTab = this.byId("componentsTable");
			componentsTab.bindElement(sPath);

			var viewer = this.byId("viewer");
			viewer.destroyContentResources();

			if (sPath !== "") {
				var status = this._woModel.getProperty(sPath).Status;
				this.manageDetailToolbar(status);
				var vdsFile = this._woModel.getProperty(sPath).Vds;
				this.manageViewer(vdsFile);
			} else {
				this._viewerContentResource = null;
				this.manageDetailToolbar("None");
			}

			var key = this.byId("iconTabBar").getSelectedKey();
			if (key === "viewer") {
				this.loadModelIntoViewer();
			}
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
			this._oMessagePopover.destroyItems();
			this._oMessagePopover.close();
			this._safetyCheck = true;
			this.getView().byId("popoverButton").setText("");
			this.getView().byId("popoverButton").setVisible(false);
			sap.m.MessageToast.show("Safety measures check successful");
		},

		onStart: function() {
			var selItem = this.getView().byId("masterList").getSelectedItems();
			if (selItem.length < 1) {
				sap.m.MessageToast.show("Select an order");
			} else if (!this._safetyCheck) {
				sap.m.MessageBox.error(
					"You have not yet performed the safety measures check. \n" +
					"Perform the check to start working on orders.", {
						actions: ["Perform Check", sap.m.MessageBox.Action.CLOSE],
						styleClass: "sapUiSizeCompact",
						onClose: function(sAction) {
							if (sAction === "Perform Check") {
								this.performSafetyCheck();
							}
						}.bind(this)
					}
				);
			} else {
				sap.m.MessageToast.show("Order started");
				this.manageDetailToolbar("In Progress");
			}
		},

		onForward: function() {
			sap.m.MessageToast.show("Order forwarded");
			this.manageDetailToolbar("In Progress");
		},

		onHold: function() {
			sap.m.MessageToast.show("Order on hold");
		},

		onClose: function() {
			sap.m.MessageToast.show("Order closed");
		},

		manageDetailToolbar: function(status) {
			if (status === "In Progress") {
				this.getView().byId("holdButton").setVisible(true);
				this.getView().byId("closeButton").setVisible(true);
				this.getView().byId("startButton").setVisible(false);
				this.getView().byId("forwardButton").setVisible(false);
			} else if (status === "Open") {
				this.getView().byId("holdButton").setVisible(false);
				this.getView().byId("closeButton").setVisible(false);
				this.getView().byId("startButton").setVisible(true);
				this.getView().byId("forwardButton").setVisible(true);
			} else if (status === "None") {
				this.getView().byId("holdButton").setVisible(false);
				this.getView().byId("closeButton").setVisible(false);
				this.getView().byId("startButton").setVisible(false);
				this.getView().byId("forwardButton").setVisible(false);

			}
		},

		manageViewer: function(file) {
			if (file !== "") {
				this.byId("viewer").setVisible(true);
				this.byId("vdsMessageStrip").setVisible(false);
				this._viewerContentResource = new sap.ui.vk.ContentResource({
					source: "mockData/vds/" + file,
					sourceType: "vds",
					sourceId: "abc"

				});
			} else {
				this._viewerContentResource = null;
				this.byId("viewer").setVisible(false);
				this.byId("vdsMessageStrip").setVisible(true);
			}
		},

		onTabSelectChanged: function(oEvent) {
			var key = oEvent.getParameters().key;
			if (key === "viewer") {
				this.loadModelIntoViewer();
			}
		},

		loadModelIntoViewer: function() {
			if (this._viewerContentResource) {
				this.byId("viewer").addContentResource(this._viewerContentResource);
			}
		}

	});
});