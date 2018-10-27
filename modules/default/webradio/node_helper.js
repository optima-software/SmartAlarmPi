/* SmartAlarmPi
 * Module: Webradio
 *
 * By Stephan Spies http://stephan-spies.de
 * MIT Licensed.
 */

const fs= require("fs");
const moment = require("moment");
const NodeHelper = require("node_helper");
const radioPlayer = require("../alarm/player");


module.exports = NodeHelper.create({

    config: {},
    btnPrefix: "radio-",
    jsonData: null,
    player: null,

    start: function() {
        // Set status
        this.status = "idle";
        // Set locale
        moment.locale(config.language);
    },

    log: function (msg, type) {
        if  (type === this.config.logLevel ||
            (type === "error") ||
            (type === "warning" && this.config.logLevel === "debug"))
            console.log(this.name + " " + type + ": " + moment().format("DD.MM.YYYY HH:mm:ss") + " - " + msg);
    },

    socketNotificationReceived: function(notification, payload) {
        if(notification === "START"){
            this.config = payload;
            this.status = "idle";
            this.readData();
            this.log("Received START Signal", "debug");
        } else if (notification === "PLAY"){
            this.startPlayer(payload);
            this.log("Received PLAY Signal for Radio-ID " + payload, "debug");
        } else if (notification === "STOP") {
            this.stopPlayer();
            this.log("Received STOP Signal", "debug");
        }
    },

    startPlayer: function (stationID) {
        this.stopPlayer();
        let currentStation = this.findRadioByID(stationID);
        if (Object.keys(currentStation).length > 0) {
            this.player = new radioPlayer();
            let stream  = [];
            stream['file'] = currentStation["url"];
            stream['text'] = currentStation["title"];
            this.player.play(stream, (txt) => {
                this.status = "play";
                this.log("We play webradio " + txt + " " + stream['file'], "debug");
                //add text to dom of alarm-module
            });

        } else {
            this.log("Web-Radio Station with ID " + stationID + " not found.", "error");
        }
    },

    stopPlayer: function () {
        if (this.player !== null) {
            this.player.stop( () => {
                this.player = null;
                this.status = "idle";
                this.log("Received Stop Signal for player", "debug");
            });
        }
    },

    readData: function() {
        //read webradio json data
        fs.readFile(__dirname + "/" + this.config.dataFile, "utf8", (err, data) => {
            if (err) throw err;

            //this.rewriteData(JSON.parse(data));

            this.jsonData = JSON.parse(data);
            this.sendSocketNotification("DATA", this.parseData(this.jsonData));
        });
    },

    parseData: function (radios) {
        let radioTable  = "<ul>";
        if (radios.isEmpty) {
            this.log("No Radio-Stations found in file " + this.config.dataFile, "warning");
            radioTable += "<li>" + this.config.emptyRadio + "</li>";
        } else {
            let prefix = this.btnPrefix;
            radios.forEach( function (radio) {
                radioTable += "<li><button class='medium normal radiobtn' " +
                    "id='" + prefix + radio["id"] +"' " +
                    "onclick='MM.getModules()[6]._socket.sendNotification(\"PLAY\", \"" + radio["id"] +"\")'>\n" +
                    radio["title"] + "</button></li>"
            })
        }
        radioTable += "</ul>";
        return radioTable;
    },

    findRadioByID: function (id) {
        let staion = [];
        if ( this.jsonData === null ) {
            this.log("ID not found in Radio-List", "error");
        } else {
            for (var radio of this.jsonData) {
                if (radio["id"] == id ) {
                    staion = radio;
                    break;
                }
            }
        }
        return staion;
    },
    /*
    rewriteData: function (radios) {
        let obj = [];
        let i = 0;
        radios.forEach( function (radio) {
            if ( radio["title"] !== "")  {
                obj.push({id: i, url:radio["url"], title:radio["title"], format:radio["format"]});
                i++;
            }
        });
        obj.sort(function(a, b) { return a.title > b.title});
        obj.sort(function(a, b) {
            var textA = a.title.toUpperCase();
            var textB = b.title.toUpperCase();
            return (textA < textB) ? -1 : (textA > textB) ? 1 : 0;
        });

        fs.writeFile(__dirname + "/" + 'webradios-new.json', JSON.stringify(obj, null, 4), 'utf8', function(err) {
            if (err) throw err;
            console.log('Json file complete');
        });
    }
    */
});