var _ = require("underscore");
var ExtendedModel      = require("infrastructure/lib/ExtendedModel"      );
var ExtendedCollection = require("infrastructure/lib/ExtendedCollection" );

var Session   = ExtendedModel.extend("Session", {
  idAttribute: "key",
  initialize: function(){
    this.sockets = {};
  },
  addSocket: function(socket){
    var sockets = this.sockets;
    socket.session = this;
    sockets[socket.id] = socket;
    socket.once("disconnect", function(){ delete sockets[socket.id]; });
  },

  emit: function(event, data){
    _.invoke(this.sockets, 'emit', event, data);
  }
});


var SessionsCollection = ExtendedCollection.extend("SessionsCollection", {
  model:    Session
});

module.exports = SessionsCollection;
