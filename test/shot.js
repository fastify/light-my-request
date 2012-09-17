// Load modules

var Should = require('should');
var Shot = require('../lib/shot');


describe('shot', function () {

    var reply = 'Hello World';
    var dispatch = function (req, res) {

        res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': reply.length });
        res.end(reply);
    };

    describe('#inject', function () {
        it('should return the payload', function (done) {
            (function () {
                Shot.inject(dispatch, { method: 'get', url: '/' }, function (res) {

                    res.readPayload().should.equal(reply);
                });
            }).should.not.throw();
            done();
        })
    });
});

