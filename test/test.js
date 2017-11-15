'use strict'

const t = require('tap')
const test = t.test
const util = require('util')
const Stream = require('stream')
const fs = require('fs')
const zlib = require('zlib')
const inject = require('../index')
const http = require('http')

test('returns non-chunked payload', (t) => {
  t.plan(6)
  const output = 'example.com:8080|/hello'

  const dispatch = function (req, res) {
    res.statusMessage = 'Super'
    res.setHeader('x-extra', 'hello')
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': output.length })
    res.end(req.headers.host + '|' + req.url)
  }

  inject(dispatch, 'http://example.com:8080/hello', (res) => {
    t.equal(res.statusCode, 200)
    t.equal(res.statusMessage, 'Super')
    t.ok(res.headers.date)
    t.deepEqual(res.headers, {
      date: res.headers.date,
      connection: 'keep-alive',
      'x-extra': 'hello',
      'content-type': 'text/plain',
      'content-length': output.length
    })
    t.equal(res.payload, output)
    t.equal(res.rawPayload.toString(), 'example.com:8080|/hello')
  })
})

test('returns single buffer payload', (t) => {
  t.plan(5)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.host + '|' + req.url)
  }

  inject(dispatch, { url: 'http://example.com:8080/hello' }, (res) => {
    t.ok(res.headers.date)
    t.ok(res.headers.connection)
    t.equal(res.headers['transfer-encoding'], 'chunked')
    t.equal(res.payload, 'example.com:8080|/hello')
    t.equal(res.rawPayload.toString(), 'example.com:8080|/hello')
  })
})

test('passes headers', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.super)
  }

  inject(dispatch, { method: 'get', url: 'http://example.com:8080/hello', headers: { Super: 'duper' } }, (res) => {
    t.equal(res.payload, 'duper')
  })
})

test('passes remote address', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.connection.remoteAddress)
  }

  inject(dispatch, { method: 'get', url: 'http://example.com:8080/hello', remoteAddress: '1.2.3.4' }, (res) => {
    t.equal(res.payload, '1.2.3.4')
  })
})

test('passes localhost as default remote address', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.connection.remoteAddress)
  }

  inject(dispatch, { method: 'get', url: 'http://example.com:8080/hello' }, (res) => {
    t.equal(res.payload, '127.0.0.1')
  })
})

test('passes host option as host header', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.host)
  }

  inject(dispatch, { method: 'get', url: '/hello', headers: { host: 'test.example.com' } }, (res) => {
    t.equal(res.payload, 'test.example.com')
  })
})

test('passes localhost as default host header', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.host)
  }

  inject(dispatch, { method: 'get', url: '/hello' }, (res) => {
    t.equal(res.payload, 'localhost:80')
  })
})

test('passes authority as host header', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.host)
  }

  inject(dispatch, { method: 'get', url: '/hello', authority: 'something' }, (res) => {
    t.equal(res.payload, 'something')
  })
})

test('passes uri host as host header', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.host)
  }

  inject(dispatch, { method: 'get', url: 'http://example.com:8080/hello' }, (res) => {
    t.equal(res.payload, 'example.com:8080')
  })
})

test('includes default http port in host header', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.host)
  }

  inject(dispatch, 'http://example.com', (res) => {
    t.equal(res.payload, 'example.com:80')
  })
})

test('includes default https port in host header', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.host)
  }

  inject(dispatch, 'https://example.com', (res) => {
    t.equal(res.payload, 'example.com:443')
  })
})

test('optionally accepts an object as url', (t) => {
  t.plan(4)
  const output = 'example.com:8080|/hello?test=1234'

  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': output.length })
    res.end(req.headers.host + '|' + req.url)
  }

  const url = {
    protocol: 'http',
    hostname: 'example.com',
    port: '8080',
    pathname: 'hello',
    query: {
      test: '1234'
    }
  }

  inject(dispatch, { url }, (res) => {
    t.ok(res.headers.date)
    t.ok(res.headers.connection)
    t.notOk(res.headers['transfer-encoding'])
    t.equal(res.payload, output)
  })
})

