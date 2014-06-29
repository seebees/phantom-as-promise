"use strict"

var events = require('events');
var Promise = require('es6-promise').Promise;
var util = require('util');

module.exports = promesify;

function either(first) {
  return {
    or: function (second) {
      return function (arg1, arg2) {
        return arg1 ? first(arg1) : second(arg2);
      };
    }
  };
}

function promesify(config) {
  var methods;
  if (Array.isArray(config)) {
    methods = config; config = {};
  } else if (typeof config === 'object') {
    methods = config.methods || [];
  } else {
    config = {};
  }
  //----------------------------------------------
  function constructor(operand, promise) {
    this._operand = operand;
    this._promise = promise || operand;
  }; // constructor
  //----------------------------------------------
  util.inherits(constructor, events.EventEmitter);
  //----------------------------------------------
  [ 'then', 'catch' ].forEach(function (name) {
    constructor.prototype[name] = function () {
      return new constructor(this._operand, this._promise[name].apply(this._promise, arguments));
    };
  });
  constructor.prototype.always = function (callback) {
    return this.then(callback, callback);
  }
  // add methods related to operand
  methods.forEach(function (method) {
    constructor.prototype[method] = function () {
      var args = Array.prototype.slice.call(arguments);
      return (new constructor(this._operand, Promise.all([ this._operand, this._promise ]))).then(function (all) {
        var original = all[0][method];
        var callback = args[args.length-1];
        //---------------------------------------------
        return new Promise(function (resolve, reject) {
          if (typeof callback === 'function') {
            args[args.length-1] = function () {
              resolve(callback.apply(this, arguments));
            }
          } else {
            args.push(either(reject).or(resolve));
          }
          original.apply(all[0], args);
        });
      });
    };
  });
  // add heleprs if there are any
  if (typeof config.helpers === 'object') {
    Object.keys(config.helpers).forEach(function (key) {
      constructor.prototype[key] = config.helpers[key];
    });
  }
  return constructor;
}
