'use strict'

/* eslint no-prototype-builtins: 0 */

const { Readable, addAbortSignal } = require('node:stream')
const cookie = require('cookie')
const assert = require('node:assert')
const warning = require('process-warning')()

const parseURL = require('./parse-url')
const { EventEmitter } = require('node:events')

// request.connectin deprecation https://nodejs.org/api/http.html#http_request_connection
warning.create('FastifyDeprecationLightMyRequest', 'FST_LIGHTMYREQUEST_DEP01', 'You are accessing "request.connection", use "request.socket" instead.')

/**
 * Get hostname:port
 *
 * @param {URL} parsedURL
 * @return {String}
 */
function hostHeaderFromURL (parsedURL) {
  return parsedURL.port
    ? parsedURL.host
    : parsedURL.hostname + (parsedURL.protocol === 'https:' ? ':443' : ':80')
}

/**
 * Mock socket object used to fake access to a socket for a request
 *
 * @constructor
 * @param {String} remoteAddress the fake address to show consumers of the socket
 */
class MockSocket extends EventEmitter {
  constructor (remoteAddress) {
    super()
    this.remoteAddress = remoteAddress
  }
}

class Request extends Readable {
  /**
   * Request
   *
   * @param {Object} options
   * @param {(Object|String)} options.url || options.path
   * @param {String} [options.method='GET']
   * @param {String} [options.remoteAddress]
   * @param {Object} [options.cookies]
   * @param {Object} [options.headers]
   * @param {Object} [options.query]
   * @param {any} [options.payload]
   */
  constructor (options) {
    super({ autoDestroy: false })
    const parsedURL = parseURL(options.url || options.path, options.query)

    this.url = parsedURL.pathname + parsedURL.search

    this.aborted = false
    this.httpVersionMajor = 1
    this.httpVersionMinor = 1
    this.httpVersion = '1.1'
    this.method = options.method ? options.method.toUpperCase() : 'GET'

    this.headers = {}
    this.rawHeaders = []
    const headers = options.headers || {}

    for (const field in headers) {
      const fieldLowerCase = field.toLowerCase()
      if (
        (
          fieldLowerCase === 'user-agent' ||
        fieldLowerCase === 'content-type'
        ) && headers[field] === undefined
      ) {
        this.headers[fieldLowerCase] = undefined
        continue
      }
      const value = headers[field]
      assert(value !== undefined, 'invalid value "undefined" for header ' + field)
      this.headers[fieldLowerCase] = '' + value
    }

    if (('user-agent' in this.headers) === false) {
      this.headers['user-agent'] = 'lightMyRequest'
    }
    this.headers.host = this.headers.host || options.authority || hostHeaderFromURL(parsedURL)

    if (options.cookies) {
      const { cookies } = options
      const cookieValues = Object.keys(cookies).map(key => cookie.serialize(key, cookies[key]))
      if (this.headers.cookie) {
        cookieValues.unshift(this.headers.cookie)
      }
      this.headers.cookie = cookieValues.join('; ')
    }

    this.socket = new MockSocket(options.remoteAddress || '127.0.0.1')

    Object.defineProperty(this, 'connection', {
      get () {
        warning.emit('FST_LIGHTMYREQUEST_DEP01')
        return this.socket
      },
      configurable: true
    })

    // we keep both payload and body for compatibility reasons
    let payload = options.payload || options.body || null
    const payloadResume = payload && typeof payload.resume === 'function'

    if (payload && typeof payload !== 'string' && !payloadResume && !Buffer.isBuffer(payload)) {
      payload = JSON.stringify(payload)

      if (('content-type' in this.headers) === false) {
        this.headers['content-type'] = 'application/json'
      }
    }

    // Set the content-length for the corresponding payload if none set
    if (payload && !payloadResume && !Object.prototype.hasOwnProperty.call(this.headers, 'content-length')) {
      this.headers['content-length'] = (Buffer.isBuffer(payload) ? payload.length : Buffer.byteLength(payload)).toString()
    }

    for (const header of Object.keys(this.headers)) {
      this.rawHeaders.push(header, this.headers[header])
    }

    // Use _lightMyRequest namespace to avoid collision with Node
    this._lightMyRequest = {
      payload,
      isDone: false,
      simulate: options.simulate || {}
    }

    const signal = options.signal
    /* istanbul ignore if  */
    if (signal) {
      addAbortSignal(signal, this)
    }
  }

  prepare (next) {
    const payload = this._lightMyRequest.payload
    if (!payload || typeof payload.resume !== 'function') { // does not quack like a stream
      return next()
    }

    const chunks = []

    payload.on('data', (chunk) => chunks.push(Buffer.from(chunk)))

    payload.on('end', () => {
      const payload = Buffer.concat(chunks)
      this.headers['content-length'] = this.headers['content-length'] || ('' + payload.length)
      this._lightMyRequest.payload = payload
      return next()
    })

    // Force to resume the stream. Needed for Stream 1
    payload.resume()
  }

  _read (size) {
    setImmediate(() => {
      if (this._lightMyRequest.isDone) {
        // 'end' defaults to true
        if (this._lightMyRequest.simulate.end !== false) {
          this.push(null)
        }

        return
      }

      this._lightMyRequest.isDone = true

      if (this._lightMyRequest.payload) {
        if (this._lightMyRequest.simulate.split) {
          this.push(this._lightMyRequest.payload.slice(0, 1))
          this.push(this._lightMyRequest.payload.slice(1))
        } else {
          this.push(this._lightMyRequest.payload)
        }
      }

      if (this._lightMyRequest.simulate.error) {
        this.emit('error', new Error('Simulated'))
      }

      if (this._lightMyRequest.simulate.close) {
        this.emit('close')
      }

      // 'end' defaults to true
      if (this._lightMyRequest.simulate.end !== false) {
        this.push(null)
      }
    })
  }

  destroy (error) {
    if (this.destroyed || this._lightMyRequest.isDone) return
    this.destroyed = true

    if (error) {
      this._error = true
      process.nextTick(() => this.emit('error', error))
    }

    process.nextTick(() => this.emit('close'))
  }
}

/**
 * @template T
 * @param {new (opt: import('../types').InjectOptions) => T} CustomRequest
 * @returns {new (opt: import('../types').InjectOptions) => T & Request}
 */
function getCustomRequest (CustomRequest) {
  class _CustomLMRRequest extends CustomRequest {
    constructor (...opt) {
      super(...opt)
      Object.assign(this, new Request(...opt))
    }
  }
  Object.getOwnPropertyNames(Request.prototype)
    .filter(prop => prop !== 'constructor')
    .forEach(prop => { _CustomLMRRequest.prototype[prop] = Request.prototype[prop] })
  return _CustomLMRRequest
}

module.exports = Request
module.exports.Request = Request
module.exports.getCustomRequest = getCustomRequest
