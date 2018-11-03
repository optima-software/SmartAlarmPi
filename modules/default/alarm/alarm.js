/* global Module */

/* Magic Mirror
 * Module: Alarm
 *
 * By Stephan Spies http://stephan-spies.de
 * MIT Licensed.
 */

Module.register("alarm",{

	// Default module config.
	defaults: {
		dataFile: "alarms.json",
        wrapperID : "alarm",
        emptyAlarm : "Kein Alarm eingestellt",
        updateInterval: 15 * 60 * 1000, //reads the file every 15 min
        logLevel : "debug",
        musicFolder : "/music/",
        greating : "Meister",
	},

	// Override dom generator.
	getDom: function() {
		var wrapper = document.createElement("div");
		wrapper.className = "normal medium";
		wrapper.id = this.config.wrapperID;
        /*
		if(this.dataFile){
            wrapper.innerHTML = this.dataFile;
        } else {
            wrapper.innerHTML = this.config.text;
        }
        */
		return wrapper;
	},

    updateDom: function () {
        var wrapper = document.getElementById(this.config.wrapperID);
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
        this.config["moduleID"] = this.data.index;
	    this.sendSocketNotification("START", this.config);

	    var self = this;
        setInterval(function() {
            self.updateDom(); // no speed defined, so it updates instantly.
        }, 60 * 1000); //perform every Minute.

	},

    socketNotificationReceived: function(notification, payload) {
        if(notification === "DATA"){
            this.data = payload;
            this.updateDom();
        }
        if(notification === "PROGRESS"){
            this.updateProgressBar(payload);
        }
        if(notification === "PLAYER-REMOVE"){
            this.removePlayerText();
        }
    },

    updateProgressBar:function (value) {
        var progressBar = document.getElementById("progressBar");
        if (!progressBar.undefined) {
            progressBar.value = value;
        }
    },

    removePlayerText: function () {
	    var player = document.getElementById("playerTxt");
	    player.innerHTML = "";
    }

});
