'use strict'

const http = require('node:http')
const { Writable } = require('node:stream')

const setCookie = require('set-cookie-parser')

// Throws away all written data to prevent response from buffering payload
function getNullSocket () {
  return new Writable({
    write (chunk, encoding, callback) {
      setImmediate(callback)
    }
  })
}

class Response extends http.ServerResponse {
  constructor (req, onEnd) {
    super(req)
    this._lightMyRequest = { headers: null, trailers: {}, payloadChunks: [] }
    this.setHeader('foo', 'bar'); this.removeHeader('foo')
    this.assignSocket(getNullSocket())
    let called = false
    const onEndSuccess = (payload) => {
      // no need to early-return if already called because this handler is bound `once`
      called = true
      process.nextTick(() => onEnd(null, payload))
    }

    const onEndFailure = (err) => {
      if (called) return
      called = true
      process.nextTick(() => onEnd(err, null))
    }

    this.once('finish', () => {
      const res = this.generatePayload(req)
      onEndSuccess(res)
    })

    this.socket.once('error', onEndFailure)

    this.once('error', onEndFailure)

    this.once('close', onEndFailure)
  }

  setTimeout (msecs, callback) {
    this.timeoutHandle = setTimeout(() => {
      this.emit('timeout')
    }, msecs)
    this.on('timeout', callback)
    return this
  }

  writeHead (...opt) {
    const result = super.writeHead(...opt)

    this.copyHeaders()

    return result
  }

  write (data, encoding, callback) {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle)
    }
    super.write(data, encoding, callback)
    this._lightMyRequest.payloadChunks.push(Buffer.from(data, encoding))
    return true
  }

  end (data, encoding, callback) {
    if (data) {
      this.write(data, encoding)
    }

    super.end(callback)

    this.emit('finish')

    // We need to emit 'close' otherwise stream.finished() would
    // not pick it up on Node v16

    this.destroy()
  }

  destroy (error) {
    if (this.destroyed) return
    this.destroyed = true

    if (error) {
      process.nextTick(() => this.emit('error', error))
    }

    process.nextTick(() => this.emit('close'))
  }

  addTrailers (trailers) {
    for (const key in trailers) {
      this._lightMyRequest.trailers[key.toLowerCase().trim()] = trailers[key].toString().trim()
    }
  }

  /**
   * @private
   * @param {Request} req
   * @returns
   */
  generatePayload (req) {
    // This seems only to happen when using `fastify-express` - see https://github.com/fastify/fastify-express/issues/47
    /* istanbul ignore if */
    if (this._lightMyRequest.headers === null) {
      this.copyHeaders()
    }
    this.serializeHeaders()
    // Prepare response object
    const res = {
      raw: {
        res: this,
        req
      },
      headers: this._lightMyRequest.headers,
      statusCode: this.statusCode,
      statusMessage: this.statusMessage,
      trailers: {},
      get cookies () {
        return setCookie.parse(this)
      }
    }

    // Prepare payload and trailers
    const rawBuffer = Buffer.concat(this._lightMyRequest.payloadChunks)
    res.rawPayload = rawBuffer

    // we keep both of them for compatibility reasons
    res.payload = rawBuffer.toString()
    res.body = res.payload
    res.trailers = this._lightMyRequest.trailers

    // Prepare payload parsers
    res.json = function parseJsonPayload () {
      return JSON.parse(res.payload)
    }

    return res
  }

  /**
   * @private
   */
  serializeHeaders () {
    const headers = this._lightMyRequest.headers

    for (const headerName of Object.keys(headers)) {
      const headerValue = headers[headerName]
      if (Array.isArray(headerValue)) {
        headers[headerName] = headerValue.map(value => '' + value)
      } else {
        headers[headerName] = '' + headerValue
      }
    }
  }

  /**
   * @private
   */
  copyHeaders () {
    this._lightMyRequest.headers = Object.assign({}, this.getHeaders())

    // Add raw headers
    ;['Date', 'Connection', 'Transfer-Encoding'].forEach((name) => {
      // TODO change this to use the header getter
      const regex = new RegExp('\\r\\n' + name + ': ([^\\r]*)\\r\\n')
      const [, value] = this._header.match(regex) || []
      // const value = this.getHeader(name)
      if (value) {
        this._lightMyRequest.headers[name.toLowerCase()] = value
      }
    })
  }
}

module.exports = Response
