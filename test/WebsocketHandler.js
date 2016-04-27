"use strict";

const assert = require("assert");
const WebsocketHandler = require("../WebsocketHandler.js");


var env_mockup = {
  config: {
    host: "testhost",
  },
  engines: {
    io(options){  
      env_mockup.sio_options = options;
      return {
        on(){},
        listen(){}
      }
    }
  },
  stops: [],
  i: { do(){} }
};

describe(`WebsocketHandler\n    ${__filename}`, () => {

  describe("constructor (default options)", function(){

    it("Default options", (next) => {
      var TestWebsocketHandler = WebsocketHandler.extend("TestWebsocketHandler", {
        options:{
          port: 80,
          connect_port: 90,
        }
      });

      var teshHandler = new TestWebsocketHandler(env_mockup, "websocket", "test");
      
      assert.deepEqual(teshHandler.options, {
        host:         "testhost",
        port:         80,
        connect_port: 90,
        name:         "test",
        path:         "/websocket/test",
        protocol:     "ws://",
        transports:   [ "websocket", "xhr-polling" ],
        tokenParam:   "token",
      });

      next();
    });
    
  });

  describe("getConnection", () => {

    it("getConnection without options", (next) => {
      var TestWebsocketHandler = WebsocketHandler.extend("TestWebsocketHandler", {
        options:{
          port: 80,
          connect_port: 90,
        }
      });

      var teshHandler = new TestWebsocketHandler(env_mockup, "websocket", "test");
      
      teshHandler.getConnection(123, (err, connection) => {
        assert.equal(err, null);
        assert.deepEqual(connection, { protocol: 'ws://',
          path: '/websocket/test',
          transports: [ 'websocket', 'xhr-polling' ],
          host: 'testhost',
          port: 90,
          name: 'test',
          query: 'token=1' 
        });
        next();
      });
    });

    it("getConnection - {string: true} option", (next) => {
      var TestWebsocketHandler = WebsocketHandler.extend("TestWebsocketHandler", {
        options:{
          port: 80,
          connect_port: 90,
        }
      });

      var teshHandler = new TestWebsocketHandler(env_mockup, "websocket", "test");
      
      teshHandler.getConnection(123, {string: true}, (err, connection) => {
        assert.equal(err, null);
        assert.equal(connection, JSON.stringify({ protocol: 'ws://',
          path: '/websocket/test',
          transports: [ 'websocket', 'xhr-polling' ],
          host: 'testhost',
          port: 90,
          name: 'test',
          query: 'token=2' 
        }));
        next();
      });
    });

    it("getConnection - sessionData option", (next) => {
      var TestWebsocketHandler = WebsocketHandler.extend("TestWebsocketHandler", {
        options:{
          port: 80,
          connect_port: 90,
        }
      });

      var teshHandler = new TestWebsocketHandler(env_mockup, "websocket", "test");
      
      teshHandler.getConnection(123, {sessionData: {user: 555}}, (err, connection) => {
        assert.equal(err, null);
        assert.deepEqual(teshHandler.sessionsData, { '123': { user: 555 } });
        next();
      });
    });
    
  });

  describe("configuration", () => {

    it("Getting configuration from env.config", (next) => {
      var TestWebsocketHandler = WebsocketHandler.extend("TestWebsocketHandler", {
        options:{
          port: 80,
          connect_port: 90,
        }
      });
      env_mockup.config.socketio = {socket_io_options: {test_option: 11}};
      var teshHandler = new TestWebsocketHandler(env_mockup, "websocket", "test");

      assert.deepEqual(env_mockup.sio_options, { socket_io_options: { test_option: 11 }, "path": teshHandler.options.path } );
      next();
    });
  
  });

  describe("sio.checkRequest", () => {
     
    it("call checkRequest(req, cb)", (next) => {
      var TestWebsocketHandler = WebsocketHandler.extend("TestWebsocketHandler", {
        options:{ port: 80, connect_port: 90 } 
      });
      var teshHandler = new TestWebsocketHandler(env_mockup, "websocket", "test");


      teshHandler.getConnection(1, function(err, connection){
        var request_mockup = {
          _query: {token: connection.query.split("=").pop()}
        };
        // { 
        //   protocol: 'ws://',
        //   path: '/websocket/test',
        //   transports: [ 'websocket', 'xhr-polling' ],
        //   host: 'testhost',
        //   port: 90,
        //   name: 'test',
        //   query: 'token=4' 
        // }
        console.log(connection);
        teshHandler.io.checkRequest(request_mockup, function(err, result){
          console.log("HERERE", err, result);
          assert.equal(err, null);
          next();
        });
        
      });


    });

  });

  xdescribe("sio.on(\"connection\")", () => {
    it("TODO", () => {});
  });
  xdescribe("Reconnection token", () => {
    it("TODO", () => {});
  });
  

});