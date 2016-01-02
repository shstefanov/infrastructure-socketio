var WebsocketHandler = require("../../../WebsocketHandler.js");

module.exports = WebsocketHandler.extend("ExtendedTestHandler", {
  selfMethod: function(param1, param2, cb){
    cb(null, param1 + param2);
  },

  // For test needs only
  getSessionsInfo: function(cb){
    var result = {};
    this.sessions.each(function(session){ result[session.id] = Object.keys(session.sockets).length });
    cb(null, result);
  }

});