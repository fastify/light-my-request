// Load modules

var Util = require('util');
var Http = require('http');


// Declare internals

var internals = {};


internals.Request = function (options) {

    // options: method, url, payload, headers

    this.url = options.url;
    this.method = options.method.toUpperCase();
    this.headers = options.headers || {};
    this.headers['user-agent'] = this.headers['user-agent'] || 'shot'
    this.httpVersion = '1.1';

    this._payload = options.payload;
    return this;
};


internals.Request.prototype.on = internals.Request.prototype.addListener = function (event, callback) {

    if (event === 'data') {
        if (this._payload) {
            callback(this._payload);
        }
    }
    else if (event === 'end') {
        callback();
    }
};


internals.Request.prototype.pause = function () {

};


internals.Request.prototype.resume = function () {

};


internals.Request.prototype.setEncoding = function () {

};


internals.Response = function (req, onEnd) {

    Http.ServerResponse.call(this, { method: req.method, httpVersionMajor: 1, httpVersionMinor: 1 });

    this.shot = {
        req: req,
        onEnd: onEnd
    };

    return this;
};

Util.inherits(internals.Response, Http.ServerResponse);


internals.Response.prototype.write = function (chunk, encoding) {

    Http.ServerResponse.prototype.write.call(this, chunk, encoding);
    return true;
};


internals.Response.prototype.end = function (data, encoding) {

    Http.ServerResponse.prototype.end.call(this, data, encoding);
    this.emit('finish');                                            // Will not be emitted internally on an inactive socket
    this.shot.onEnd(this);
};


internals.Response.prototype.readPayload = function () {

    if (!this.output ||
        !(this.output instanceof Array) ||
        !this.output.length) {

        // Missing or invalid output
        return null;
    }

    if (this.output.length === 1) {
        // Single string output
        return this.output[0].slice(this.output[0].indexOf('\r\n\r\n') + 4);
    }

    var output = '';
    for (var i = 1, il = this.output.length; i < il; ++i) {         // Skip header
        if (this.output[i] instanceof Buffer) {
            // Buffer
            output += this.output[i].toString();
        }
        else {
            // String
            output += this.output[i];
        }
    }

    return output;
};


exports.inject = function (dispatchFunc, options, callback) {

    var req = new internals.Request(options);
    var res = new internals.Response(req, callback);
    dispatchFunc(req, res);
};


exports.isInjection = function (obj) {

    return (obj instanceof internals.Request || obj instanceof internals.Response);
};


