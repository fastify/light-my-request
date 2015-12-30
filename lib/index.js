'use strict';

// Load modules

const Hoek = require('hoek');
const Request = require('./request');
const Response = require('./response');


exports.inject = function (dispatchFunc, options, callback) {

    options = (typeof options === 'string' ? { url: options } : options);
    const settings = Hoek.applyToDefaults({ method: 'GET' }, options);

    const req = new Request(settings);
    const res = new Response(req, callback);
    dispatchFunc(req, res);
};


exports.isInjection = function (obj) {

    return (obj instanceof Request || obj instanceof Response);
};
