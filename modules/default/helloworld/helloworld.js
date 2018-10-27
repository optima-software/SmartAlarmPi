/* global Module */

/* Magic Mirror
 * Module: HelloWorld
 *
 * By Michael Teeuw http://michaelteeuw.nl
 * MIT Licensed.
 */

Module.register("helloworld",{

	// Default module config.
	defaults: {
		text: "Hello World!",
        wrapperID: "playerTxt"
	},

	// Override dom generator.
	getDom: function() {
		var wrapper = document.createElement("div");
        wrapper.id = this.config.wrapperID;
		wrapper.innerHTML = this.config.text;
		return wrapper;
	}
});
