"use strict";

const path      = require("path");
const assert    = require("assert");
const _         = require("underscore");

describe(`infrastructure-socketio handle disconnect \n    ${__filename}`, () => {
  
  const infrastructure_test = require("infrastructure/test_env");
  const Client = require("../client.js");
  
  var env, socket;

  describe("Start", () => {
    it("starts application", (done)=> {
      infrastructure_test.start({
        rootDir: path.join(__dirname, "fixtures/getConnection"),
        process_mode: "cluster"
      }, (err, _env)=> {
        assert.equal(err, null);
        env = _env;
        done();
      });
    });    
  });
  

  describe("WebsocketHandler # disconnect (serverside)", () => {
    
    var clients;
    it("Prepare 5 connections under 1 subject key", (done) => {
      Promise.all( [1,2,3,4,5].map( (n, i) => {
        return new Promise( (resolve, reject) => {
          env.i.do("websocket.test.getConnection", "subject_key", (err, connection_settings) => {
            if(err) return reject(err);
            let ClientController = Client.extend("TestWebsocketClientController", { config: connection_settings });
            let client = new ClientController();
            client.init({}, (err) => { err? reject(err) : resolve(client) });
          });
        });
      })).then( (c) => { 
        clients = c;
        done(); 
      });
    });

    it("Has 1 session with 5 socket connections in handler", (done) => {
      env.i.do("websocket.test.getSessionsInfo", (err, result) => {
        assert.equal(err, null);
        assert.deepEqual(result, { subject_key: 5 });
        done();
      });
    });

    it("Disconnects all subjects sockets", (done) => {
      env.i.do("websocket.test.disconnect", "subject_key", (err, result) => {
        assert.equal(err, null);
        assert.equal(result, 5);
        done();
      });
    });

    it("Does not have sessions after disconnect", (done) => {
      env.i.do("websocket.test.getSessionsInfo", (err, result) => {
        assert.equal(err, null);
        assert.deepEqual(result, {});
        done();
      });
    });

  });

  describe("WebsocketController # disconnect (clientside)", () => {
    
    var clients;
    it("Prepare 5 connections under 1 subject key", (done) => {
      Promise.all( [1,2,3].map( (n, i) => {
        return new Promise( (resolve, reject) => {
          env.i.do("websocket.test.getConnection", "another_subject_key", (err, connection_settings) => {
            if(err) return reject(err);
            let ClientController = Client.extend("TestWebsocketClientController", { config: connection_settings });
            let client = new ClientController();
            client.init({}, (err) => { err? reject(err) : resolve(client) });
          });
        });
      })).then( (c) => { 
        clients = c;
        done(); 
      });
    });

    it("Has 1 session with 5 socket connections in handler", (done) => {
      env.i.do("websocket.test.getSessionsInfo", (err, result) => {
        assert.equal(err, null);
        assert.deepEqual(result, { another_subject_key: 3 });
        done();
      });
    });

    it("Disconnects all subjects sockets", (done) => {
      env.i.do("websocket.test.waitEmpty", (err, session) => {
        assert.equal(err, null);
        done();
      });
      clients.forEach( (client) => { client.disconnect(); } );
    });

    it("Does not have sessions after disconnect", (done) => {
      env.i.do("websocket.test.getSessionsInfo", (err, result) => {
        assert.equal(err, null);
        assert.deepEqual(result, {});
        done();
      });
    });

  });


  describe("Stop",  () => {
    it("Stops application", function(done){
      this.timeout(10000);
      env.stop( (err) => {
        assert.equal(err, null);
        done();
      });
    });    
  })

});
