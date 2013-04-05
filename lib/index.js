// Load modules

var Util = require('util');
var Http = require('http');
var Stream = require('stream');


// Declare internals

var internals = {};


internals.Request = function (options) {

    var self = this;

    Stream.Readable.call(this);

    // options: method, url, payload, headers

    this.url = options.url;
    this.method = options.method.toUpperCase();
    this.headers = options.headers || {};
    this.headers['user-agent'] = this.headers['user-agent'] || 'shot'
    this.httpVersion = '1.1';

    // Use _shot namespace to avoid collision with Node

    this._shot = {
        payload: options.payload || null,
        listeners: {},
        isDone: false,
        simulate: options.simulate || {}
    };

    return this;
};

Util.inherits(internals.Request, Stream.Readable);


internals.Request.prototype._read = function (size) {

    var self = this;

    if (this._shot.isDone) {
        this.push(null);
        return;
    }

    this._shot.isDone = true;

    if (this._shot.payload) {
        this.push(this._shot.payload);
    }

    setImmediate(function () {

        if (self._shot.simulate.error) {
            self.emit('error', new Error('Simulated'));
        }

        if (self._shot.simulate.close) {
            self.emit('close');
        }

        if (self._shot.simulate.end !== false) {                                    // 'end' defaults to true
            self.push(null);
        }
    });
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

    if (!this._shot) {
        return;
    }

    Http.ServerResponse.prototype.end.call(this, data, encoding);
    this.emit('finish');                                            // Will not be emitted internally on an inactive socket

    // Prepare response object

    var res = {
        raw: {
            req: this._shot.req,
            res: this
        },
        headers: this._headers,
        statusCode: this.statusCode
    };

    // Parse payload

    var output = '';

    if (self.output &&
        self.output instanceof Array &&
        self.output.length) {

        for (var i = 0, il = self.output.length; i < il; ++i) {
            if (self.output[i] instanceof Buffer) {
                output += self.output[i].toString();
            }
            else {
                output += new Buffer(self.output[i], self.outputEncodings[i]).toString();
            }
        }
    }

    var sep = output.indexOf('\r\n\r\n');
    var payloadBlock = output.slice(sep + 4);
    var headerBlock = output.slice(0, sep);

    if (headerBlock.indexOf('Transfer-Encoding: chunked') !== -1) {
        var rest = payloadBlock;
        res.payload = '';

        while (rest) {
            var next = rest.indexOf('\r\n');
            var size = parseInt(rest.slice(0, next), 16);
            if (size === 0) {
                break;
            }

            res.payload += rest.substr(next + 2, size);
            rest = rest.slice(next + 2 + size + 2);
        }
    }
    else {
        res.payload = payloadBlock;
    }

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


