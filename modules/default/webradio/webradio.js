/* global Module */

/* SmartAlarmPi
 * Module: Webradio
 *
 * By Stephan Spies http://stephan-spies.de
 * MIT Licensed.
 */

Module.register("webradio",{

	// Default module config.
	defaults: {
		text: "...loading web radio stations...",
        dataFile: "webradios.json",
        wrapperID : "webradio",
        logLevel : "debug",
        emptyRadio : "Keine Radiostationen gefunden"
	},

	// Override dom generator.
	getDom: function() {
		let wrapper = document.createElement("div");
        wrapper.className = "normal medium";
        wrapper.id = this.config.wrapperID;
		wrapper.innerHTML = this.config.text;
		return wrapper;
	},

    updateDom: function () {
        let wrapper = document.getElementById(this.config.wrapperID);
        wrapper.innerHTML = this.data;
    },

    getStyles: function () {
        return ["font-awesome.css"];
    },

    // Define required translations.
    getTranslations: function () {
        // The translations for the default modules are defined in the core translation files.
        // Therefor we can just return false. Otherwise we should have returned a dictionary.
        // If you're trying to build your own module including translations, check out the documentation.
        return false;
    },

    // Define required scripts.
    getScripts: function() {
        return ["moment.js", "moment-timezone.js"];
    },

    start: function() {
        this.sendSocketNotification("START", this.config);
        let self = this;

    },

    socketNotificationReceived: function(notification, payload) {
        if(notification === "DATA"){
            this.data = payload;
            this.updateDom();
        }
    }
});
