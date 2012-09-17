// Load modules

var Http = require('http');
var Shot = require('../lib/shot');


// Declare internals

var internals = {};


internals.main = function () {

    var dispatch = function (req, res) {

        var reply = 'Hello World';
        res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': reply.length });
        res.end(reply);
    };

    var server = Http.createServer(dispatch);

    // server.listen(1337, '127.0.0.1');

    Shot.inject(dispatch, { method: 'get', url: '/' }, function (res) {

        console.log(res.readPayload());
    });
};


internals.main();