test('leaves user-agent unmodified', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers['user-agent'])
  }

  inject(dispatch, { method: 'get', url: 'http://example.com:8080/hello', headers: { 'user-agent': 'duper' } }, (res) => {
    t.equal(res.payload, 'duper')
  })
})

test('returns chunked payload', (t) => {
  t.plan(4)
  const dispatch = function (req, res) {
    res.writeHead(200, 'OK')
    res.write('a')
    res.write('b')
    res.end()
  }

  inject(dispatch, { method: 'get', url: '/' }, (res) => {
    t.ok(res.headers.date)
    t.ok(res.headers.connection)
    t.equal(res.headers['transfer-encoding'], 'chunked')
    t.equal(res.payload, 'ab')
  })
})

test('sets trailers in response object', (t) => {
  t.plan(3)
  const dispatch = function (req, res) {
    res.setHeader('Trailer', 'Test')
    res.addTrailers({ 'Test': 123 })
    res.end()
  }

  inject(dispatch, { method: 'get', url: '/' }, (res) => {
    t.equal(res.headers.trailer, 'Test')
    t.equal(res.headers.test, undefined)
    t.equal(res.trailers.test, '123')
  })
})

test('parses zipped payload', (t) => {
  t.plan(3)
  const dispatch = function (req, res) {
    res.writeHead(200, 'OK')
    const stream = fs.createReadStream('./package.json')
    stream.pipe(zlib.createGzip()).pipe(res)
  }

  inject(dispatch, { method: 'get', url: '/' }, (res) => {
    fs.readFile('./package.json', { encoding: 'utf-8' }, (err, file) => {
      t.error(err)

      zlib.unzip(res.rawPayload, (err, unzipped) => {
        t.error(err)
        t.equal(unzipped.toString('utf-8'), file)
      })
    })
  })
})

test('returns multi buffer payload', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200)
    res.write('a')
    res.write(Buffer.from('b'))
    res.end()
  }

  inject(dispatch, { method: 'get', url: '/' }, (res) => {
    t.equal(res.payload, 'ab')
  })
})

test('returns null payload', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Length': 0 })
    res.end()
  }

  inject(dispatch, { method: 'get', url: '/' }, (res) => {
    t.equal(res.payload, '')
  })
})

test('allows ending twice', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Length': 0 })
    res.end()
    res.end()
  }

  inject(dispatch, { method: 'get', url: '/' }, (res) => {
    t.equal(res.payload, '')
  })
})

test('identifies injection object', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    t.equal(inject.isInjection(req), true)
    t.equal(inject.isInjection(res), true)

    res.writeHead(200, { 'Content-Length': 0 })
    res.end()
  }

  inject(dispatch, { method: 'get', url: '/' }, (res) => {})
})

test('pipes response', (t) => {
  t.plan(2)
  let finished = false
  const dispatch = function (req, res) {
    res.writeHead(200)
    const stream = getTestStream()

    res.on('finish', () => {
      finished = true
    })

    stream.pipe(res)
  }

  inject(dispatch, { method: 'get', url: '/' }, (res) => {
    t.equal(finished, true)
    t.equal(res.payload, 'hi')
  })
})

test('pipes response with old stream', (t) => {
  t.plan(2)
  let finished = false
  const dispatch = function (req, res) {
    res.writeHead(200)
    const stream = getTestStream()
    stream.pause()
    const stream2 = new Stream.Readable().wrap(stream)
    stream.resume()

    res.on('finish', () => {
      finished = true
    })

    stream2.pipe(res)
  }

  inject(dispatch, { method: 'get', url: '/' }, (res) => {
    t.equal(finished, true)
    t.equal(res.payload, 'hi')
  })
})

test('echos object payload', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'content-type': req.headers['content-type'] })
    req.pipe(res)
  }

  inject(dispatch, { method: 'post', url: '/test', payload: { a: 1 } }, (res) => {
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(res.payload, '{"a":1}')
  })
})

test('echos buffer payload', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200)
    req.pipe(res)
  }

  inject(dispatch, { method: 'post', url: '/test', payload: Buffer.from('test!') }, (res) => {
    t.equal(res.payload, 'test!')
  })
})

