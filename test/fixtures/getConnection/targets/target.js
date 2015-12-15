
var Target = function(env){};

Target.prototype.targetMethod = function(data, cb){
  cb(null, data * 3);
};

Target.prototype.echo = function(data, cb){
  cb(null, data);
};

module.exports = Target;