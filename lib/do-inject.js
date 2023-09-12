'use strict'

const assert = require('node:assert')
const optsValidator = require('./config-validator')
const Request = require('./request')
const Response = require('./response')

function promisify (fn) {
  if (fn) {
    return { ret: Promise.resolve(), cb: fn }
  }
  let resolve, reject
  const ret = new Promise((_resolve, _reject) => {
    resolve = _resolve
    reject = _reject
  })
  return {
    ret,
    cb: (err, res) => {
      err ? reject(err) : resolve(res)
    }
  }
}

function makeRequest (dispatchFunc, server, req, res) {
  req.once('error', function (err) {
    if (this.destroyed) res.destroy(err)
  })

  req.once('close', function () {
    if (this.destroyed && !this._error) res.destroy()
  })

  return req.prepare(() => dispatchFunc.call(server, req, res))
}

function doInject (dispatchFunc, options, callback) {
  options = (typeof options === 'string' ? { url: options } : options)

  if (options.validate !== false) {
    assert(typeof dispatchFunc === 'function', 'dispatchFunc should be a function')
    const isOptionValid = optsValidator(options)
    if (!isOptionValid) {
      throw new Error(optsValidator.errors.map(e => e.message))
    }
  }

  const server = options.server || {}

  const RequestConstructor = options.Request
    ? Request.getCustomRequest(options.Request)
    : Request

  // Express.js detection
  if (dispatchFunc.request && dispatchFunc.request.app === dispatchFunc) {
    Object.setPrototypeOf(Object.getPrototypeOf(dispatchFunc.request), RequestConstructor.prototype)
    Object.setPrototypeOf(Object.getPrototypeOf(dispatchFunc.response), Response.prototype)
  }

  const { ret, cb } = promisify(callback)

  const req = new RequestConstructor(options)
  const res = new Response(req, cb)

  return Promise.resolve().then(() => makeRequest(dispatchFunc, server, req, res)).then(() => ret)
}

module.exports = doInject
