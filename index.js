'use strict'

const assert = require('assert')
const http = require('http')
const Ajv = require('ajv')
const Request = require('./lib/request')
const Response = require('./lib/response')

const errorMessage = 'The dispatch function has already been invoked'
const urlSchema = {
  oneOf: [
    { type: 'string' },
    {
      type: 'object',
      properties: {
        protocol: { type: 'string' },
        hostname: { type: 'string' },
        pathname: { type: 'string' }
        // port type => any
        // query type => any
      },
      additionalProperties: true,
      required: ['pathname']
    }
  ]
}

const ajv = new Ajv()
const schema = {
  type: 'object',
  properties: {
    url: urlSchema,
    path: urlSchema,
    cookies: {
      type: 'object',
      additionalProperties: true
    },
    headers: {
      type: 'object',
      additionalProperties: true
    },
    query: {
      type: 'object',
      additionalProperties: true
    },
    simulate: {
      type: 'object',
      properties: {
        end: { type: 'boolean' },
        split: { type: 'boolean' },
        error: { type: 'boolean' },
        close: { type: 'boolean' }
      }
    },
    authority: { type: 'string' },
    remoteAddress: { type: 'string' },
    method: { type: 'string', enum: http.METHODS.concat(http.METHODS.map(toLowerCase)) },
    validate: { type: 'boolean' }
    // payload type => any
  },
  additionalProperties: true,
  oneOf: [
    { required: ['url'] },
    { required: ['path'] }
  ]
}

const optsValidator = ajv.compile(schema)

function inject (dispatchFunc, options, callback) {
  if (typeof callback === 'undefined') {
    return new Chain(dispatchFunc, options)
  } else {
    return doInject(dispatchFunc, options, callback)
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

  if (typeof callback === 'function') {
    const req = new Request(options)
    const res = new Response(req, callback)

    return makeRequest(dispatchFunc, server, req, res)
  } else {
    return new Promise((resolve, reject) => {
      const req = new Request(options)
      const res = new Response(req, resolve, reject)

      makeRequest(dispatchFunc, server, req, res)
    })
  }
}

function Chain (dispatch, option) {
  if (typeof option === 'string') {
    this.option = { url: option }
  } else {
    this.option = Object.assign({}, option)
  }

  this.dispatch = dispatch
  this._hasInvoked = false
  this._promise = null

  if (this.option.autoStart !== false) {
    process.nextTick(() => {
      if (!this._hasInvoked) {
        this.end()
      }
    })
  }
}

const httpMethods = [
  'delete',
  'get',
  'head',
  'options',
  'patch',
  'post',
  'put',
  'trace'
]

httpMethods.forEach(method => {
  Chain.prototype[method] = function (url) {
    if (this._hasInvoked === true || this._promise) {
      throw new Error(errorMessage)
    }
    this.option.url = url
    this.option.method = method.toUpperCase()
    return this
  }
})

const chainMethods = [
  'body',
  'cookies',
  'headers',
  'payload',
  'query'
]

chainMethods.forEach(method => {
  Chain.prototype[method] = function (value) {
    if (this._hasInvoked === true || this._promise) {
      throw new Error(errorMessage)
    }
    this.option[method] = value
    return this
  }
})

Chain.prototype.end = function (callback) {
  if (this._hasInvoked === true || this._promise) {
    throw new Error(errorMessage)
  }
  this._hasInvoked = true
  if (typeof callback === 'function') {
    doInject(this.dispatch, this.option, callback)
  } else {
    this._promise = doInject(this.dispatch, this.option)
    return this._promise
  }
}

Object.getOwnPropertyNames(Promise.prototype).forEach(method => {
  if (method === 'constructor') return
  Chain.prototype[method] = function (...args) {
    if (!this._promise) {
      if (this._hasInvoked === true) {
        throw new Error(errorMessage)
      }
      this._hasInvoked = true
      this._promise = doInject(this.dispatch, this.option)
    }
    return this._promise[method](...args)
  }
})

function isInjection (obj) {
  return (obj instanceof Request || obj instanceof Response)
}

function toLowerCase (m) { return m.toLowerCase() }

module.exports = inject
module.exports.inject = inject
module.exports.isInjection = isInjection
