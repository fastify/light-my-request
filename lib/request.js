'use strict'

/* eslint no-prototype-builtins: 0 */

const { Readable } = require('stream')
const cookie = require('cookie')
const assert = require('assert')
const warning = require('process-warning')()

const parseURL = require('./parse-url')
const { IncomingMessage } = require('http')
const { Socket } = require('net')

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
class MockSocket extends Socket {
  constructor (remoteAddress) {
    super()
    Object.defineProperty(this, 'remoteAddress', {
      __proto__: null,
      configurable: false,
      enumerable: true,
      get: () => remoteAddress
    })
  }
}

class Request extends IncomingMessage {
  static errors = {
    ContentLength: class ContentLengthError extends Error {
      constructor () {
        super('Content length is different than the value specified by the Content-Length header')
      }
    }
  }

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
   * @param {{end: boolean,split: boolean,error: boolean,close: boolean}} [options.simulate]
   * @param {any} [options.payload]
   */
  constructor (options) {
    super(new MockSocket(options.remoteAddress || '127.0.0.1'))
    const parsedURL = parseURL(options.url || options.path, options.query)

    this.url = parsedURL.pathname + parsedURL.search

    this.aborted = false
    this.httpVersionMajor = 1
    this.httpVersionMinor = 1
    this.httpVersion = '1.1'
    this.method = options.method ? options.method.toUpperCase() : 'GET'

    // Use _lightMyRequest namespace to avoid collision with Node
    this._lightMyRequest = {
      payload: options.payload || options.body || null,
      isDone: false,
      simulate: options.simulate || {},
      authority: options.authority,
      cookies: options.cookies,
      hostHeader: hostHeaderFromURL(parsedURL)
    }

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

    Object.defineProperty(this, 'connection', {
      get () {
        warning.emit('FST_LIGHTMYREQUEST_DEP01')
        return this.socket
      },
      configurable: true
    })
  }

  getLength (payload) {
    if (typeof payload === 'string') {
      return Buffer.byteLength(payload)
    }

    return payload.length
  }

  parseHeader () {
    if (('user-agent' in this.headers) === false) {
      this.headers['user-agent'] = 'lightMyRequest'
    }
    this.headers.host = this.headers.host || this._lightMyRequest.authority || this._lightMyRequest.hostHeader

    if (this._lightMyRequest.cookies) {
      const { cookies } = this._lightMyRequest
      const cookieValues = Object.keys(cookies).map(key => cookie.serialize(key, cookies[key]))
      if (this.headers.cookie) {
        cookieValues.unshift(this.headers.cookie)
      }
      this.headers.cookie = cookieValues.join('; ')
    }
  }

  parsePayload () {
    // we keep both payload and body for compatibility reasons
    let payload = this._lightMyRequest.payload
    const payloadResume = payload && typeof payload.resume === 'function'

    if (payload && typeof payload !== 'string' && !payloadResume && !Buffer.isBuffer(payload)) {
      payload = JSON.stringify(payload)

      if (('content-type' in this.headers) === false) {
        this.headers['content-type'] = 'application/json'
      }
    }

    if (this._lightMyRequest.simulate.end === false) {
      const prevPayload = payload
      if (payloadResume) {
        payload = new Readable({
          read (n) {
            prevPayload.read(n)
          }
        })
        prevPayload.on('data', (d) => {
          payload.push(d)
        })
      } else {
        payload = new Readable({
          read (n) {
            if (prevPayload) this.push(prevPayload)
            this.pause()
          }
        })
      }
    }

    this._lightMyRequest.payload = payload
  }

  prepare (next, onError) {
    this.parseHeader()
    this.parsePayload()
    for (const header of Object.keys(this.headers)) {
      this.rawHeaders.push(header, this.headers[header])
    }
    let payload = this._lightMyRequest.payload
    this.complete = true
    if (payload) {
      if (typeof payload.resume !== 'function') {
        const length = this.getLength(payload)
        if (this.headers['content-length']) {
          if (this.headers['content-length'].toString() > length.toString()) {
            return onError(new Request.errors.ContentLength())
          }
          payload = payload.slice(0, this.headers['content-length'])
        } else {
          this.headers['content-length'] = length?.toString()
        }
        this.push(payload)
        this.push(null)
      } else {
        let i = 0
        const max = this.headers['content-length'] ? parseInt(this.headers['content-length'], 10) : null
        payload.on('data', (chunk) => {
          if (max != null) {
            if (max > i && max <= i + chunk.length) {
              this.push(chunk.slice(0, max - i))
            }
          } else {
            this.push(chunk)
          }
          i += chunk.length
        })
        payload.on('end', () => {
          if (max != null) {
            if (max > i) {
              return onError(new Request.errors.ContentLength())
            }
          }
          this.push(null)
        })
        payload.resume()
      }
    } else {
      if (this.headers['content-length'] && this.headers['content-length'] !== '0') {
        return onError(new Request.errors.ContentLength())
      }
      this.push(null)
    }
    return next()
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
