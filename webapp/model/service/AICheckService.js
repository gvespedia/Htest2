sap.ui.define([], function() {
	"use strict";

	return {
		AICheckService: {
			_serverUrl: "/aiCheck", // We use the destination in neo-app.json //"http://alteviedatascience.westeurope.cloudapp.azure.com:5000",
			_checkTrue: "/ai_check_true",
			_checkFalse: "/ai_check_false",
			_check: "/ai_check",

			safetyMeasuresCheck: function(check, success, error) {
				
				var url = this._serverUrl;
				
				if (check === "true") {
					url = url + this._checkTrue;
				} else if (check === "false") {
					url = url + this._checkFalse;
				} else {
					url = url + this._check;
				}
				
				$.ajax({
					url: url,
					type: "GET",
					dataType: "json",
					context: this,
					success: success,
					error: error,
					async: false
				});
			},
		}
	};
});