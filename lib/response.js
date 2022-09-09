'use strict'

const http = require('http')
const { Writable } = require('stream')
const util = require('util')

const setCookie = require('set-cookie-parser')

function Response (req, onEnd, reject) {
  http.ServerResponse.call(this, req)

  this._lightMyRequest = { headers: null, trailers: {}, payloadChunks: [] }
  // This forces node@8 to always render the headers
  this.setHeader('foo', 'bar'); this.removeHeader('foo')

  this.assignSocket(getNullSocket())

  this._promiseCallback = typeof reject === 'function'

  let called = false
  const onEndSuccess = (payload) => {
    // no need to early-return if already called because this handler is bound `once`
    called = true
    if (this._promiseCallback) {
      return process.nextTick(() => onEnd(payload))
    }
    process.nextTick(() => onEnd(null, payload))
  }

  const onEndFailure = (err) => {
    if (called) return
    called = true
    if (this._promiseCallback) {
      return process.nextTick(() => reject(err))
    }
    process.nextTick(() => onEnd(err, null))
  }

  this.once('finish', () => {
    const res = generatePayload(this)
    res.raw.req = req
    onEndSuccess(res)
  })

  this.connection.once('error', onEndFailure)

  this.once('error', onEndFailure)

  this.once('close', onEndFailure)
}

util.inherits(Response, http.ServerResponse)

Response.prototype.setTimeout = function (msecs, callback) {
  this.timeoutHandle = setTimeout(() => {
    this.emit('timeout')
  }, msecs)
  this.on('timeout', callback)
  return this
}

Response.prototype.writeHead = function () {
  const result = http.ServerResponse.prototype.writeHead.apply(this, arguments)

  this._lightMyRequest.headers = Object.assign({}, this.getHeaders())

  // Add raw headers
  ;['Date', 'Connection', 'Transfer-Encoding'].forEach((name) => {
    const regex = new RegExp('\\r\\n' + name + ': ([^\\r]*)\\r\\n')
    const field = this._header.match(regex)
    if (field) {
      this._lightMyRequest.headers[name.toLowerCase()] = field[1]
    }
  })

  return result
}

Response.prototype.write = function (data, encoding, callback) {
  if (this.timeoutHandle) {
    clearTimeout(this.timeoutHandle)
  }
  http.ServerResponse.prototype.write.call(this, data, encoding, callback)
  this._lightMyRequest.payloadChunks.push(Buffer.from(data, encoding))
  return true
}

Response.prototype.end = function (data, encoding, callback) {
  if (data) {
    this.write(data, encoding)
  }

  http.ServerResponse.prototype.end.call(this, callback)

  this.emit('finish')

  // We need to emit 'close' otherwise stream.finished() would
  // not pick it up on Node v16

  this.destroy()
}

Response.prototype.destroy = function (error) {
  if (this.destroyed) return
  this.destroyed = true

  if (error) {
    process.nextTick(() => this.emit('error', error))
  }

  process.nextTick(() => this.emit('close'))
}

Response.prototype.addTrailers = function (trailers) {
  for (const key in trailers) {
    this._lightMyRequest.trailers[key.toLowerCase().trim()] = trailers[key].toString().trim()
  }
}

function generatePayload (response) {
  // Prepare response object
  const res = {
    raw: {
      res: response
    },
    headers: response._lightMyRequest.headers,
    statusCode: response.statusCode,
    statusMessage: response.statusMessage,
    trailers: {},
    get cookies () {
      return setCookie.parse(this)
    }
  }

  // Prepare payload and trailers
  const rawBuffer = Buffer.concat(response._lightMyRequest.payloadChunks)
  res.rawPayload = rawBuffer

  // we keep both of them for compatibility reasons
  res.payload = rawBuffer.toString()
  res.body = res.payload
  res.trailers = response._lightMyRequest.trailers

  // Prepare payload parsers
  res.json = function parseJsonPayload () {
    if (res.headers['content-type'].indexOf('application/json') < 0) {
      throw new Error('The content-type of the response is not application/json')
    }
    return JSON.parse(res.payload)
  }

  return res
}

// Throws away all written data to prevent response from buffering payload
function getNullSocket () {
  return new Writable({
    write (chunk, encoding, callback) {
      setImmediate(callback)
    }
  })
}

module.exports = Response
