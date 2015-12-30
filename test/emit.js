var path   = require("path");
var assert = require("assert");
var _      = require("underscore");
describe("infrastructure-socketio emit", function(){
  var env, socket;
  var infrastructure_test = require("infrastructure/test_env");
  var Client = require("../client.js");
  
  it("starts application", function(done){
    infrastructure_test.start({
      rootDir: path.join(__dirname, "fixtures/getConnection"),
      process_mode: "cluster"
    }, function(err, _env){
      assert.equal(err, null);
      env = _env;
      done();
    });
  });


  var clients = [];
  describe("Set up 5 clients", function(){
    [1,2,3,4,5].forEach(function(n, i){

      var ClientController;
      it("Prepare connection "+ n, function(done){
        env.i.do("websocket.test.getConnection", "connection_"+n, function(err, connection_settings){
          assert.equal(err, null);
          var ClientController = Client.extend("TestWebsocketClientController", { config: connection_settings });
          var client = new ClientController();
          client.init({}, function(err){
            assert.equal(err, null);
            clients[i] = client;
            done();
          });
        });
      });
    });

    it("Emits custom_event to all clients using null as key", function(done){
      Promise.all(clients.map(function(client, i){
        return new Promise(function(resolve, reject){
          client.socket.once("custom_event", function(data){
            resolve(data);
          });
        });
      })).then(function(values){
        assert.deepEqual(values, [
          {custom_data: true},{custom_data: true},{custom_data: true},{custom_data: true},{custom_data: true}
        ]);
        done();
      });
      env.i.do("websocket.test.emit", null, "custom_event", {custom_data: true});
    });

    it("Emits custom_event to some of clients using key list", function(done){
      Promise.all(clients.slice(0,3).map(function(client, i){
        return new Promise(function(resolve, reject){
          client.socket.once("some_event", function(data){
            resolve(data);
          });
        });
      })).then(function(values){
        assert.deepEqual(values, [
          {some_data: true},{some_data: true},{some_data: true}
        ]);
        done();
      });
      env.i.do("websocket.test.emit", ["connection_1","connection_2","connection_3"], "some_event", {some_data: true} );
    });

    it("Emits individual data for given keys", function(done){
      Promise.all(clients.slice(2).map(function(client, i){
        return new Promise(function(resolve, reject){
          client.socket.once("individual_data", function(data){
            resolve(data);
          });
        });
      })).then(function(values){
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

    it("Emits custom_event to all clients using null as key (with callback)", function(done){
      var resolveCb,  cbPromise = new Promise(function(resolve){ resolveCb = resolve; });
      Promise.all(clients.map(function(client, i){
        return new Promise(function(resolve, reject){
          client.socket.once("custom_event", function(data){
            resolve(data);
          });
        });
      }).concat([cbPromise])).then(function(values){
        assert.deepEqual(values, [
          {custom_data: true},{custom_data: true},{custom_data: true},{custom_data: true},{custom_data: true}, true
        ]);
        done();
      });
      env.i.do("websocket.test.emit", null, "custom_event", {custom_data: true}, function(err){
        assert.equal(err, null);
        resolveCb(true);
      });
    });

    it("Emits custom_event to some of clients using key list (with callback)", function(done){
      var resolveCb,  cbPromise = new Promise(function(resolve){ resolveCb = resolve; });
      Promise.all(clients.slice(0,3).map(function(client, i){
        return new Promise(function(resolve, reject){
          client.socket.once("some_event", function(data){
            resolve(data);
          });
        });
      }).concat([cbPromise])).then(function(values){
        assert.deepEqual(values, [
          {some_data: true},{some_data: true},{some_data: true}, true
        ]);
        done();
      });
      env.i.do("websocket.test.emit", ["connection_1","connection_2","connection_3"], "some_event", {some_data: true}, function(err){
        assert.equal(err, null);
        resolveCb(true);
      });
    });

    it("Emits individual data for given keys (with callback)", function(done){
      var resolveCb,  cbPromise = new Promise(function(resolve){ resolveCb = resolve; });
      Promise.all(clients.slice(2).map(function(client, i){
        return new Promise(function(resolve, reject){
          client.socket.once("individual_data", function(data){
            resolve(data);
          });
        });
      }).concat([cbPromise])).then(function(values){
        assert.deepEqual(values, [
          {individual_data: 3},{individual_data: 4},{individual_data: 5}, true
        ]);
        done();
      });
      env.i.do("websocket.test.emit", [
        ["connection_3", {individual_data: 3}],
        ["connection_4", {individual_data: 4}],
        ["connection_5", {individual_data: 5}],     ], "individual_data", function(err){
          assert.equal(err, null);
          resolveCb(true);
        });
    });

  });


  describe("Stop", function(){
    it("Stops application", function(done){
      env.stop(function(err){
        assert.equal(err, null);
        done();
      });
    });    
  })

});
