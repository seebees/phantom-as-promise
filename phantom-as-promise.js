"use strict";

var Phantom = require('node-phantom-simple');
var Promise = require('es6-promise').Promise;
var promesify = require('./promesify');

module.exports.PhantomAsPromise = PhantomAsPromise;
module.exports.PageAsPromise = PageAsPromise;
module.exports.meteor_helpers = require('./meteor');

function PhantomAsPromise (options, instanceSpecificHelpers) {
  var constructor = promesify({
    methods: [ 'createPage', 'injectJs', 'addCookie', 'clearCookies', 'deleteCookie', 'set', 'get', 'exit' ]
  });

  var listOfHelpers = merge([], instanceSpecificHelpers);

  constructor.prototype.page = function (pageSpecificHelpers) {
    return new PageAsPromise(this.createPage(), merge(listOfHelpers, pageSpecificHelpers));
  };

  return new constructor(new Promise(function (resolve, reject) {
    Phantom.create(either(reject).or(resolve), options);
  }));
}

function PageAsPromise(pagePromise, customPageHelpers) {

  var constructor = promesify({
    helpers: merge(require('./helpers'), customPageHelpers),
    methods: [
      'addCookie', 'childFramesCount', 'childFramesName', 'clearCookies', 'close',
      'currentFrameName', 'deleteCookie', 'evaluateJavaScript',
      'evaluateAsync', 'getPage', 'go', 'goBack', 'goForward', 'includeJs',
      'injectJs', 'open', 'openUrl', 'release', 'reload', 'render', 'renderBase64',
      'sendEvent', 'setContent', 'stop', 'switchToFocusedFrame', 'switchToFrame',
      'switchToFrame', 'switchToChildFrame', 'switchToChildFrame', 'switchToMainFrame',
      'switchToParentFrame', 'uploadFile',
      // these should be treated somewhat differently
      'evaluate', 'set', 'get', 'setFn', 'once', 'on'
      // --------------------------------------------
    ]
  });

  var original_open = constructor.prototype.open;
  constructor.prototype.open = function () {
    return original_open.apply(this, arguments).useFixtures();
  };

  return new constructor(pagePromise.then(function (page) {
    page.onCallback = function (args) {
      // TODO: also consider different scenarios
      try {
        args = JSON.parse(args);
        if (Array.isArray(args)) {
          page.emit.apply(page, args);
        }
      } catch (err) {
        // ignore
      }
    }
    return page;
  }));
};

function either(first) {
  return {
    or: function (second) {
      return function (arg1, arg2) {
        return arg1 ? first(arg1) : second(arg2);
      };
    }
  };
}

function merge() {
  var list = [], listOrObject, i;
  for (i = 0; i < arguments.length; i++) {
    listOrObject = arguments[i];
    if (Array.isArray(listOrObject)) {
      list.push.apply(list, listOrObject);
    } else if (listOrObject && typeof listOrObject === 'object') {
      list.push(listOrObject);
    }
    // ignore falsy and non object values
  }
  return list;
}
