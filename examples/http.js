// Load modules

var Shot = require('..');


// Declare internals

var internals = {};


internals.main = function () {

    var dispatch = function (req, res) {

        var reply = 'Hello World';
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(reply);
    };

    Shot.inject(dispatch, { method: 'get', url: '/' }, function (res) {

        console.log(res.payload);
    });
};


internals.main();
