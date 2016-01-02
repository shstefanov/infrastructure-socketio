"use strict";

const path      = require("path");
const assert    = require("assert");
const _         = require("underscore");

describe(`infrastructure-socketio emit \n    ${__filename}`, () => {
  
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
  

  describe("WebsocketHandler # emit", () => {
    
    var clients;
    it("Prepare 5 connections", (done) => {
      Promise.all( [1,2,3,4,5].map( (n, i) => {
        return new Promise( (resolve, reject) => {
          env.i.do("websocket.test.getConnection", "connection_"+n, (err, connection_settings) => {
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

    it("Emits custom_event to all clients using null as key", (done) => {
      Promise.all( clients.map( (client, i) => {
        return new Promise( (resolve, reject) => {
          client.socket.once("custom_event", (data) => {
            resolve(data);
          });
        });
      })).then( (values) => {
        assert.deepEqual(values, [
          {custom_data: true},{custom_data: true},{custom_data: true},{custom_data: true},{custom_data: true}
        ]);
        done();
      });
      env.i.do("websocket.test.emit", null, "custom_event", {custom_data: true});
    });

    it("Emits custom_event to some of clients using key list", (done) => {
      Promise.all(clients.slice(0,3).map( (client, i) => {
        return new Promise( (resolve, reject) => {
          client.socket.once("some_event", (data) => {
            resolve(data);
          });
        });
      })).then( (values) => {
        assert.deepEqual(values, [
          {some_data: true},{some_data: true},{some_data: true}
        ]);
        done();
      });
      env.i.do("websocket.test.emit", ["connection_1","connection_2","connection_3"], "some_event", {some_data: true} );
    });

    it("Emits individual data for given keys",  (done) =>{
      Promise.all(clients.slice(2).map( (client, i) =>{
        return new Promise( (resolve, reject) =>{
          client.socket.once("individual_data",  (data) =>{
            resolve(data);
          });
        });
      })).then( (values) =>{
        assert.deepEqual(values, [
          {individual_data: 3},{individual_data: 4},{individual_data: 5}
        ]);
        done();
      });
      env.i.do("websocket.test.emit", [
        ["connection_3", {individual_data: 3}],
        ["connection_4", {individual_data: 4}],
        ["connection_5", {individual_data: 5}],     ], "individual_data" );
    });

    it("Emits custom_event to all clients using null as key (with callback)",  (done) =>{
      var resolveCb,  cbPromise = new Promise( (resolve) => { resolveCb = resolve; });
      Promise.all(clients.map( (client, i) => {
        return new Promise( (resolve, reject) => {
          client.socket.once("custom_event",  (data) => {
            resolve(data);
          });
        });
      }).concat([cbPromise])).then( (values) => {
        assert.deepEqual(values, [
          {custom_data: true},{custom_data: true},{custom_data: true},{custom_data: true},{custom_data: true}, true
        ]);
        done();
      });
      env.i.do("websocket.test.emit", null, "custom_event", {custom_data: true},  (err) => {
        assert.equal(err, null);
        resolveCb(true);
      });
    });

    it("Emits custom_event to some of clients using key list (with callback)",  (done) => {
      var resolveCb,  cbPromise = new Promise( (resolve) => { resolveCb = resolve; });
      Promise.all(clients.slice(0,3).map( (client, i) => {
        return new Promise( (resolve, reject) => {
          client.socket.once("some_event", (data) => {
            resolve(data);
          });
        });
      }).concat([cbPromise])).then( (values) => {
        assert.deepEqual(values, [
          {some_data: true},{some_data: true},{some_data: true}, true
        ]);
        done();
      });
      env.i.do("websocket.test.emit", ["connection_1","connection_2","connection_3"], "some_event", {some_data: true}, (err) => {
        assert.equal(err, null);
        resolveCb(true);
      });
    });

    it("Emits individual data for given keys (with callback)", (done) => {
      var resolveCb,  cbPromise = new Promise( (resolve) => { resolveCb = resolve; });
      Promise.all(clients.slice(2).map( (client, i) => {
        return new Promise( (resolve, reject) => {
          client.socket.once("individual_data", (data) => {
            resolve(data);
          });
        });
      }).concat([cbPromise])).then( (values) => {
        assert.deepEqual(values, [
          {individual_data: 3},{individual_data: 4},{individual_data: 5}, true
        ]);
        done();
      });
      env.i.do("websocket.test.emit", [
        ["connection_3", {individual_data: 3}],
        ["connection_4", {individual_data: 4}],
        ["connection_5", {individual_data: 5}],     ], "individual_data", (err) => {
          assert.equal(err, null);
          resolveCb(true);
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
