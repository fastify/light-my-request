'use strict'

const http = require('http')

const setCookie = require('set-cookie-parser')
const MySocket = require('./socket')

function once (cb) {
  let called = false
  return function () {
    if (called) return
    called = true
    cb.apply(this, arguments)
  }
}

module.exports.once = once

// Throws away all written data to prevent response from buffering payload

class Response extends http.ServerResponse {
  static errors = {
    SocketHangUpError: class SocketHangUpError extends Error {
      constructor () {
        super('socket hang up')
        this.code = 'ECONNRESET'
      }
    }
  }

  /**
   * @param {import('./request').Request} req
   * @param {(err: Error, data: any) => void} onEnd
   * @param {http.Server} server
   */
  constructor (req, onEnd) {
    super(req)
    onEnd = once(onEnd)
    this._lightSocket = new MySocket()
    this.setHeader('foo', 'bar'); this.removeHeader('foo')
    this.assignSocket(this._lightSocket)

    const onEndCb = (err) => {
      if (err) {
        return process.nextTick(() => onEnd(err))
      }
      const res = this.generatePayload(req)
      if (res.end) {
        return process.nextTick(() => onEnd(null, res))
      }
      process.nextTick(() => onEnd(new Response.errors.SocketHangUpError()))
    }

    this.once('finish', () => {
      this.destroyed = true
      this._closed = true
      this.emit('close')
    })

    this.once('close', () => {
      onEndCb()
    })

    this.socket.once('error', () => {
      onEndCb(new Response.errors.SocketHangUpError())
    })

    this.socket.once('close', () => {
      process.nextTick(() => onEndCb())
    })

    this.once('error', (err) => {
      onEndCb(err)
    })
  }

  setTimeout (msecs, callback) {
    this.timeoutHandle = setTimeout(() => {
      this.emit('timeout')
    }, msecs)
    this.on('timeout', callback)
    return this
  }

  /**
   * @private
   * @param {Request} req
   * @returns
   */
  generatePayload (req) {
    // This seems only to happen when using `fastify-express` - see https://github.com/fastify/fastify-express/issues/47
    // Prepare response object
    const state = this._lightSocket.getState()
    const body = state.body.toString()
    const res = {
      raw: {
        res: this,
        req
      },
      headers: state.headers,
      statusCode: this.statusCode,
      statusMessage: this.statusMessage,
      trailers: state.trailers,
      rawPayload: state.body,
      end: state.isEnd,
      payload: body,
      body,
      json: function parseJsonPayload () {
        return JSON.parse(res.payload)
      },
      get cookies () {
        return setCookie.parse(this)
      }
    }

    return res
  }
}

module.exports.Response = Response
