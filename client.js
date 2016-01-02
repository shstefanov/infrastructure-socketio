var _                = require("underscore");
var helpers          = require("infrastructure/lib/helpers"); 
var Controller       = require("infrastructure/lib/client/Controller");

module.exports   = Controller.extend("BaseWebsocketController", {

  init: function(options, cb){ 
    _.extend(this.config, { multiplex: false, reconnection: false });
    var self = this;
    this.setupSocket(this.config, function(err){
      if(err) return cb(err);
      self.trigger("connect");
      cb();
    }, this ); 
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
      var self = this;
      socket.once("init", function(initData){
        self.initData = initData;
        settings.reconnect = "&reconnect_token="+initData.reconnect_token;
        cb( null, socket, settings, initData );
      });


      var self = this;
      socket.once("disconnect", function(){
         var i = setInterval(function(){
          self.setupSocket(self.config, function(err){
            if(err) return console.error(err);
            clearInterval(i);
          });  
        }, 5000 );
      });
    },

    function(socket, settings, initData, cb){
      var self = this;
      initData.methods.forEach(function(method_name){
        self[method_name] = function(){ socket.emit.apply(socket, [method_name].concat([].slice.call(arguments))); }
      });
      this.socket = socket;
      cb();
    }]
  ),


});
