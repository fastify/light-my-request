// Load modules

var Util = require('util');
var Http = require('http');
var Stream = require('stream');


// Declare internals

var internals = {};


internals.Request = function (options) {

    Stream.call(this);

    // options: method, url, payload, headers

    this.url = options.url;
    this.method = options.method.toUpperCase();
    this.headers = options.headers || {};
    this.headers['user-agent'] = this.headers['user-agent'] || 'shot'
    this.httpVersion = '1.1';

    this._payload = options.payload;
    return this;
};

Util.inherits(internals.Request, Stream);


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


internals.Request.prototype.destroy = function () {

};


internals.Response = function (req, onEnd) {

    Http.ServerResponse.call(this, { method: req.method, httpVersionMajor: 1, httpVersionMinor: 1 });

    this._shot = {
        req: req,
        onEnd: onEnd
    };

    return this;
};

Util.inherits(internals.Response, Http.ServerResponse);


internals.Response.prototype.writeHead = function () {

    var headers = ((arguments.length === 2 && typeof arguments[1] === 'object') ? arguments[1] : (arguments.length === 3 ? arguments[2] : {}));
    var result = Http.ServerResponse.prototype.writeHead.apply(this, arguments);

    this._headers = this._headers || {};
    var keys = Object.keys(headers);
    for (var i = 0, il = keys.length; i < il; ++i) {
        this._headers[keys[i]] = headers[keys[i]];
    }

    return result;
};


internals.Response.prototype.write = function (chunk, encoding) {

    Http.ServerResponse.prototype.write.call(this, chunk, encoding);
    return true;
};


internals.Response.prototype.end = function (data, encoding) {

    var self = this;

    Http.ServerResponse.prototype.end.call(this, data, encoding);
    this.emit('finish');                                            // Will not be emitted internally on an inactive socket

    // Prepare response object

    var res = {
        raw: {
            req: this._shot.req,
            res: this
        },
        headers: this._headers,
        statusCode: this.statusCode,

        readPayload: function () {

            if (!self.output ||
                !(self.output instanceof Array) ||
                !self.output.length) {

                // Missing or invalid output
                return null;
            }

            if (self.output.length === 1) {
                // Single string output
                return self.output[0].slice(self.output[0].indexOf('\r\n\r\n') + 4);
            }

            var output = '';
            for (var i = 1, il = self.output.length; i < il; ++i) {         // Skip header
                if (self.output[i] instanceof Buffer) {
                    // Buffer
                    output += self.output[i].toString();
                }
                else {
                    // String
                    output += self.output[i];
                }
            }

            return output;
        }
    };

    // Callback response

    var onEnd = this._shot.onEnd;
    delete this._shot;
    onEnd(res);
};


internals.Response.prototype.destroy = function () {

};


exports.inject = function (dispatchFunc, options, callback) {

    var req = new internals.Request(options);
    var res = new internals.Response(req, callback);
    dispatchFunc(req, res);
};


exports.isInjection = function (obj) {

    return (obj instanceof internals.Request || obj instanceof internals.Response);
};


