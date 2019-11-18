'use strict'

const http = require('http')
const { Writable } = require('readable-stream')
const util = require('util')

function Response (req, onEnd, reject) {
  http.ServerResponse.call(this, {
    method: req.method,
    httpVersionMajor: 1,
    httpVersionMinor: 1
  })

  this._lightMyRequest = { headers: null, trailers: {}, payloadChunks: [] }
  // This forces node@8 to always render the headers
  this.setHeader('foo', 'bar'); this.removeHeader('foo')

  this.assignSocket(getNullSocket())

  this._promiseCallback = typeof reject === 'function'

  const onEndSuccess = (payload) => {
    if (this._promiseCallback) {
      return process.nextTick(() => onEnd(payload))
    }
    process.nextTick(() => onEnd(null, payload))
  }

  const onEndFailure = (err) => {
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
}

util.inherits(Response, http.ServerResponse)

Response.prototype.writeHead = function () {
  const result = http.ServerResponse.prototype.writeHead.apply(this, arguments)

  const _headers = this.getHeaders ? this.getHeaders() : this._headers
  this._lightMyRequest.headers = Object.assign({}, _headers)

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
}

Response.prototype.destroy = function () {}

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
    trailers: {}
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
    if (this.headers['content-type'].indexOf('application/json') < 0) {
      throw new Error('The content-type of the response is not application/json')
    }
    return JSON.parse(this.payload)
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
