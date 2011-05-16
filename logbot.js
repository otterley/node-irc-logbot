#!/usr/bin/env node

/* logbot.js - an IRC logger bot
 * (C) 2011 Michael S. Fischer.  
 * Licensed under the Apache 2.0 license: 
 * http://www.apache.org/licenses/LICENSE-2.0.html */

var path = require('path');
var irc = require('irc');
var fs = require('fs');

// Overcome the inexcusable lack of sprintf() in JavaScript. 
var sprintf = require('sprintf').sprintf;

// TODO: Put these in our cfg file.
var server = "chat.us.freenode.net";
var ircPort = 7000;
var nick = "changeMe";
var realName = "Real Name";
var userName = "userName";
var debug = true;
var httpPort = 8080;
var dataDir = ".";

function getChannelFD(channel) {
    var d,
        dateStr,
        fn, 
        fd;

    d = new Date();
    dateStr = sprintf("%04d-%02d-%02d", 
                      d.getUTCFullYear(),
                      d.getUTCMonth(),
                      d.getUTCDate());
    
    fn = path.join(dataDir, sprintf("%s.%s.html", channel, dateStr)); 
                  
    if (records[channel] === undefined
        || records[channel]["fd"] === undefined) {
        fd = fs.openSync(fn, "a", 0666);
    } else {
        fd = records[channel]["fd"];
        if (records[channel]["date"] < dateStr) {
            fs.writeSync(fd, "</body></html>\n", null);
            fs.closeSync(fd);
            fd = fs.openSync(fn, "a", 0666);
        }
    }
    records[channel] = { "fd" : fd, "date" : dateStr };

    if (fs.fstatSync(fd)["size"] === 0) {
        fs.writeSync(fd,
                     sprintf("<html><head><title>%s: %s log for %s" +
                             "</title></head><body>\n", 
                             server, channel, dateStr),
                     null);
    }
    return fd;
}

function getHTMLTimestamp() {
    var d = new Date();
    return sprintf('<span class="timestamp">%02d:%02d:%02d</span>',
                   d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds());
}

var client = new irc.Client(server, nick, 
                            { "userName": userName,
                              "realName": realName,
                              "port": ircPort,
                              "secure": true,
                              "debug": debug });

var records = {};

client.on("registered", function () {
    console.log("registration successful");
});

client.on("invite", function(channel, from) {
    // console.log(from + " invited me to " + channel + ", joining it");
    client.join(channel);
});

client.on("topic", function(channel, topic, nick) {
    fs.writeSync(getChannelFD(channel),
                 sprintf('<div class="topicAction">' +
                         getHTMLTimestamp() + 
                         '<span class="info">%s changed topic to %s' +
                         '</span></div>\n', nick, topic),
                 null);
});

client.on("quit", function(nick, reason, channels) {
    var channel;
    for (channel in channels) {
        fs.writeSync(getChannelFD(channel),
                     sprintf('<div class="quitAction">' +
                             getHTMLTimestamp() + 
                             '<span class="info">%s quit (%s)' +
                             '</span></div>\n', nick, reason),
                     null);
    }
});

client.on("join", function(channel, nick) {
    fs.writeSync(getChannelFD(channel),
                 sprintf('<div class="joinAction">' +
                         getHTMLTimestamp() + 
                         '<span class="info">%s joined %s</span></div>\n',
                         nick, channel),
                 null);
});

client.on("part", function(channel, nick, reason) {
    fs.writeSync(getChannelFD(channel),
                 sprintf('<div class="partAction">' +
                         getHTMLTimestamp() + 
                         '<span class="info">%s left %s (%s)</span></div>\n',
                         nick, channel, reason),
                 null);
});

client.on("message", function(from, to, text) {
    var selfRegex,
        command,
        d;

    console.log(from + " said to " + to + ": " + text);
    if (to.match(/^#/)) {
        // Message was sent to a channel
        selfRegex = new RegExp("^" + nick + ":?\\s+", "i");
        if (text.match(selfRegex)) {
            // Public message: bot instruction
            command = text.replace(selfRegex, "");
            switch(command) {
                case "url":
                    client.say(to, "I'll tell you the URL now");
                    return;
            }
        } else {
            d = new Date();
            fs.writeSync(getChannelFD(to),
                         sprintf('<div class="msgAction">' +
                                 getHTMLTimestamp() + 
                                 '<span class="nick">&lt;%s&gt;</span>' +
                                 '<span class="msg">%s</span></div>\n',
                                 from, text),
                         null);
        }
    }
});

// vim:syn=javascript:sw=4:ts=4:et:ai
