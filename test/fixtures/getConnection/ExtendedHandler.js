var WebsocketHandler = require("../../../WebsocketHandler.js");

module.exports = WebsocketHandler.extend("ExtendedHandler", {
  selfMethod: function(param1, param2, cb){
    cb(null, param1 + param2);
  }
});