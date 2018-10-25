/* Magic Mirror
 * Player for Module: Alarm
 *
 * By Stephan Spies http://stephan-spies.de
 * MIT Licensed.
 */
const request = require('request');
const fs= require("fs");
const moment = require("moment");
const mp3Player = require('stream-player');


var alarmPlayer = function (folder) {
    var self = this;
    this.logLevel = "debug";
    this.name = "alarm player";
    this.musicFolder = folder;
    this.mp3Player = null;

    //log with date and level
    this.log = function (msg, type) {
        if  (type === this.logLevel ||
            (type === "error") ||
            (type === "warning" && this.logLevel === "debug"))
            console.log(this.name + " " + type + ": " + moment().format("DD.MM.YYYY HH:mm:ss") + " - " + msg);
    };

    //play .mp3 or streams
    this.play = function (source, callback) {
        this.log("Triggered to play source: " + source["file"], "debug");

        //check if we have an m3u list
        if (source["file"].toString().indexOf(".m3u")> -1 ){
            this.extractM3U(source, (err, line) => {
                if (err) {
                    this.log(err, "error");
                    callback(err);
                } else {
                    this.mp3Play(line);
                    callback(source["text"]);
                }
            });
        } else {
            this.mp3Play(source["file"]);
            callback(source["text"]);
        }
    };

    this.mp3Play = function (file) {
        this.mp3Player = new mp3Player();
        //check if we have a mp3-file or a stream
        if (file.toString().indexOf("http://")> -1 ||
            file.toString().indexOf("https://")> -1 ){
            try {
                this.mp3Player.add(file);
                this.mp3Player
                    .on("play start", (() => {
                        this.log("Playlist stated", "debug");
                    }));
                this.mp3Player.play();
            }
            catch (err){
                this.log("Error catched " + err, "error");
            }
        } else {
            try {
                this.mp3Player.add(this.musicFolder + file);
                this.mp3Player
                    .on("play end", (() => {
                        this.log("End of Playlist", "warning");
                        this.mp3Player.add(this.musicFolder + file);
                    }))
                    .on("play start", (() => {
                        this.log("Playlist stated", "debug");
                    }));
                this.mp3Player.play();
            }
            catch (err){
                this.log("Error catched " + err, "error");
            }
        }
    }

    this.extractM3U = function (source, callback) {
        var dest = "tmp.m3u";
        var url = source["file"];
        var file = fs.createWriteStream(dest);

        var sendReq = request.get(url);

        // verify response code
        sendReq.on('response', function(response) {
            if (response.statusCode !== 200) {
                callback("Error on downloading m3u file: " + url + " - " + response.statusCode, null);
            }
        });

        // check for request errors
        sendReq.on('error', function (err) {
            fs.unlink(dest, ()=> {
                //-> nothing else
            });
            callback("Error on downloading m3u file: " + url + " - " + err.message, null);
        });

        sendReq.pipe(file);

        file.on('finish', function() {
            fs.readFile(file.path, "utf8", (err, data) => {
                if (err)
                    callback("Error catched on reading file " + err, null);
                var lines = data.split("\n");
                if (lines.length > 0 ) {
                    callback (null, lines[0]);
                } else {
                    callback ("No content found in file " + url, null);
                }
            });

            file.close(() => {
                fs.unlink(dest, ()=> {
                    //-> nothing else
                });
            });
        });

        file.on('error', function(err) { // Handle errors
            fs.unlink(dest, ()=> { // Delete the file async. (But we don't check the result)
                //-> nothing else
            });
            callback("Error on writing m3u file: " + source["file"] + " - " + err.message, null);
        });
    };

    //stop if playing
    this.stop = function (callback) {
        if (this.mp3Player && this.mp3Player.isPlaying()) {
            this.log("Playlist paused", "debug");
            try {
                this.mp3Player.pause(
                    callback("paused")
                );
                this.mp3Player = null;
            }
            catch (err) {
                this.log("Error catched on pausing player " + err, "error");
            }
        }
    };

};

module.exports = alarmPlayer;