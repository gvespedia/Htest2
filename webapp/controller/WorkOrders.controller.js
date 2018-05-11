sap.ui.define([
	"jquery.sap.global",
	"sap/m/MessageToast",
	"sap/ui/core/Fragment",
	"sap/ui/core/mvc/Controller",
	"sap/ui/model/Filter",
	"sap/ui/model/json/JSONModel",
	"com/gv/hackathon/Hackathon5/model/service/AICheckService",
	"sap/ui/vk/ContentResource",
	"sap/suite/ui/commons/networkgraph/layout/LayeredLayout",
	"sap/suite/ui/commons/networkgraph/layout/ForceBasedLayout",
	"sap/suite/ui/commons/networkgraph/ActionButton",
	"sap/suite/ui/commons/networkgraph/Node",
	"sap/suite/ui/commons/library"
], function(jQuery, MessageToast, Fragment, Controller, Filter, JSONModel, aiCheck) {
	"use strict";

	return Controller.extend("com.gv.hackathon.Hackathon5.controller.WorkOrders", {
		_safetyCheck: false,
		_viewerContentResource: null,
		STARTING_PROFILE: "9878787",

		onInit: function() {

			///////////////////////////
			//  Setup WorkOrders model

			this._woModel = new sap.ui.model.json.JSONModel("mockData/WOmasterList.json");
			this._woModel.setDefaultBindingMode(sap.ui.model.BindingMode.OneWay);
			this.getView().setModel(this._woModel);

			//  END Setup WorkOrders model
			///////////////////////////

			///////////////////////////
			//  Manage Safety Equipment Message

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

			//  END Manage Safety Equipment Message
			///////////////////////////

			///////////////////////////
			//  Manage Visibility

			this.byId("viewer").setVisible(false);
			this.manageDetailToolbar("None");

			//  END Manage Visibility
			///////////////////////////

			///////////////////////////
			// Setup for NetworkGraph
			this.byId("graph").setVisible(false);

			this._sTopParent = this.STARTING_PROFILE;
			this._mExplored = [this._sTopParent];
			this._graph = this.getView().byId("graph");

			this._graph.attachEvent("beforeLayouting", function(oEvent) {
				// nodes are not rendered yet (bOutput === false) so their invalidation triggers parent (graph) invalidation
				// which results in multiple unnecessary loading
				this._graph.preventInvalidation(true);
				this._graph.getNodes().forEach(function(oNode) {

					//oNode.attachPress(this.onNodePress, this);

					var oExpandButton, oDetailButton, oUpOneLevelButton,
						sIsParent = this._getCustomDataValue(oNode, "is-parent"),
						sParent;

					oNode.removeAllActionButtons();

					if (!sIsParent) {
						// employees without team - hide expand buttons
						oNode.setShowExpandButton(false);
					} else {
						if (this._mExplored.indexOf(oNode.getKey()) === -1) {

							// managers with team but not yet expanded
							// we create custom expand button with dynamic loading
							oNode.setShowExpandButton(false);

							// this renders icon marking collapse status
							oNode.setCollapsed(true);
							oExpandButton = new sap.suite.ui.commons.networkgraph.ActionButton({
								title: "Expand",
								icon: "sap-icon://sys-add",
								press: function() {
									oNode.setCollapsed(false);
									this._loadMore(oNode.getKey());
								}.bind(this)
							});
							oNode.addActionButton(oExpandButton);
						} else {
							// manager with already loaded data - default expand button
							oNode.setShowExpandButton(true);
						}
					}

					// add detail link -> custom popover
					oDetailButton = new sap.suite.ui.commons.networkgraph.ActionButton({
						title: "Detail",
						icon: "sap-icon://hint",
						press: function(oEvent) {
							this._openDetail(oNode, oEvent.getParameter("buttonElement"));
						}.bind(this)
					});
					oNode.addActionButton(oDetailButton);

					// if current equipment is root we can add 'up one level'
					if (oNode.getKey() === this._sTopParent) {
						sParent = this._getCustomDataValue(oNode, "parent");
						if (sParent) {
							oUpOneLevelButton = new sap.suite.ui.commons.networkgraph.ActionButton({
								title: "Up one level",
								icon: "sap-icon://arrow-top",
								press: function() {
									var aSuperVisors = oNode.getCustomData().filter(function(oData) {
											return oData.getKey() === "parent";
										}),
										sParent = aSuperVisors.length > 0 && aSuperVisors[0].getValue();

									this._loadMore(sParent);
									this._sTopParent = sParent;
								}.bind(this)
							});
							oNode.addActionButton(oUpOneLevelButton);
						}
					}
				}, this);
				this._graph.preventInvalidation(false);
			}.bind(this));

			// End Setup for NetworkGraph
			///////////////////////////
		},

		///////////////////////////
		//  Work Orders Master List

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
				var graph = this._woModel.getProperty(sPath).Graph;
				this.manageNetworkGraph(graph);
			} else {
				this._viewerContentResource = null;
				this.manageDetailToolbar("None");
			}

			var key = this.byId("iconTabBar").getSelectedKey();
			if (key === "viewer") {
				this.loadModelIntoViewer();
			}

			this.manageTabNumbers(sPath);
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

		//  END Work Orders Master List
		///////////////////////////

		///////////////////////////
		//  Manage Safety Check Message

		handleMessagePopoverPress: function(oEvent) {
			this._oMessagePopover.toggle(oEvent.getSource());
		},

		performSafetyCheck: function(evt) {
			this.aiCheckServiceCall();
			/*this._oMessagePopover.destroyItems();
			this._oMessagePopover.close();
			this._safetyCheck = true;
			this.getView().byId("popoverButton").setText("");
			this.getView().byId("popoverButton").setVisible(false);
			sap.m.MessageToast.show("Safety measures check successful");*/
		},
		_checkResult: "false",
		aiCheckServiceCall: function() {
			var success = function(oData) {
				if (oData.hasOwnProperty("ai_check")) {
					if (oData.ai_check === "true") {
						this._oMessagePopover.destroyItems();
						this._oMessagePopover.close();
						this._safetyCheck = true;
						this.getView().byId("popoverButton").setText("");
						this.getView().byId("popoverButton").setVisible(false);
						sap.m.MessageToast.show("Safety measures check successful");
					} else if (oData.ai_check === "false") {
						this._checkResult = "true";
						sap.m.MessageBox.error("The safety measures check failed. \n" +
							"Plase wear the required equipment and repeat the check.");
					}
				} else {
					sap.m.MessageBox.error("There was an issue with the safety check. \n" +
						"Please try again in a few minutes.");
				}
			}.bind(this);
			var error = function(err) {
				//console.log(err);
			}.bind(this);

			aiCheck.AICheckService.safetyMeasuresCheck(this._checkResult, success, error);
		},

		//  END Manage Safety Check Message
		///////////////////////////

		///////////////////////////
		//  Toolbar and Toolbar Buttons

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

		//  END Toolbar and Toolbar Buttons
		///////////////////////////

		///////////////////////////
		//	3D Viewer

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
		},

		//	END 3D Viewer
		///////////////////////////

		///////////////////////////
		//	Network Graph 

		manageNetworkGraph: function(name) {
			if (name.length > 0) {
				this.byId("graph").setVisible(true);
				this.byId("graphMessageStrip").setVisible(false);
				this._oModel = new sap.ui.model.json.JSONModel("mockData/" + name);
				this._oModel.setDefaultBindingMode(sap.ui.model.BindingMode.OneWay);
				this._graph.setModel(this._oModel);
				this._setFilter();
			} else {
				this.byId("graph").setVisible(false);
				this.byId("graphMessageStrip").setVisible(true);
			}
		},

		search: function(oEvent) {
			var sKey = oEvent.getParameter("key");
			if (sKey) {
				this._mExplored = [sKey];
				this._sTopParent = sKey;
				this._graph.destroyAllElements();
				this._setFilter();
				oEvent.bPreventDefault = true;
			}
		},

		suggest: function(oEvent) {
			var aSuggestionItems = [],
				aItems = this._oModel.getData().nodes,
				aFilteredItems = [],
				sTerm = oEvent.getParameter("term");
			sTerm = sTerm ? sTerm : "";
			aFilteredItems = aItems.filter(function(oItem) {
				var sTitle = oItem.title ? oItem.title : "";
				return sTitle.toLowerCase().indexOf(sTerm.toLowerCase()) !== -1;
			});
			aFilteredItems.sort(function(oItem1, oItem2) {
				var sTitle = oItem1.title ? oItem1.title : "";
				return sTitle.localeCompare(oItem2.title);
			}).forEach(function(oItem) {
				aSuggestionItems.push(new sap.m.SuggestionItem({
					key: oItem.id,
					text: oItem.title
				}));
			});
			this._graph.setSearchSuggestionItems(aSuggestionItems);
			oEvent.bPreventDefault = true;
		},

		onExit: function() {
			if (this._oQuickView) {
				this._oQuickView.destroy();
			}
		},

		_setFilter: function() {
			var aNodesCond = [],
				aLinesCond = [];
			var fnAddBossCondition = function(sBoss) {
				aNodesCond.push(new sap.ui.model.Filter({
					path: 'id',
					operator: sap.ui.model.FilterOperator.EQ,
					value1: sBoss
				}));
				aNodesCond.push(new sap.ui.model.Filter({
					path: 'parent',
					operator: sap.ui.model.FilterOperator.EQ,
					value1: sBoss
				}));
			};
			var fnAddLineCondition = function(sLine) {
				aLinesCond.push(new sap.ui.model.Filter({
					path: "from",
					operator: sap.ui.model.FilterOperator.EQ,
					value1: sLine
				}));
			};
			this._mExplored.forEach(function(oItem) {
				fnAddBossCondition(oItem);
				fnAddLineCondition(oItem);
			});
			this._graph.getBinding("nodes").filter(new sap.ui.model.Filter({
				filters: aNodesCond,
				and: false
			}));
			this._graph.getBinding("lines").filter(new sap.ui.model.Filter({
				filters: aLinesCond,
				and: false
			}));
		},

		_loadMore: function(sName) {
			this._graph.deselect();
			this._mExplored.push(sName);
			this._graph.destroyAllElements();
			this._setFilter();
		},

		_getCustomDataValue: function(oNode, sName) {
			var aItems = oNode.getCustomData().filter(function(oData) {
				return oData.getKey() === sName;
			});
			return aItems.length > 0 && aItems[0].getValue();
		},

		_openDetail: function(oNode, oButton) {
			if (!this._oQuickView) {
				this._oQuickView = sap.ui.xmlfragment("com.gv.hackathon.Hackathon5.view.Details", this);
			}
			this._oQuickView.setModel(new sap.ui.model.json.JSONModel({
				icon: oNode.getImage() && oNode.getImage().getProperty("src"),
				title: oNode.getDescription(),
				location: this._getCustomDataValue(oNode, "location"),
				itemDescription: this._getCustomDataValue(oNode, "description"),
				productionPlant: this._getCustomDataValue(oNode, "production-plant"),
				purchasePrice: this._getCustomDataValue(oNode, "purchase-price"),
				estimatedTol: this._getCustomDataValue(oNode, "estimated-tol"),
				status: this._getCustomDataValue(oNode, "status"),
				temperature: this._getCustomDataValue(oNode, "temperature")
			}));
			jQuery.sap.delayedCall(0, this, function() {
				this._oQuickView.openBy(oButton);
			});
		},

		linePress: function(oEvent) {
			oEvent.bPreventDefault = true;
		},

		//	END Network Graph 
		///////////////////////////

		///////////////////////////
		//	IconTab Numbers

		manageTabNumbers: function(sPath) {
			var selItem = this._woModel.getProperty(sPath);

			var tasksCount = selItem.Operations.length;
			tasksCount = tasksCount > 0 ? tasksCount + "" : "";
			var componentsCount = selItem.Components.length;
			componentsCount = componentsCount > 0 ? componentsCount + "" : "";
			var attachmentCount = selItem.Vds.length;
			attachmentCount = attachmentCount > 0 ? "1" : "";
			this.getView().byId("tasksTab").setCount(tasksCount);
			this.getView().byId("componentsTab").setCount(componentsCount);
			this.getView().byId("attachmentTab").setCount(attachmentCount);
		}

		//	END IconTab Numbers
		///////////////////////////
	});
});