test('echos object payload with non-english utf-8 string', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'content-type': req.headers['content-type'] })
    req.pipe(res)
  }

  inject(dispatch, { method: 'post', url: '/test', payload: { a: '½½א' } }, (res) => {
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(res.payload, '{"a":"½½א"}')
  })
})

test('echos object payload without payload', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200)
    req.pipe(res)
  }

  inject(dispatch, { method: 'post', url: '/test' }, (res) => {
    t.equal(res.payload, '')
  })
})

test('retains content-type header', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'content-type': req.headers['content-type'] })
    req.pipe(res)
  }

  inject(dispatch, { method: 'post', url: '/test', payload: { a: 1 }, headers: { 'content-type': 'something' } }, (res) => {
    t.equal(res.headers['content-type'], 'something')
    t.equal(res.payload, '{"a":1}')
  })
})

test('adds a content-length header if none set when payload specified', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers['content-length'])
  }

  inject(dispatch, { method: 'post', url: '/test', payload: { a: 1 } }, (res) => {
    t.equal(res.payload, '{"a":1}'.length.toString())
  })
})

test('retains a content-length header when payload specified', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers['content-length'])
  }

  inject(dispatch, { method: 'post', url: '/test', payload: '', headers: { 'content-length': '10' } }, (res) => {
    t.equal(res.payload, '10')
  })
})

test('can handle a stream payload', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    readStream(req, (buff) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end(buff)
    })
  }

  inject(dispatch, { method: 'post', url: '/', payload: getTestStream() }, (res) => {
    t.equal(res.payload, 'hi')
  })
})

test('can handle a stream payload of utf-8 strings', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    readStream(req, (buff) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end(buff)
    })
  }

  inject(dispatch, { method: 'post', url: '/', payload: getTestStream('utf8') }, (res) => {
    t.equal(res.payload, 'hi')
  })
})

test('can override stream payload content-length header', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers['content-length'])
  }

  const headers = { 'content-length': '100' }

  inject(dispatch, { method: 'post', url: '/', payload: getTestStream(), headers }, (res) => {
    t.equal(res.payload, '100')
  })
})

test('can override stream payload content-length header without request content-length', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    t.equal(req.headers['content-length'], '2')
  }

  inject(dispatch, { method: 'post', url: '/', payload: getTestStream() }, () => {})
})

test('writeHead returns single buffer payload', (t) => {
  t.plan(3)
  const reply = 'Hello World'
  const statusCode = 200
  const statusMessage = 'OK'
  const dispatch = function (req, res) {
    res.writeHead(statusCode, statusMessage, { 'Content-Type': 'text/plain', 'Content-Length': reply.length })
    res.end(reply)
  }

  inject(dispatch, { method: 'get', url: '/' }, (res) => {
    t.equal(res.statusCode, statusCode)
    t.equal(res.statusMessage, statusMessage)
    t.equal(res.payload, reply)
  })
})

test('_read() plays payload', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    let buffer = ''
    req.on('readable', () => {
      buffer = buffer + (req.read() || '')
    })

    req.on('close', () => {
    })

    req.on('end', () => {
      res.writeHead(200, { 'Content-Length': 0 })
      res.end(buffer)
      req.destroy()
    })
  }

  const body = 'something special just for you'
  inject(dispatch, { method: 'get', url: '/', payload: body }, (res) => {
    t.equal(res.payload, body)
  })
})

test('simulates split', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    let buffer = ''
    req.on('readable', () => {
      buffer = buffer + (req.read() || '')
    })

    req.on('close', () => {
    })

    req.on('end', () => {
      res.writeHead(200, { 'Content-Length': 0 })
      res.end(buffer)
      req.destroy()
    })
  }

  const body = 'something special just for you'
  inject(dispatch, { method: 'get', url: '/', payload: body, simulate: { split: true } }, (res) => {
    t.equal(res.payload, body)
  })
})

