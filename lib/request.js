'use strict'

const Stream = require('stream')
const Url = require('url')
const util = require('util')

function Request (options) {
  Stream.Readable.call(this)
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

  var payload = options.payload || null
  if (payload && typeof payload !== 'string' && !(payload instanceof Stream) && !Buffer.isBuffer(payload)) {
    payload = JSON.stringify(payload)
    this.headers['content-type'] = this.headers['content-type'] || 'application/json'
  }

  // Set the content-length for the corresponding payload if none set
  if (payload && !(payload instanceof Stream) && !this.headers.hasOwnProperty('content-length')) {
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

util.inherits(Request, Stream.Readable)

Request.prototype.prepare = function (next) {
  if (this._lightMyRequest.payload instanceof Stream === false) {
    return next()
  }

  const chunks = []

  this._lightMyRequest.payload.on('data', (chunk) => chunks.push(Buffer.from(chunk)))

  this._lightMyRequest.payload.on('end', () => {
    const payload = Buffer.concat(chunks)
    this.headers['content-length'] = this.headers['content-length'] || ('' + payload.length)
    this._lightMyRequest.payload = payload
    return next()
  })
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
