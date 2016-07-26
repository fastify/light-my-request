'use strict';

// Load modules

const Joi = require('joi');
const Request = require('./request');
const Response = require('./response');
const Schema = require('./schema');

exports.inject = function (dispatchFunc, options, callback) {

    Joi.assert({
        dispatchFunc: dispatchFunc,
        options: options,
        callback: callback
    }, Schema);

    const req = new Request(options);
    const res = new Response(req, callback);

    return req.prepare(() => dispatchFunc(req, res));
};


exports.isInjection = function (obj) {

    return (obj instanceof Request || obj instanceof Response);
};
