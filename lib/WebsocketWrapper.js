var EventedClass = require("infrastructure/lib/EventedClass");

module.exports = EventedClass.extend("WebsocketApp", {
  constructor: function(socket, settings, initData){
    this.socket   = socket;
    this.settings = settings;
    this.initData = initData;

    var self = this;
    initData.methods.forEach(function(method_name){
      self[method_name] = function(){ socket.emit.apply(socket, [method_name].concat([].slice.call(arguments))); }
    });
  }
})