var cookie       = require("cookie");
var _            = require("../infrastructure/node_modules/underscore");
var helpers      = require("../infrastructure/lib/helpers");
var EventedClass = require("../infrastructure/lib/EventedClass");

var noop = function(){};

var WebsocketApp = EventedClass.extend("WebsocketApp", {

  SessionsCollection: require("./lib/SessionsCollection"),

  constructor: function(env, structure_name, name){

    this.env = env;

    _.defaults(this.options, {
      name:           name,
      host:           env.config.host || 'localhost',
      path:           ["/", structure_name,"/", name].join(""),
      protocol:       "ws://",
      transports:     [ "websocket", "xhr-polling" ],
      tokenParam:     "token",                        // Optional - defaults to 'token'   
    });


    var self    = this, 
        config  = env.config, 
        io      = env.engines.io,
        options = _.extend({}, config.socketio, { path: this.options.path }),
        sio     = this.sio = io(options);

    env.stops.push(function(cb){ sio.close(); cb(); });

    this.tokens             = {};
    this.reconnect_tokens   = {};

    this.sessions = new this.SessionsCollection();
    this.sessions.indexBy("cookie", function(session){ return session.cookie; });

    sio.checkRequest = function(req, cb){ self.trigger( "request", req, cb ); };

    this
      .on( "request",  this.handleRequest,     this )
      .on( "session",  this.handleSocket,      this )
      .on( "error",    this.handleError,       this )
      .on( "socket",   this.bindSocketEvents,  this );

    sio.listen(this.options.port);

    var handleConnection = function(socket){ self.trigger( "socket", socket, socket.request.session ); };
    sio.on( "connection", handleConnection );

    this.parseSocketEvents();

    EventedClass.apply( this, arguments );

    env.i.do("log.sys", "websocket server", this.options.name+": ["+this.options.protocol+this.options.host+":"+this.options.port+"]")
  },

  // Generating one-time token
  generateConnectionToken: function(key){
    return _.uniqueId(this.name);
  },

  // When request hits page, it will call this 
  // function to create token for websocket connection
  // and to get websocket configurtion for connection 
  // to this websocket application
  getConnection: function(key, options, cb){

    if(!cb){ cb = options, options = {}; }

    var settings = _.pick(this.options, ["protocol", "path", "transports", "host", "port", "name"]);
    if(this.options.connect_port) settings.port = this.options.connect_port;
    var token = this.generateConnectionToken(key);
    this.tokens[token] = key;
    settings.query = this.options.tokenParam+"="+token;
    cb(null, options.string?JSON.stringify(settings): settings);
  },


  // chainLead creates result object that will collect call results
  chainLead: function(socket, data, cb){         cb(null, socket, data, {} ) },
  chainTail: function(socket, data, result, cb){ cb(null, result );          },
  parseSocketEvents: function(){
    var events = this.listenSocket;
    if(!events) { this.__parsedSocketEvents = {}; return; }
    var self = this;
    this.__parsedSocketEvents = _.mapObject(events, function(handler, event_name){
      return self.createChain([
        self.chainLead,
        self.parseHandler(handler),
        self.chainTail,
      ], true );
    });
  },

  parseHandler: function(handler, path){
    if(_.isFunction(handler))    return handler;
    else if(_.isString(handler)) {
      if(handler.indexOf("@") === 0) return this.createSelfCaller(handler, path);
      return this.createDoCaller(handler, path);
    }
    else if(_.isArray(handler))  return this.createChain(handler);
    else if(_.isObject(handler)) return this.createConcurent(handler);
  },


  createChain: function(handlers, initial){
    var self = this;
    var fns = handlers.slice(), last;
    if(initial) last = fns.pop();

    return helpers.chain(fns.map(function(hndl, index){
      var parsed = self.parseHandler(hndl);
      return function(socket, data, result, cb){
        parsed.call(self, socket, data, result, function(err){
          if(err) return cb(err);
          cb(null, socket, data, result);
        });
      }
    }).concat( initial ? [last] : [] ) );
  },

  defaultArgGetter: function(){return [];},
  defaultDataPatcher: function(data, result){_.extend(result, data);},
  createDoCaller: function(str, path){
    var self          = this;
    var parts         = str.split(/[^|\\][|][^|]/).map(function(s){return s.trim();});
    if(path) parts[2] = path;
    var argGetter     = parts[1]? new Function( "socket, data, result", "return [" + parts[1] + "];" ) : this.defaultArgGetter;
    var dataPatcher   = parts[2]? function(data, result){ helpers.patch(result, parts[2], data); }        : this.defaultDataPatcher;
    return function(socket, data, result, cb){
      try{var do_args = argGetter(socket, data, result, _);} catch(err){ return cb(err.stack); }
      self.env.i.do.apply(self.env.i, [parts[0]].concat(do_args.concat([function(err, do_result){
        if(err) return cb(err);
        dataPatcher(do_result, result);
        cb( null, socket, data, result );
      }])));
    };
  },

  createSelfCaller: function(str, path){
    var self          = this;
    var parts         = str.split(/[^|\\][|][^|]/).map(function(s){return s.trim();});
    parts[0] = parts[0].replace(/^@/, "");
    if(path) parts[2] = path;
    var argGetter     = parts[1]? new Function( "socket, data, result", "return [" + parts[1] + "];" ) : this.defaultArgGetter;
    var dataPatcher   = parts[2]? function(data, result){ helpers.patch(result, parts[2], data); }        : this.defaultDataPatcher;
    return function(socket, data, result, cb){
      try{var do_args = argGetter(socket, data, result, _);} catch(err){ return cb(err.stack); }
      // console.log("selfCaller???", data, result, cb);
      // try{
      self[parts[0]].apply(self, do_args.concat([function(err, do_result){
        if(err) return cb(err);
        dataPatcher(do_result, result);
        cb( null, socket, data, result );
      }]));        
      // }catch(err){ console.error(err) }
    };
  },

  createConcurent: function(handlers, initial){
    var self   = this;
    var parsed = _.mapObject(handlers, function(handler, path){
      return self.parseHandler( handler, path );
    });
    var concurent = helpers.amapCompose( parsed, null );
    return function(socket, data, result, cb){
      concurent.call(this, null, function(handler, done){
        handler.call(this, socket, data, result, function(err){done(err);} );
      }, cb, this );
    };
  },

  bindSocketEvents: function(socket, session){
    var self = this;
    socket.listeners = [];
    socket.reconnect_token = this.generateConnectionToken(session.id);
    var bindSocket = this.__parsedSocketEvents;
    var init = {methods: [], reconnect_token: socket.reconnect_token };

    this.defaultHandler = this.defaultHandler || function(err, result){
      if(err) self.env.i.do( "log.error", "WebsocketApp default error handler", err );
    };

    for(var event in bindSocket){ 
      var handler = bindSocket[event];
      init.methods.push(event);

      (function(event, handler){
        socket.on(event, function(){
          var args = Array.prototype.slice.call(arguments);
          var parsed_args = self.validateEventData(args);
          if(!parsed_args) return;
          handler.apply(self, [socket].concat(parsed_args));
        });
      })(event, handler);

    }
    socket.emit("init", init );
    session.addSocket(socket);

    socket.once("disconnect", function(){
      self.reconnect_tokens[socket.reconnect_token] = session.id;
    });

  },

  validateEventData: function(args){

    if(args.length === 0){
      return [null, this.defaultHandler];
    }

    if(args.length === 1){
      if(_.isFunction(args[0])) args.unshift(null);
      else                      args.push(this.defaultHandler);
      return args;        
    }

    var cb = args.filter(function(arg){ return typeof arg === "function" });
    if(cb.length > 2){
      _.invoke(cb, "call", global, "Unexpected error");
      return false;
    }

    return args;
  },

    
  handleRequest: helpers.chain([

    function(req, cb){

      var token = req._query[this.options.tokenParam];
      var key   = this.tokens[token];
      
      if(!key) {
        var reconnect_token = req._query.reconnect_token;
        if(!reconnect_token) return cb(null, false);
        key = this.reconnect_tokens[reconnect_token];
        if(!key) return cb(null, false);
        delete this.reconnect_tokens[reconnect_token];
      }
      else{
        delete this.tokens[token];
      }

      return cb(null, key, req);

    },
  
    function( key, req, cb ){
      var session = this.sessions.get(key);
      if(!session) {
        session = this.sessions.add({ key: key });
      }
      req.session = session;
      cb(null, true);
    },

  ]),

  // handleSocket: function( socket, session ){
  //   session.addSocket(socket);
  // },

  // handleSession: function(session){

  // },

});

module.exports = WebsocketApp;
