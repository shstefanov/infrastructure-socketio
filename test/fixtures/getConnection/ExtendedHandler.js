var WebsocketHandler = require("../../../WebsocketHandler.js");

module.exports = WebsocketHandler.extend("ExtendedTestHandler", {
  selfMethod: function(param1, param2, cb){
    cb(null, param1 + param2);
  },

  // Adding test methods to callable white list
  methods: [ "getSessionsInfo", "waitEmpty" ].concat(WebsocketHandler.prototype.methods),

  // For test needs only
  getSessionsInfo: function(cb){
    var result = {};
    this.sessions.each(function(session){ result[session.id] = Object.keys(session.sockets).length });
    cb(null, result);
  },

  // For test needs only
  waitEmpty: function(cb){
    this.sessions.once("empty", function(session){ cb(null, session.toJSON()); });
  }
});