var _                = require("underscore");
var helpers          = require("infrastructure/lib/helpers"); 
var Controller       = require("infrastructure/lib/client/Controller");
var WebsocketWrapper = require("./lib/WebsocketWrapper")

module.exports   = Controller.extend("BaseWebsocketController", {

  init: function(options, cb){ 
    _.extend(this.config, {multiplex: false, reconnection: false });
    var self = this;
    this.setupSocket(this.config, function(err){
      if(err) return cb(err);
      self.trigger("connect");
      cb();
    }); 
  },

  setupSocket: helpers.chain([
    
    function(settings, cb){
      var io = require("socket.io-client");
      var socket = io.connect([settings.protocol, settings.host, ":", settings.port, "?", settings.query, settings.reconnect||""].join(""),  settings);
      socket.once("error", cb);
      socket.once("connect", function(){
        cb( null, socket, settings );
      });
    },

    function(socket, settings, cb){
      socket.on("init", function(initData){
        settings.reconnect = "&reconnect_token="+initData.reconnect_token;
        cb( null, socket, settings, initData );
      });


      var self = this;
      socket.on("disconnect", function(){


        var i = setInterval(function(){
          self.setupSocket(self.config, function(err){
            if(err) return console.error(err);
            clearInterval(i);
          });  
        }, 3000);
        
        self.setupSocket(self.config, function(){
          self.trigger("reconnect");
        });

      });
    },

    function(socket, settings, initData, cb){
      this.socket = new WebsocketWrapper(socket, settings, initData);
      cb();
    }]
  ),


});
