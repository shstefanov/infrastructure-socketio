var _ = require("underscore");
var ExtendedModel      = require("infrastructure/lib/ExtendedModel"      );
var ExtendedCollection = require("infrastructure/lib/ExtendedCollection" );

function handleDisconnect(){
  var session = this.session, sockets = session.sockets;
  delete sockets[this.id];
  if(!session.getSocketsNumber()) session.trigger("empty", session);
}

var Session   = ExtendedModel.extend("Session", {
  idAttribute: "key",
  initialize: function(){
    this.sockets = {};
  },
  addSocket: function(socket){
    var self           = this;
    var sockets        = this.sockets;
    socket.session     = this;
    sockets[socket.id] = socket;
    socket.once( "disconnect", handleDisconnect );
  },

  emit: function(event, data){
    _.invoke(this.sockets, 'emit', event, data);
  },

  disconnect: function(){
    this.forceDisconnect = true;
    _.invoke(this.sockets, 'disconnect');
    this.trigger("disconnect", this);
  },

  getSocketsNumber: function(){
    return Object.keys(this.sockets).length;
  }
});


var SessionsCollection = ExtendedCollection.extend("SessionsCollection", {
  model:    Session,
  initialize: function(){
    this.on("disconnect", this.remove, this);
  },
  keys: function(){
    return this.pluck(this.model.prototype.idAttribute);
  }
});

module.exports = SessionsCollection;
