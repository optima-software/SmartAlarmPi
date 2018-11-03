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
        headline: "WebRadio",
        dataFile: "webradios.json",
        wrapperID : "webradio",
        playWrapperID : "playerTxt",
        logLevel : "debug",
        emptyRadio : "Keine Radiostationen gefunden"
	},

	// Override dom generator.
	getDom: function() {
		let wrapper = document.createElement("div");
        let headline  = document.createElement("div");
        let content = document.createElement("div");

        headline.innerHTML = this.config.headline;
        headline.className = "time bright xlarge light radiohl";
        wrapper.appendChild(headline);

        content.className = "normal";
        content.id = this.config.wrapperID;
        content.innerHTML = this.config.text;
        wrapper.appendChild(content);

		return wrapper;
	},

    updateDom: function (id, data) {
        let wrapper = document.getElementById(id);
        wrapper.innerHTML = data;
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
        this.config["moduleID"] = this.data.index;
	    this.sendSocketNotification("START", this.config);
        let self = this;

    },

    socketNotificationReceived: function(notification, payload) {
        if(notification === "DATA"){
            this.updateDom(this.config.wrapperID, payload);
        }
        if(notification === "PLAY"){
            this.updateDom(this.config.playWrapperID, payload);
        }
    }
});
