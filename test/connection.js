"use strict";

const path   = require("path");
const assert = require("assert");
const _      = require("underscore");

describe(`infrastructure-socketio connection and common usage\n    ${__filename}`, () => {
  
  const infrastructure_test = require("infrastructure/test_env");
  const Client = require("../client.js");
  
  var env, socket;
  
  it("starts application", (done) => {
    infrastructure_test.start({
      rootDir: path.join(__dirname, "fixtures/getConnection"),
      process_mode: "cluster"
    }, (err, _env) => {
      assert.equal(err, null);
      env = _env;
      done();
    });
  });


  it("getConnection returns with connection details", (done) => {
    env.i.do("websocket.test.getConnection", "some_key_string", (err, connection_data) => {
      assert.equal(err, null);
      assert.deepEqual(connection_data, { 
        protocol: 'ws://',
        path: '/websocket/test',
        transports: [ 'websocket', 'xhr-polling' ],
        host: 'localhost',
        port: 3999,
        name: 'test',
        query: 'token=1' 
      });
      ClientController = Client.extend("TestWebsocketClientController", {
        config: connection_data
      })
      done();
    });
  });

  var ClientController, client;

  it("Connects to websocket server using given settings", (done) => {
    client = new ClientController();
    client.init({}, (err) => {
      assert.equal(err, null);
      done();
    });
  });

  it("Controller has specific methods mapped to specific socket events", (done) => {
    assert.equal(_.isFunction(client.multiply), true );
    assert.equal(_.isFunction(client.chain   ), true );
    assert.equal(_.isFunction(client.parallel   ), true );
    done();
  });

  it("Executing method that calls some target", (done) => {
    client.multiply(12, (err, result) => {
      assert.equal(err, null);
      assert.deepEqual(result, { multiply_result: 36 });
      done();
    });
  });

  it("Executing chain of methods", (done) => {
    client.chain(12, (err, result) => {
      assert.equal(err, null);
      assert.deepEqual(result, { result1: 30, result2: 60 });
      done();
    });
  });

  it("Executing parallel methods", (done) => {
    client.parallel(12, (err, result) => {
      assert.equal(err, null);
      assert.deepEqual(result, { 
        "parallel_result_1": 45,
        "parallel_result_2": 75,
        "parallel_result_3": 105,
      });
      done();
    });
  });

  it("Executing combined methods", (done) => {
    client.combined(12, (err, result) => {
      assert.equal(err, null);
      assert.deepEqual(result, { 
        "parallel_result_1": 45,
        "parallel_result_2": 75,
        "parallel_result_3": 105,
        "result1": 30,
        "result2": 60,
      });
      done();
    });
  });

  it("Arguments getter", (done) => {
    client.argsGetter(12, (err, result) => {
      assert.equal(err, null);
      assert.deepEqual(result, { 
        session_id: 'some_key_string',
        the_data: 3,
        result: { mul: 'some_key_string3' } 
      });
      done();
    });
  });

  it("selfCaller", (done) => {
    client.selfCaller(12, (err, result) => {
      assert.equal(err, null);
      assert.deepEqual(result, { self_caller_result: 26 });
      done();
    });
  });

  it("Stops application", function(done){
    this.timeout(10000);
    env.stop((err) => {
      assert.equal(err, null);
      done();
    });
  });

});
