/* Node Helper */

/* Magic Mirror
 * Module: Alarm
 *
 * By Stephan Spies http://stephan-spies.de
 * MIT Licensed.
 */

const fs= require("fs");
const moment = require("moment");
const NodeHelper = require("node_helper");
const request = require("request");
const say = require("say");
const googleMapsClient = require("@google/maps");

const alarmPlayer = require("./player");

module.exports = NodeHelper.create({

    config: {},
    alarmTimer: null,
    snoozeTimer: null,
    trafficDelay: 0,
    status: "idle",
    currentAlarm: null,
    player: null,
    wheather: {
        apiVersion: "2.5",
        apiBase: "https://api.openweathermap.org/data/",
        weatherEndpoint: "forecast",
    },
    blockedAlarms: [],

    start: function() {
        // Set status
        this.status = "idle";
        // Set locale
        moment.locale(config.language);
        this.log("Starting node_helper module for " + this.name, "debug");
    },

    log: function (msg, type) {
        if  (type === this.config.logLevel ||
            (type === "error") ||
            (type === "warning" && this.config.logLevel === "debug"))
            console.log(this.name + " " + type + ": " + moment().format("DD.MM.YYYY HH:mm:ss") + " - " + msg);
    },

    setAlarmTimer: function (alarmMins, alarmData) {
        var self = this;
        this.unsetAlarmTimer();
        var sec = alarmMins * 60 - moment().format("s");

        this.alarmTimer = setTimeout(function() {
            // callback
            self.executeAlarm(alarmData);
        }, sec * 1000);

        this.log("Next alarm defined -" + alarmData["name"] + "- for " +
            moment().add(sec, "s").format("dddd DD.MM.YYYY HH:mm:ss"), "debug");

        if (alarmData["traffic"]["destinationAddress"] !== ""){
            this.setTrafficDelay (alarmData);
        }
    },

    unsetAlarmTimer: function () {
        clearTimeout(this.alarmTimer);
        this.alarmTimer = null;
    },

    executeAlarm: function (alarm) {
        var self = this;
        this.log("Alarm hase been fired: " + alarm["name"], "debug");

        this.status = "alarm";
        this.currentAlarm = alarm;
        var dom = "";
        var title = "<div class=\"marquee\"><span class=\"bright medium\">\n" +
            "<i class=\"fa fa-music\" aria-hidden=\"true\"></i>&nbsp;%TEXT%</span></div>";

        // Start Alarm Music
        if (alarm["sound"] && alarm["sound"]["file"].length > 0 ) {
            this.player = new alarmPlayer(this.config.musicFolder);
            this.player.play(alarm["sound"], (txt) => {
                title = title.replace("%TEXT%", txt);
                if (alarm["snooze"] > 0 ) {
                    dom = this.createSnoozeButton() + "<br />" + this.createOffSlider()+ "<br />" + title;
                } else {
                    dom = this.createOffSlider()+ "<br />" + title;
                }
                self.sendSocketNotification("PLAYER-REMOVE", null);
                self.sendSocketNotification("DATA", dom);
            });
        }
    },

    socketNotificationReceived: function(notification, payload) {
        if(notification === "START"){
            this.config = payload;

            this.readData();
            setInterval(() => {
                this.readData();
            }, this.config.updateInterval);

        } else if (notification === "SNOOZE"){
            this.status = "snooze";
            if (this.player)
                this.player.stop( () => {
                    this.log("We are on snooze now. Great!", "debug");
                    //Play Greating
                    this.playGreating();
                });

            this.sendSocketNotification("DATA", this.createSnoozeTimer(this.currentAlarm));

        } else if (notification === "OFF") {
            this.status = "idle";
            if (this.player)
                this.player.stop( () => {
                    //-> nothing to do here
                });
            this.unsetAlarmTimer();
            this.unsetSnoozeTimer();
            this.log("We are off now. Cheers!", "debug");

            /* disable alarm, if type single */
            if (this.currentAlarm["type"] === "s") {
                this.disableSingleAlarm (this.currentAlarm["name"]);
            }

            //-> we need a sleeping second to finish the transition animation
            /* @fixme: Find a better solution than a sleep */
            this.sleep(1);

            //check if alarm is in future and only fired due to traffic delay
            let origAlarmTime = moment(this.currentAlarm["time"], "HH:mm");
            if (origAlarmTime.isAfter(moment())) {
                this.log("We have to block alarm " + this.currentAlarm["name"] + " till "
                    + this.currentAlarm["time"], "debug");

                let sDelTime = origAlarmTime.diff(moment(), "seconds") + 60;
                let blockedAlarm = this.currentAlarm["name"];
                this.blockedAlarms.push(blockedAlarm);

                //and shedule the time to remove it
                setTimeout(()=> {
                    this.blockedAlarms.splice(this.blockedAlarms.indexOf(blockedAlarm),1);
                    this.log("Unblocked Alarm " + blockedAlarm , "debug");
                }, sDelTime * 1000, blockedAlarm)
            }

            this.currentAlarm = null;
            this.readData();

        } else if (notification === "ALARM") {
            this.log("Snooze time off, start Alarm", "debug");
            this.executeAlarm(this.currentAlarm);
        }
    },

    createSnoozeButton: function () {
        return  "<button class='snooze medium bright' " +
                "onclick='MM.getModules()[5]._socket.sendNotification(\"SNOOZE\", \"null\")'>\n" +
                "<i class=\"fa fa-bed\" aria-hidden=\"true\"></i>\n" +
                "</button>";
        /* @fixme MM.getModules()[5] -> should be MM.getModulesByName('alarm') in main.js */
    },

    sleep: function (seconds) {
        var waitTill = new Date(new Date().getTime() + seconds * 1000);
        while(waitTill > new Date()){};
    },

    createSnoozeTimer: function (alarm) {
        var sec = alarm["snooze"] * 60;
        var timeleft = sec;

        this.snoozeTimer = setInterval(() => {
            this.sendSocketNotification("PROGRESS", sec - --timeleft);
            if(timeleft <= 0) {
                clearInterval(this.snoozeTimer);
                this.executeAlarm(alarm);
            }
        }, 1000);

        return  "<span class='light small bright'>\n" +
                "<i class=\"fa fa-bed\" aria-hidden=\"true\"></i>\n" +
                "</span><br />" +
                "<progress class='light small bright' value='0' max='" + sec + "' id='progressBar'></progress><br />\n"+
                this.createOffSlider();
    },

    unsetSnoozeTimer: function () {
        clearTimeout(this.snoozeTimer);
        this.snoozeTimer = null;
    },

    createOffSlider: function () {
        return  "<label class='switch'>" +
                "<input type='checkbox' " +
                "onchange='MM.getModules()[5]._socket.sendNotification(\"OFF\", \"this\")'>\n"+
                "<span id='offSlider' class='slider light bright round small'>\n" +
                "<i class=\"fa fa-power-off\" aria-hidden=\"true\"></i>" +
                "</span></label>";
        /* @fixme MM.getModules()[5] -> should be MM.getModulesByName('alarm') in main.js */
    },

    readData: function() {
        if (this.status === "idle") {
            //read alarm json data
            fs.readFile(__dirname + "/" + this.config.dataFile, "utf8", (err, data) => {
                if (err) throw err;
                this.sendSocketNotification("DATA", this.setNextAlarm(JSON.parse(data)));
            });
        }
    },

    setNextAlarm: function (alarms) {
        var self = this;

        var now = moment().startOf("minute");
        if (this.config.timezone)
            now.tz(this.config.timezone);
        this.log("Checking for new Alarms now", "debug");

        if (alarms.isEmpty) {
            this.log("No Alarm found", "warning");
            return this.config.emptyAlarm;
        }

        var nextAlarmMins = 0;
        var nextAlarmVals = null;
        var blocklist = this.blockedAlarms.slice();

        alarms.forEach( function (alarm) {
            if (alarm["active"] === "1" && blocklist.indexOf(alarm["name"]) === -1 ) {

                var alarmTime = moment(alarm["time"], "HH:mm");
                var inMins = alarmTime.diff(now, "minutes");

                switch (alarm["type"])
                {
                    case "c":
                        var str_alarmdays = alarm["days"];
                        var alarmdays = str_alarmdays.split(",");

                        if(! alarms.isEmpty) {
                            //Is there an alarm today?
                            if ( alarmdays.indexOf(now.format("dd")) > -1 && inMins >= 0  ) {
                                if (inMins < nextAlarmMins || nextAlarmMins === 0 ) {
                                    nextAlarmMins = inMins;
                                    nextAlarmVals = alarm;
                                }
                            } else {
                                //Not today, but maybe another one
                                for (var i = 1; i < 7; i++){
                                    var newDay = moment().add(i, "d");
                                    if ( alarmdays.indexOf(newDay.format("dd")) > -1 ) {
                                        if (inMins < nextAlarmMins || nextAlarmMins === 0) {
                                            nextAlarmMins =  i * 24 * 60 + inMins;
                                            nextAlarmVals = alarm;
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                        break;
                    case "d":
                    case "s":
                        if ( inMins < 0 ) {
                            inMins = 24 * 60 + inMins;
                        }
                        if (inMins < nextAlarmMins || nextAlarmMins === 0 ) {
                            nextAlarmMins = inMins;
                            nextAlarmVals = alarm;
                        }
                        break;
                    case "w":
                        //Arbeitstage sind 1 mit 5
                        if ( now.isoWeekday() >= 0 &&  now.weekday() < 4 ) {
                            //Montag bis Donnerstag
                            if ( inMins < 0 ) {
                                inMins = 24 * 60 + inMins;
                            }
                        } else if ( now.isoWeekday() === 5 ) {
                            //Freitag
                            if ( inMins < 0 ) {
                                inMins = 3 * 24 * 60 + inMins;
                            }
                        } else if ( now.isoWeekday() === 6 ) {
                            //Samstag
                            inMins = 2 * 24 * 60 + inMins;
                        } else if ( now.isoWeekday() === 7 ) {
                            //Sonntag
                            inMins = 24 * 60 + inMins;
                        }
                        if (inMins < nextAlarmMins || nextAlarmMins === 0 ) {
                            nextAlarmMins = inMins;
                            nextAlarmVals = alarm;
                        }
                        break;
                }
            }
        });

        if ( nextAlarmVals === null ) {
            this.log("No Alarm defined", "warning");
            this.unsetAlarmTimer();
            return this.config.emptyAlarm;
        }

        var nextAlarm = moment().startOf("minute");

        let trafficIcon = "";
        //-> respect traffic delay, but avoid to get a negative value
        if ( this.trafficDelay > 0 && nextAlarmMins > this.trafficDelay ) {
            nextAlarmMins = nextAlarmMins - this.trafficDelay;
            trafficIcon = "&nbsp;<i class=\"fa fa-car\" aria-hidden=\"true\"></i><sup>" + this.trafficDelay + "</sup>";
        }

        nextAlarm.add(nextAlarmMins, "m").startOf("minute");

        //Set Timeout
        if (nextAlarmMins > 0) {
            this.setAlarmTimer(nextAlarmMins, nextAlarmVals);
        } else {
            this.unsetAlarmTimer();
            return "";
        }

        //Display Output
        if ( nextAlarm.isSame(now, "day") ){
            return "Nächster Alarm (" + nextAlarmVals["name"] + "):<br />" +
                "<span class=\"bright\">Heute " + nextAlarm.format("HH:mm")+ " Uhr" + trafficIcon +"</span>";
        }
        return "Nächster Alarm (" + nextAlarmVals["name"] + "):<br />" +
            "<span class=\"bright\">" + nextAlarm.format("dddd HH:mm") + " Uhr" + trafficIcon +"</span>";
    },

    speak: function (msg) {
        const voice = "";

        say.speak(msg, voice, 1.0, (err) => {
            if (err) {
                this.log("Error on Text-to-Speech: " + err, "error");
            }
            this.log("Message spoken: " + msg, "debug");
        });
    },

    playGreating: function () {
        var msg = "";
        if (this.config["greating"].length > 0) {
            var hour = moment().format("HH");
            if (hour < 12 ) {
                msg += "Guten Morgen";
            } else if (hour < 18 ) {
                msg += "Hallo";
            } else {
                msg += "Guten Abend";
            }
            msg += " " + this.config.greating + ", es ist " + moment().format("dddd") + " der " +
                moment().format("Mo MMMM YYYY") + ", " +
                moment().format("k") + " Uhr " + moment().format("m")+ ", ";
        }

        this.getWheatherForecast( (err, weatherInfo) => {
            if (err !== null)
                this.log (err, "error");
            msg += weatherInfo;

            this.getTrafficForecast(this.currentAlarm, (err, trafficInfo) => {
                if (err) {
                    this.log(err, "error");
                } else {
                    msg += trafficInfo;
                }
                this.speak(msg);
            });
        });


    },

    getWheatherForecast: function (callback) {
        if (!this.config.weatherforecast || !this.config.weatherforecast.appid || this.config.weatherforecast.appid === "") {
            callback("Weather Forecast: APPID not set!", "");
            return;
        }
        var url = this.wheather.apiBase + this.wheather.apiVersion + "/" + this.wheather.weatherEndpoint;
        url += "?id=" + this.config.weatherforecast.locationID;
        url += "&units=" + config.units;
        url += "&lang=" + config.language;
        url += "&APPID=" + this.config.weatherforecast.appid;
        this.log("Checking current wheather with URL: " + url, "debug");
        var txt = "";

        request.get(url, (error, response, body) => {
            if (response.statusCode === 200) {
                try {
                    var forecast = JSON.parse(body);
                    var data = forecast.list[1];
                    txt += "die Wettervorhersage für " + this.config.weatherforecast.location + " ";
                    txt += "bis " + moment(data.dt, "X").format("k") + " Uhr: ";
                    txt += data.weather[0].description + ", ";
                    if (this.roundValue(data.main.temp_min, 0) === this.roundValue(data.main.temp_max, 0)) {
                        txt += "Die Temperatur liegt um " + this.roundValue(data.main.temp_min, 0) + " Grad. ";
                    } else {
                        txt += "Die Temperatur liegt zwischen: " + this.roundValue(data.main.temp_min, 0) + " und "
                            + this.roundValue(data.main.temp_max, 0) + " Grad. ";
                    }
                    //txt += "Luftfeuchtigkeit: " + this.roundValue(data.main.humidity, 0) + " Prozent. ";
                    //fuzzi logic the wind, measured in m/sec
                    var wnd = "";
                    if (data.wind.speed > 5 ) {
                        wnd = "Wir haben leichten Wind. ";
                    } else if (data.wind.speed > 10) {
                        wnd = "Wir haben starken Wind. ";
                    } else if (data.wind.speed > 20) {
                        wnd = "Wir haben Sturm. ";
                    }  else if (data.wind.speed > 30) {
                        wnd = "Wir haben einen Orkan. ";
                    }
                    txt += wnd;
                    /*
                    if (Object.keys(data.clouds).length > 0)
                        txt += "Bewölkung: " + this.roundValue(data.clouds.all, 0) + " Prozent. ";
                    */
                    //fuzzi logic the rain, measured in mm/h during last 3h
                    if (data.rain && Object.keys(data.rain).length > 0) {
                        var rain = "";
                        if (data.rain["3h"] > 0 ) {
                            rain = "Es wird leicht regnen. ";
                        } else if (data.rain["3h"]> 5) {
                            rain = "Es wird regnen. ";
                        } else if (data.rain["3h"] > 15) {
                            rain = "Es wird stark regnen. ";
                        }  else if (data.rain["3h"] > 30) {
                            rain = "Es wird sehr stark regnen. ";
                        }
                        txt += rain;
                    }

                    if (data.snow && Object.keys(data.snow).length > 0)
                        if (data.snow["3h"] < 1 ) {
                            txt += "Leichter Schneefall. "
                        } else {
                            txt += "Schneefall: " + this.roundValue(data.snow["3h"], 0) + " Millimeter. ";
                        }
                    callback(null, txt);
                }
                catch (err){
                    callback("Error catched " + err, "");
                }

            } else if (response.statusCode === 401) {
                callback("Incorrect APPID", "");
            } else {
                callback("Could not load weather " + error, "");
            }
        });
    },

    roundValue: function(val, dec) {
        return parseFloat(val).toFixed(dec);
    },

    getTrafficForecastData: function (alarm, callback){
        if (!alarm) {
            return callback("No Alarm set!");
        }
        if (!this.config.trafficforecast || !this.config.trafficforecast.apikey || this.config.trafficforecast.apikey === "") {
            return callback("Traffic Forecast: Google ApiID not set!");
        }
        if (this.config.trafficforecast.originAddress === "" || alarm["traffic"]["destinationAddress"] === "") {
            return callback("No origin or destination address set for traffic forecast");
        }
        this.getGeocode(this.config.trafficforecast.originAddress, (err, response) => {
            if (err) {
                return callback(err);
            }
            var origin = response;
            this.getGeocode(alarm["traffic"]["destinationAddress"], (err, response) => {
                if (err) {
                    return callback(err);
                }
                var destination = response;
                if (origin && destination) {
                    this.getDirection(origin, destination, alarm, (err, response) => {
                        if (err) {
                            return callback(err);
                        }
                        return callback(null, response);
                    });
                };
            });
            if (err) {
                return callback(err);
            }
        });
    },

    getTrafficForecast: function (alarm, callback){
        this.getTrafficForecastData(alarm, (err, data) => {
            if (err) {
                return callback(err);
            } else {
                return callback(null, "Die geschätzte Fahrzeit beträgt heute: " + data.legs[0].duration_in_traffic.text +
                    ", über die " + data.summary + " ");
            }
        })
    },


    setTrafficDelay: function (alarm) {
        this.getTrafficForecastData(alarm, (err, data) => {
            if (err) {
                this.trafficDelay = 0;
                this.log (err, "error" );
            } else {
                let traf = data.legs[0].duration_in_traffic.value;
                let reg = data.legs[0].duration.value;
                if (traf > 0 && reg > 0 ) {
                    let delay = this.roundValue((traf - reg) / 60, 0);
                    if (delay > 0) {
                        this.trafficDelay = delay;
                        this.log ("Houston, we have a delay of " + delay + " mins", "debug" );
                    } else {
                        this.trafficDelay = 0;
                        this.log ("No current traffic delay", "debug" );
                    }
                } else {
                    this.trafficDelay = 0;
                    this.log ("No valid traffic data received", "warning" );
                }
            }
        })
    },


    getGeocode: function (address, callback) {
        var geocodeClient = googleMapsClient.createClient({
            key: this.config.trafficforecast.apikey,
            language: config.language
        });
        geocodeClient.geocode({
            address: address
        }, function (err, response) {
            if (!err && response.json.status === "OK") {
                return callback (null, response.json.results[0].geometry.location);
            } else {
                return callback("Failed to get Geo-Code: " + err);
            }
        })
    },

    getDirection: function (origin, destination, alarm, callback) {
        var directionClient = googleMapsClient.createClient({
            key: this.config.trafficforecast.apikey,
            language: config.language
        });
        directionClient.directions({
            origin: origin,
            destination: destination,
            mode: alarm["traffic"]["mode"],
            departure_time: moment.now()
        }, function (err, response) {
            if (!err && response.json.status === "OK") {
                return callback (null, response.json.routes[0]);
            } else {
                return callback(err.json.error_message);
            }
        })
    },

    disableSingleAlarm: function (alarmName) {
        //read alarm json data
        fs.readFile(__dirname + "/" + this.config.dataFile, "utf8", (err, data) => {
            if (err)
                this.log(err, "error");
            var alarms = {
                table: []
            };
            alarms = JSON.parse(data);
            //-> find Single Alarm and disable
            alarms.forEach( function (alarm) {
                if (alarm["type"] === "s" && alarm["name"] === alarmName) {
                    alarm["active"] = "0";
                }
            });
            var json = JSON.stringify(alarms, null, 2);
            fs.writeFile(__dirname + "/" + this.config.dataFile, json, "utf8", (err) => {
                if (err)
                    this.log(err, "error");
                this.log("Successfull disabled Single Alarm " + alarmName , "debug");
            });
        });
    }
});