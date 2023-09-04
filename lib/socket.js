const { Socket } = require('net')

const crlfBuf = Buffer.from('\r\n')

class State {
  constructor () {
    this.state = 'firstHead'
    this.headers = {}
    this.trailers = {}
    this.body = []
    this.waitSizeBody = 0
    this.rawBody = []
  }

  /**
   * @param {Uint8Array | string} chunk
   * @param {BufferEncoding} [encoding]
   */
  write (chunk, encoding) {
    if (typeof chunk === 'string') {
      chunk = Buffer.from(chunk, encoding)
    }
    this.rawBody.push(chunk)
    this.process(Buffer.concat(this.rawBody))
  }

  /**
   * @private
   * @param {Buffer} buffer
   * @returns
   */
  process (buffer) {
    if (!buffer.length) {
      this.rawBody = []
      return
    };
    if (this.state === 'body') {
      if (buffer.length < this.waitSizeBody) {
        this.body.push(buffer)
        this.waitSizeBody -= buffer.length
        this.rawBody = []
        return
      }
      this.body.push(buffer.subarray(0, this.waitSizeBody))
      const size = this.waitSizeBody
      this.waitSizeBody = 0
      this.state = 'afterBody'
      this.process(buffer.subarray(size))
      return
    }
    this.rawBody = [buffer]
    const i = buffer.indexOf(crlfBuf)
    if (i === -1) {
      return
    };
    if (this.state === 'firstHead') {
      this.state = 'head'
      this.process(buffer.subarray(i + 2))
      return
    }
    if (this.state === 'head') {
      const line = buffer.subarray(0, i).toString()
      if (line) {
        const [, key, value] = line.match(/^([^:]+): (.*)$/)
        if (this.headers[key.toLowerCase()]) {
          if (!Array.isArray(this.headers[key.toLowerCase()])) {
            this.headers[key.toLowerCase()] = [this.headers[key.toLowerCase()]]
          }
          this.headers[key.toLowerCase()].push(value)
        } else {
          this.headers[key.toLowerCase()] = value
        }
      } else if (this.headers['content-length']) {
        this.waitSizeBody = parseInt(this.headers['content-length'])
        if (this.waitSizeBody) {
          this.state = 'body'
        } else {
          this.state = 'trailers'
        }
      } else {
        this.state = 'bodySize'
      }
      this.process(buffer.subarray(i + 2))
      return
    }
    if (this.state === 'bodySize') {
      const chunk = buffer.subarray(0, i).toString()
      this.waitSizeBody = parseInt(chunk.toString(), 16)
      if (this.waitSizeBody !== 0) {
        this.state = 'body'
      } else {
        this.state = 'trailers'
      }
      this.process(buffer.subarray(i + 2))
      return
    }
    if (this.state === 'afterBody') {
      this.state = 'bodySize'
      this.process(buffer.subarray(i + 2))
    }
    if (this.state === 'trailers') {
      const line = buffer.subarray(0, i).toString()
      if (line) {
        const [, key, value] = line.match(/^([^:]+): (.*)$/)
        this.trailers[key.toLowerCase()] = value
      } else {
        this.state = 'end'
      }
      this.process(buffer.subarray(i + 2))
    }
  }
}

class MySocket extends Socket {
  _myData = new State()

  /**
   * @param {Uint8Array | string} chunk
   * @param {BufferEncoding | (err?: Error) => void} [encoding]
   * @param {(err?: Error) => void} [callback]
   */
  write (chunk, encoding, callback) {
    this._myData.write(chunk, encoding)
    callback && setImmediate(callback)
    return true
  }

  getState () {
    return {
      headers: this._myData.headers,
      body: Buffer.concat(this._myData.body),
      trailers: this._myData.trailers,
      isEnd: ['end', 'trailers', 'afterBody', 'bodySize'].includes(this._myData.state)
    }
  }
}

module.exports = MySocket
