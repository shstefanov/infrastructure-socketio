var _            = require("underscore");
var helpers      = require("infrastructure/lib/helpers");
var EventedClass = require("infrastructure/lib/EventedClass");

var noop = function(){};

var WebsocketApp = EventedClass.extend("WebsocketApp", {

  SessionsCollection: require("./lib/SessionsCollection"),

  constructor: function(env, structure_name, name){

    this.env = env;

    // TODO - make interval to clean unused sessionsData
    this.sessionsData       = {};
    this.tokens             = {};
    this.reconnect_tokens   = {};

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
        sio     = this.io = io(options);

    var self = this;
    env.stops.push(function(cb){
      sio.close(); 
      cb(); 
    });


    this.sessions = new this.SessionsCollection();

    sio.checkRequest = function(req, cb){ self.trigger( "request", req, cb ); };

    this
      .on( "request",  this.handleRequest,     this )
      .on( "session",  this.handleSocket,      this )
      .on( "error",    this.handleError,       this )
      .on( "socket",   this.bindSocketEvents,  this );

    this.sessions.on("empty", this.emptySession, this);
    this.sessions.on("disconnect", function(session){
      this.trigger("disconnect", session);
    }, this);

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

  emptySession: function(session){
    if(session.forceDisconnect === true) return;
    // TODO: emptySessionDisconnectTimeout
    this.disconnect(session.id);
  },

  methods: [
    // White list that makes only these methods callable
    "disconnect",
    "disconnectAll",
    "emit",
    "getConnection"
  ],

  disconnect: function(key, cb){
    var session = this.sessions.get(key);
    if(!session) return cb && cb("Session doesn't exist");
    var num = session.getSocketsNumber();
    session.disconnect();
    cb && cb(null, num);
  },

  disconnectAll: function(cb){
    var result = { sessions: this.sessions.length, sockets: 0 };
    var self = this;
    this.sessions.each(function(session){ 
      result.sockets += session.getSocketsNumber();
      self.disconnect(socket.id);
    });
    cb && cb(null, result);
  },



  /*

    // Send message and data to one subject
    target.emit(123,        "message", {text: "Hello"}) 

    // Send message and data to multiple subjects
    target.emit([123, 133], "message", {text: "Hello"}) 

    // Send message and individual sets of data to multiple subjects with 
    target.emit([
      [123, {text: "Hello 123"}],
      [133, {text: "Hello 133"}],
      [144, {text: "Hello 144"}]
    ], "message")

  */
  emit: function(key, event, data, cb){
    if(key === null) key = this.sessions.keys();
    if(!cb) cb = typeof data === "function" ? data : undefined;
    if(Array.isArray(key)){
      for(var i=0;i<key.length;i++){
        if(Array.isArray(key[i])) this.emit( key[i][0], event, key[i][1]);
        else this.emit(key[i], event, data);
      }
    }
    else{
      var session = this.sessions.get(key);
      session.emit(event, data);
    }

    cb && cb();
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
    if(options.sessionData){
      this.sessionsData[key] = options.sessionData;
    }
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
    var parts         = str.replace(/([^|])([|])([^|])/g, "$1 $2 $3").split(/[^|][|][^|]/).map( function(part){ return part.trim(); } );
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
    var parts         = str.replace(/([^|])([|])([^|])/g, "$1 $2 $3").split(/[^|][|][^|]/).map( function(part){ return part.trim(); } );
    parts[0] = parts[0].replace(/^@/, "");
    if(path) parts[2] = path;
    var argGetter     = parts[1]? new Function( "socket, data, result", "return [" + parts[1] + "];" ) : this.defaultArgGetter;
    var dataPatcher   = parts[2]? function(data, result){ helpers.patch(result, parts[2], data); }        : this.defaultDataPatcher;
    return function(socket, data, result, cb){
      try{var do_args = argGetter(socket, data, result, _);} catch(err){ return cb(err.stack); }
      self[parts[0]].apply(self, do_args.concat([function(err, do_result){
        if(err) return cb(err);
        dataPatcher(do_result, result);
        cb( null, socket, data, result );
      }]));        
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
      cb(null, {
        req: req,
        token: req._query[this.options.tokenParam],
        reconnect_token: req._query.reconnect_token,
      });
    },

    function(ctx, cb){
      if(ctx.token && this.tokens.hasOwnProperty(ctx.token)){
        ctx.key = this.tokens[ctx.token];
        delete this.tokens[ctx.token];
      }
      else if(ctx.reconnect_token && this.reconnect_tokens.hasOwnProperty(ctx.reconnect_token)){
        ctx.key = this.reconnect_tokens[ctx.reconnect_token];
        delete this.reconnect_tokens[ctx.reconnect_token]
      }
      else return cb.finish("Connection error");

      cb(null, ctx);
    },

    function(ctx, cb){
      if(!ctx.key) return cb.finish("Connection error");
      ctx.session = this.sessions.get(ctx.key) || this.sessions.add({key: ctx.key});
      cb(null, ctx);
    },

    function(ctx, cb){
      var sessionData = this.sessionsData[ctx.key];
      sessionData && ctx.session.set(sessionData);
      delete this.sessionsData[ctx.key];
      ctx.req.session = ctx.session;
      cb(null, true);
    }

  ]),

});

module.exports = WebsocketApp;
