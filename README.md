This metapackage is for use with projects that use infrastructure. Be sure that you know how to use it. For more info:
https://shstefanov.github.io/infrastructure/

Installation
============

    npm install infrastructure-socketio

Configuration
=============

    {
      "path":   "websocket",
      "engines": ["infrastructure-socketio/engine"],
      "config": {
        "socketio": {
          "serveClient": false,
          "pingTimeout": 10000,
          "pingInterval": 10000,
          "maxHttpBufferSize" : 1048576,
          "transports": [  "websocket" , "polling" ],
          "allowUpgrades": true,
          "perMessageDeflate": true,
          "httpCompression": true,
          "cookie": false
        }
      }
    }
    
Instance
========

    // websocket/app.js
    var WebsocketHandler = require("infrastructure-socketio/WebsocketHandler");
    module.exports = WebsocketHandler.extend("HandlerName", {
      options: {
        port:           3999,                           // Required, bind socketio server to listen on this port
        connect_port:   80,                             // Optional - tells client which port to use for connection
                                                        // (server can be behind loadballancer), 
                                                        // defaults to "port" option
        name:           "some_name",                    // Default structure name ("app")
        host:           "localhost",                    // Default is config.host or 'localhost'
        path:           "/connection/url",              // Default is "/structure_name/name"
        protocol:       "ws://",                        // Default is "ws://"
        transports:     [ "websocket" ],                // Default is [ "websocket", "xhr-polling" ]
        tokenParam:     "token",                        // Optional - defaults to 'token'   
      },
      listenSocket: {
        eventName:  function(socket, data, result, cb){ /* ... */ },
        otherEvent: "data.Messages.find | {}, {limit: 5} | messages",   // Call structure target
      }
    });
    
listenSocket maps events to functions or target calls, using same scheme as infrastructure-express page object
https://github.com/shstefanov/infrastructure-express

It builds structure target. If you want to connect to this server, you need to get connection settings and pass connection object to the client.

    env.i.do("websocket.app.getConnection", "some_key_string", function(err, settings){
       // Settings is object needed by client to establish connection
    });
    // Also, it can be returned as string (some template engines can not render object as string)
    env.i.do("websocket.app.getConnection", "some_key_string", { string: true }, function(err, settings){
       // Settings is object needed by client to establish connection
    });
    

Client
======

    var WebsocketController = require("infrastructure-socketio/client").extend("websocketController", {
      config:  {}    // pass connection settings object, returned by "websocket.app.getConnection" call
    });
    var controller = new WebsocketController();
    controller.init({}, function(err){
      // When connection is established, controller have methods for each event in "listenSocket" hash
      controller.eventName({a: 55}, function(err, result){ /* ... */ });
      controller.otherEvent({a: 66}, function(err, result){ /* ... */ });
    });


V0.4.0
======

WebsocketHandler#emit provides scheme for emitting events and data to subject sockets. Giving 'key' argument means all of sockets, registered under given key will recieve the message


    // Send message and data to one subject
    target.emit(123,        "msg", {text: "Hello"}) 

    // Send message and data to multiple subjects
    target.emit([123, 133], "msg", {text: "Hello"}) 

    // Send message and individual sets of data to multiple subjects with 
    target.emit([
      //  key             data
      [   123,       {text: "Hello 123"}],
      [   133,       {text: "Hello 133"}],
      [   144,       {text: "Hello 144"}]
    ], "msg"  /* event name */   )