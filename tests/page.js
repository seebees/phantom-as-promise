var expect = require('chai').expect;
var Promise = require('es6-promise').Promise;
var PhantomAsPromise = require('../phantom-as-promise').PhantomAsPromise;
var PageAsPromise = require('../phantom-as-promise').PageAsPromise;
var either = require('../phantom-as-promise').eaither;
var http = require('http');
var meteor_helpers = require('../phantom-as-promise').meteor_helpers;

describe('Page API.', function () {

  var phantomAsPromise = null;
  var pageAsPromise = null;
  var server = null;
  var port = 1025 + Math.floor(Math.random() * 9000);
  
  before(function (done) {
    server = http.createServer(function (request, response) {
      response.writeHead(200, {"Content-Type": "text/html"});
      response.end('<html><head><title>Hello!</title></head><body><h1>Hello World</h1></body></html>');
    }).listen(port, '127.0.0.1');
    server.once('listening', done);
  });

  before(function () {
    phantomAsPromise = new PhantomAsPromise({}, meteor_helpers);
    pageAsPromise = phantomAsPromise.page({
      pageSpecificHelper: function () {
        return this.sleep(100);
      },
    });
    return Promise.all([
      phantomAsPromise, pageAsPromise
    ]);
  });  

  after(function () {
    return Promise.all([
      // close server
      new Promise(function (resolve) {
        server.close(resolve);
      }),
      // close page and phantom
      pageAsPromise.close().then(function () {
        return phantomAsPromise.exit();
      }),
    ]);
  });

  it('should be able to set page property.', function () {
    var value = 'PhantomJS';
    return pageAsPromise
      .set('foo', {})
      .set('foo.bar', value)
      .get('foo')
      .then(function (foo) {
        expect(foo).to.exist;
        expect(foo.bar).to.equal(value);
      });
  });

  describe('"Hello world" page', function () {
  
    before(function () {
      return pageAsPromise
        .open('http://127.0.0.1:' + server.address().port);
    });

    it('should load the fixtures.', function () {
      return pageAsPromise
        .evaluate("function () { return window.emit.toString(); }")
        .then(function (value) {
          expect(value).to.match(/^function/);
        })
    });
    
    it('should be able to load hello world page.', function () {
      return pageAsPromise
        .evaluate("function () { return document.title; }")
        .then(function (value) {
          expect(value).to.match(/^Hello/);
        })
    });

    it('should be able to emit an event.', function (done) {
      pageAsPromise.evaluate("function () { emit('myCustomEvent') }");
      pageAsPromise.once('myCustomEvent', done);
    });

    describe('Custom helpers.', function () {

      it('should be able to use eval helper.', function () {
        return pageAsPromise
          .eval(function () { return document.title; })
          .then(function (value) {
            expect(value).to.match(/^Hello/);
          })
      });

      it('should be able to use promise helper.', function () {
        return pageAsPromise
          .promise(function (resolve) {
            setTimeout(resolve, 10);
          });
      });

      it('should be able to setTimeout on client.', function () {
        var startTime = (new Date()).getTime();
        return pageAsPromise
          .promise(function (resolve) {
            setTimeout(resolve, 1000);
          })
          .then(function () {
            var endTime = (new Date()).getTime();
            expect(endTime - startTime).to.be.at.least(1000);
          });
      });

      it('should be able to wait on client.', function () {
        var limit = Date.now() + 1000;
        return pageAsPromise
          .wait(2000, 'until one second passed', function (limit) {
            return Date.now() > limit;
          }, limit);
      });

      it('should be able to wait for DOM.', function () {
        return Promise.all([
          pageAsPromise
            .sleep(100)
            .eval(function () {
              var element = document.createElement('h2');
              document.querySelector('body').appendChild(element);
            }),

          pageAsPromise
            .waitForDOM('h2'),
        ]);
      });

      it('should be able to read innerHTML', function () {
        return pageAsPromise
          .getText('h1')
          .then(function (text) {
            expect(text).to.match(/^Hello/);
          });
      });


      it('should be able to emulate keyboard.', function () {
        return pageAsPromise
          .eval(function () {
            var element = document.createElement('input');
            element.setAttribute('id', 'myCustomInput');
            element.setAttribute('type', 'text');
            document.querySelector('body').appendChild(element);
          })
          .sendKeys('#myCustomInput', "abcd")
          .getValue('#myCustomInput')
          .then(function (value) {
            expect(value).to.equal('abcd');
          })
      });

      it('should be able to wait until element is not visible.', function () {
        return pageAsPromise
          .eval(function () {
            var element = document.createElement('h2');
            element.setAttribute('id', 'myCustomElement');
            document.querySelector('body').appendChild(element);
          })
          .then(function () {
            return Promise.all([
              pageAsPromise.waitUntilNotVisible('#myCustomElement'),
              pageAsPromise.eval(function () {
                setTimeout(function () {
                  document.querySelector('#myCustomElement').style.display = "none";
                }, 1000);
              })
            ]);
          });
      });

      it('should be able to use user defined helpers.', function () {
        return Promise.all([
          pageAsPromise.waitForMeteor(),
          pageAsPromise.eval(function () {
            setTimeout(function () {
              window.Meteor = {};
            }, 100);
          })
        ]);
      });

      it('should be able to use page-specific helpers.', function () {
        return pageAsPromise.pageSpecificHelper();
      });

    });

  });
  
});
