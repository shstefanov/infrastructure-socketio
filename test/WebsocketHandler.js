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
        _events: {},
        on(e, h){ this._events[e] = h; },
        listen(){}
      }
    }
  },
  stops: [],
  i: { do(){} }
};

var SocketMockup = require("infrastructure/lib/EventedClass").extend("SocketMockup", {
  disconnect: function()           { this.trigger("disconnect");        },
  emit:       function(event, data){ this.trigger("emit:"+event, data); },
});

describe(`WebsocketHandler\n    ${__filename}`, () => {

  describe("constructor (default options)", () => {

    it("Default options", (next) => {
      var TestWebsocketHandler = WebsocketHandler.extend("TestWebsocketHandler", {
        options:{
          port: 80,
          connect_port: 90,
        }
      });

      var testHandler = new TestWebsocketHandler(env_mockup, "websocket", "test");
      
      assert.deepEqual(testHandler.options, {
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

      var testHandler = new TestWebsocketHandler(env_mockup, "websocket", "test");
      
      testHandler.getConnection(123, (err, connection) => {
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

      var testHandler = new TestWebsocketHandler(env_mockup, "websocket", "test");
      
      testHandler.getConnection(123, {string: true}, (err, connection) => {
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

      var testHandler = new TestWebsocketHandler(env_mockup, "websocket", "test");
      
      testHandler.getConnection(123, {sessionData: {user: 555}}, (err, connection) => {
        assert.equal(err, null);
        assert.deepEqual(testHandler.sessionsData, { '123': { user: 555 } });
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
      var testHandler = new TestWebsocketHandler(env_mockup, "websocket", "test");

      assert.deepEqual(env_mockup.sio_options, { socket_io_options: { test_option: 11 }, "path": testHandler.options.path } );
      next();
    });
  
  });

  describe("sio.checkRequest", () => {
     
    it("call checkRequest(req, cb)", (next) => {
      var TestWebsocketHandler = WebsocketHandler.extend("TestWebsocketHandler", {
        options:{ port: 80, connect_port: 90 } 
      });
      var testHandler = new TestWebsocketHandler(env_mockup, "websocket", "test");


      testHandler.getConnection(1, (err, connection) => {
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
        testHandler.io.checkRequest(request_mockup, (err, result) => {
          assert.equal(err,    null );
          assert.equal(result, true );
          assert.equal(request_mockup.session instanceof testHandler.sessions.model, true);
          next();
        });
        
      });
    });

    it("call checkRequest(invalid token)", (next) => {
      var TestWebsocketHandler = WebsocketHandler.extend("TestWebsocketHandler", {
        options:{ port: 80, connect_port: 90 } 
      });
      var testHandler = new TestWebsocketHandler(env_mockup, "websocket", "test");

      testHandler.getConnection(1, (err, connection) => {
        var request_mockup = {
          _query: {token: "invalid token"}
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
        testHandler.io.checkRequest(request_mockup, (err, result) => {
          assert.equal(err,    "Connection error" );
          next();
        });
        
      });


    });

  });

  describe("sio.on(\"connection\")", () => {
    
    it("emitting init event", (next) => {
      var TestWebsocketHandler = WebsocketHandler.extend("TestWebsocketHandler", {
        options:{ port: 80, connect_port: 90 } 
      });
      var testHandler = new TestWebsocketHandler(env_mockup, "websocket", "test");


      testHandler.getConnection(1, (err, connection) => {
        var request_mockup = {
          _query: {token: connection.query.split("=").pop()}
        };

        var test_socket = new SocketMockup();
        test_socket.request = request_mockup;

        test_socket.on("emit:init", function(data){
          assert.equal(Array.isArray(data.methods), true);
          assert.equal(data.hasOwnProperty("reconnect_token"), true);
          next();
        });

        testHandler.io.checkRequest(request_mockup, (err, result) => {
          testHandler.io._events.connection(test_socket);
        });
        
      });
    });

    it("session presence", (next) => {
      var TestWebsocketHandler = WebsocketHandler.extend("TestWebsocketHandler", {
        options:{ port: 80, connect_port: 90 } 
      });
      var testHandler = new TestWebsocketHandler(env_mockup, "websocket", "test");


      testHandler.getConnection(1, {sessionData: { user_id: 123 }}, (err, connection) => {
        var request_mockup = {
          _query: { token: connection.query.split("=").pop() }
        };

        var test_socket = new SocketMockup();
        test_socket.id  = 789;
        test_socket.request = request_mockup;

        test_socket.on("emit:init", function(data){
          assert.equal(testHandler.sessions.length, 1);
          assert.equal(testHandler.sessions.get(1) instanceof testHandler.sessions.model, true);
          next();
        });

        testHandler.io.checkRequest(request_mockup, (err, result) => {
          testHandler.io._events.connection(test_socket);
        });
        
      });
    });

    it("setting sessionData", (next) => {
      var TestWebsocketHandler = WebsocketHandler.extend("TestWebsocketHandler", {
        options:{ port: 80, connect_port: 90 } 
      });
      var testHandler = new TestWebsocketHandler(env_mockup, "websocket", "test");


      testHandler.getConnection(1, {sessionData: { user_id: 123 }}, (err, connection) => {
        var request_mockup = {
          _query: { token: connection.query.split("=").pop() }
        };

        var test_socket = new SocketMockup();
        test_socket.request = request_mockup;

        test_socket.on("emit:init", function(data){
          assert.deepEqual(test_socket.session.toJSON(), {
            key: 1, user_id: 123
          });
          next();
        });

        testHandler.io.checkRequest(request_mockup, (err, result) => {
          testHandler.io._events.connection(test_socket);
        });
        
      });
    });

  });

  describe("socket.disconnect()", () => {
    
    it("disconnecting", (next) => {
      var TestWebsocketHandler = WebsocketHandler.extend("TestWebsocketHandler", {
        options:{ port: 80, connect_port: 90 } 
      });
      var testHandler = new TestWebsocketHandler(env_mockup, "websocket", "test");


      testHandler.getConnection(1, {sessionData: { user_id: 123 }}, (err, connection) => {
        var request_mockup = {
          _query: { token: connection.query.split("=").pop() }
        };

        var test_socket = new SocketMockup();
        test_socket.request = request_mockup;

        test_socket.on("emit:init", function(data){
          assert.equal(testHandler.sessions.length, 1);
          setTimeout( () => {
            test_socket.disconnect();
            assert.equal(testHandler.sessions.length, 0);
            next();
          }, 10 );
        });

        testHandler.io.checkRequest(request_mockup, (err, result) => {
          testHandler.io._events.connection(test_socket);
        });
        
      });
    });

  });

  describe("reconnect", () => {
    
    it("reconnecting", (next) => {
      var TestWebsocketHandler = WebsocketHandler.extend("TestWebsocketHandler", {
        options:{ port: 80, connect_port: 90 } 
      });
      var testHandler = new TestWebsocketHandler(env_mockup, "websocket", "test");


      testHandler.getConnection(1, {sessionData: { user_id: 123 }}, (err, connection) => {
        var request_mockup = {
          _query: { token: connection.query.split("=").pop() }
        };

        var test_socket = new SocketMockup();
        test_socket.request = request_mockup;

        test_socket.on("emit:init", function(data){
          setTimeout( () => {
            test_socket.disconnect();
            var reconnect_request_mockup = {
              _query: { reconnect_token: data.reconnect_token }
            };

            var reconnected_socket = new SocketMockup();
            reconnected_socket.request = reconnect_request_mockup;

            reconnected_socket.on("emit:init", function(data){
              console.log("TODO ASSERT ME ::: ", data);
              next();
            });

            testHandler.io.checkRequest(reconnect_request_mockup, (err, result) => {
              testHandler.io._events.connection(reconnected_socket);
            });
          }, 10 );
        });

        testHandler.io.checkRequest(request_mockup, (err, result) => {
          testHandler.io._events.connection(test_socket);
        });
        
      });
    });
  });

});