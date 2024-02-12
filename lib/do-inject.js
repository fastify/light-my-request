'use strict'

const assert = require('node:assert')
const optsValidator = require('./config-validator')
const Request = require('./request')
const Response = require('./response')

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

  const req = new RequestConstructor(options)
  if (typeof callback === 'function') {
    const res = new Response(req, callback)

    return makeRequest(dispatchFunc, server, req, res)
  } else {
    return new Promise((resolve, reject) => {
      const res = new Response(req, (err, data) => {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      })

      makeRequest(dispatchFunc, server, req, res)
    })
  }
}

module.exports = doInject