test('simulates error', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    req.on('readable', () => {
    })

    req.on('error', () => {
      res.writeHead(200, { 'Content-Length': 0 })
      res.end('error')
    })
  }

  const body = 'something special just for you'
  inject(dispatch, { method: 'get', url: '/', payload: body, simulate: { error: true } }, (res) => {
    t.equal(res.payload, 'error')
  })
})

test('simulates no end without payload', (t) => {
  t.plan(2)
  let end = false
  const dispatch = function (req, res) {
    req.resume()
    req.on('end', () => {
      end = true
    })
  }

  let replied = false
  inject(dispatch, { method: 'get', url: '/', simulate: { end: false } }, (res) => {
    replied = true
  })

  setTimeout(() => {
    t.equal(end, false)
    t.equal(replied, false)
  }, 10)
})

test('simulates no end with payload', (t) => {
  t.plan(2)
  let end = false
  const dispatch = function (req, res) {
    req.resume()
    req.on('end', () => {
      end = true
    })
  }

  let replied = false
  inject(dispatch, { method: 'get', url: '/', payload: '1234567', simulate: { end: false } }, (res) => {
    replied = true
  })

  setTimeout(() => {
    t.equal(end, false)
    t.equal(replied, false)
  }, 10)
})

test('simulates close', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    let buffer = ''
    req.on('readable', () => {
      buffer = buffer + (req.read() || '')
    })

    req.on('close', () => {
      res.writeHead(200, { 'Content-Length': 0 })
      res.end('close')
    })

    req.on('end', () => {
    })
  }

  const body = 'something special just for you'
  inject(dispatch, { method: 'get', url: '/', payload: body, simulate: { close: true } }, (res) => {
    t.equal(res.payload, 'close')
  })
})

test('errors for invalid input options', (t) => {
  t.plan(1)
  try {
    inject({}, {}, (res) => {})
    t.fail('This should throw')
  } catch (err) {
    t.is(err.message, 'dispatchFunc should be a function')
  }
})

test('errors for missing url', (t) => {
  t.plan(1)
  try {
    inject((req, res) => {}, {}, (res) => {})
  } catch (err) {
    t.ok(err)
  }
})

test('errors for an incorrect simulation object', (t) => {
  t.plan(1)
  try {
    inject((req, res) => {}, { url: '/', simulate: 'sample string' }, (res) => {})
  } catch (err) {
    t.ok(err)
  }
})

test('ignores incorrect simulation object', (t) => {
  t.plan(1)
  try {
    inject((req, res) => { }, { url: '/', simulate: 'sample string', validate: false }, (res) => { })
    t.pass()
  } catch (err) {
    t.fail('we shoult not be here')
  }
})

test('errors for an incorrect simulation object values', (t) => {
  t.plan(1)
  try {
    inject((req, res) => {}, { url: '/', simulate: { end: 'wrong input' } }, (res) => {})
  } catch (err) {
    t.ok(err)
  }
})

test('promises support', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('hello')
  }

  inject(dispatch, { method: 'get', url: 'http://example.com:8080/hello' })
    .then(res => t.equal(res.payload, 'hello'))
})

test('async wait support', t => {
  if (Number(process.versions.node[0]) >= 8) {
    require('./async-await')(t, inject)
  } else {
    t.pass('Skip because Node version < 8')
    t.end()
  }
})

test('this should be the server instance', t => {
  t.plan(2)

  const server = http.createServer()

  const dispatch = function (req, res) {
    t.equal(this, server)
    res.end('hello')
  }

  inject(dispatch, { method: 'get', url: 'http://example.com:8080/hello', server: server })
    .then(res => t.equal(res.statusCode, 200))
})

function getTestStream (encoding) {
  const Read = function () {
    Stream.Readable.call(this)
  }

  util.inherits(Read, Stream.Readable)

  const word = 'hi'
  let i = 0

  Read.prototype._read = function (size) {
    this.push(word[i] ? word[i++] : null)
  }

  const stream = new Read()

  if (encoding) {
    stream.setEncoding(encoding)
  }

  return stream
}

function readStream (stream, callback) {
  const chunks = []

  stream.on('data', (chunk) => chunks.push(chunk))

  stream.on('end', () => {
    return callback(Buffer.concat(chunks))
  })
}
