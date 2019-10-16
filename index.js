'use strict'

const assert = require('assert')
const http = require('http')
const Ajv = require('ajv')
const Request = require('./lib/request')
const Response = require('./lib/response')

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

    return req.prepare(() => dispatchFunc.call(server, req, res))
  } else {
    return new Promise((resolve, reject) => {
      const req = new Request(options)
      const res = new Response(req, resolve, reject)

      req.prepare(() => dispatchFunc.call(server, req, res))
    })
  }
}

function Chain (dispatch, option) {
  this.option = Object.assign({}, option)
  this.dispatch = dispatch
  this._promise = null
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
    this.option.url = url
    this.option.method = method.toUpperCase()
    return this
  }
})

const chainMethods = [
  'body',
  'headers',
  'payload',
  'query'
]

chainMethods.forEach(method => {
  Chain.prototype[method] = function (value) {
    this.option[method] = value
    return this
  }
})

Chain.prototype.end = function (callback) {
  doInject(this.dispatch, this.option, callback)
}

Object.getOwnPropertyNames(Promise.prototype).forEach(method => {
  if (method === 'constructor') return
  Chain.prototype[method] = function (...args) {
    if (!this._promise) {
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
module.exports.isInjection = isInjection
