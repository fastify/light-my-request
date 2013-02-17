// Load modules

var Chai = require('chai');
var Shot = require('../lib');


// Declare internals

var internals = {};


// Test shortcuts

var expect = Chai.expect;


describe('Shot', function () {

    var reply = 'Hello World';
    var dispatch = function (req, res) {

        res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': reply.length });
        res.end(reply);
    };

    describe('#inject', function () {

        it('should return the payload', function (done) {

            Shot.inject(dispatch, { method: 'get', url: '/' }, function (res) {

                expect(res.readPayload()).to.equal(reply);
                done();
            });
        })
    });
});

