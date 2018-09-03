'use strict'

const { Readable } = require('readable-stream')
const Url = require('url')
const util = require('util')

function Request (options) {
  Readable.call(this)
  // options: method, url, payload, headers, remoteAddress
  var url = options.url
  if (typeof url === 'object') {
    url = Url.format(url)
  }

  const uri = Url.parse(url)
  this.url = uri.path

  this.httpVersion = '1.1'
  this.method = options.method ? options.method.toUpperCase() : 'GET'

  this.headers = {}
  const headers = options.headers || {}
  const fields = Object.keys(headers)
  fields.forEach((field) => {
    this.headers[field.toLowerCase()] = headers[field]
  })

  this.headers['user-agent'] = this.headers['user-agent'] || 'lightMyRequest'

  const hostHeaderFromUri = function () {
    if (uri.port) {
      return uri.host
    }

    if (uri.protocol) {
      return uri.hostname + (uri.protocol === 'https:' ? ':443' : ':80')
    }

    return null
  }
  this.headers.host = this.headers.host || hostHeaderFromUri() || options.authority || 'localhost:80'

  this.connection = {
    remoteAddress: options.remoteAddress || '127.0.0.1'
  }

  // we keep both payload and body for compatibility reasons
  var payload = options.payload || options.body || null
  if (payload && typeof payload !== 'string' && !(typeof payload.resume === 'function') && !Buffer.isBuffer(payload)) {
    payload = JSON.stringify(payload)
    this.headers['content-type'] = this.headers['content-type'] || 'application/json'
  }

  // Set the content-length for the corresponding payload if none set
  if (payload && !(typeof payload.resume === 'function') && !this.headers.hasOwnProperty('content-length')) {
    this.headers['content-length'] = (Buffer.isBuffer(payload) ? payload.length : Buffer.byteLength(payload)).toString()
  }

  // Use _lightMyRequest namespace to avoid collision with Node
  this._lightMyRequest = {
    payload,
    isDone: false,
    simulate: options.simulate || {}
  }

  return this
}

util.inherits(Request, Readable)

Request.prototype.prepare = function (next) {
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

Request.prototype._read = function (size) {
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

Request.prototype.destroy = function () {}

module.exports = Request
