'use strict'

const t = require('tap')
const test = t.test
const { Readable } = require('readable-stream')
const fs = require('fs')
const zlib = require('zlib')
const inject = require('../index')
const http = require('http')

const FormData = require('form-data')

test('returns non-chunked payload', (t) => {
  t.plan(7)
  const output = 'example.com:8080|/hello'

  const dispatch = function (req, res) {
    res.statusMessage = 'Super'
    res.setHeader('x-extra', 'hello')
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': output.length })
    res.end(req.headers.host + '|' + req.url)
  }

  inject(dispatch, 'http://example.com:8080/hello', (err, res) => {
    t.error(err)
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
  t.plan(6)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.host + '|' + req.url)
  }

  inject(dispatch, { url: 'http://example.com:8080/hello' }, (err, res) => {
    t.error(err)
    t.ok(res.headers.date)
    t.ok(res.headers.connection)
    t.equal(res.headers['transfer-encoding'], 'chunked')
    t.equal(res.payload, 'example.com:8080|/hello')
    t.equal(res.rawPayload.toString(), 'example.com:8080|/hello')
  })
})

test('passes headers', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.super)
  }

  inject(dispatch, { method: 'GET', url: 'http://example.com:8080/hello', headers: { Super: 'duper' } }, (err, res) => {
    t.error(err)
    t.equal(res.payload, 'duper')
  })
})

test('passes remote address', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.connection.remoteAddress)
  }

  inject(dispatch, { method: 'GET', url: 'http://example.com:8080/hello', remoteAddress: '1.2.3.4' }, (err, res) => {
    t.error(err)
    t.equal(res.payload, '1.2.3.4')
  })
})

test('passes localhost as default remote address', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.connection.remoteAddress)
  }

  inject(dispatch, { method: 'GET', url: 'http://example.com:8080/hello' }, (err, res) => {
    t.error(err)
    t.equal(res.payload, '127.0.0.1')
  })
})

test('passes host option as host header', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.host)
  }

  inject(dispatch, { method: 'GET', url: '/hello', headers: { host: 'test.example.com' } }, (err, res) => {
    t.error(err)
    t.equal(res.payload, 'test.example.com')
  })
})

test('passes localhost as default host header', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.host)
  }

  inject(dispatch, { method: 'GET', url: '/hello' }, (err, res) => {
    t.error(err)
    t.equal(res.payload, 'localhost:80')
  })
})

test('passes authority as host header', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.host)
  }

  inject(dispatch, { method: 'GET', url: '/hello', authority: 'something' }, (err, res) => {
    t.error(err)
    t.equal(res.payload, 'something')
  })
})

test('passes uri host as host header', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.host)
  }

  inject(dispatch, { method: 'GET', url: 'http://example.com:8080/hello' }, (err, res) => {
    t.error(err)
    t.equal(res.payload, 'example.com:8080')
  })
})

test('includes default http port in host header', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.host)
  }

  inject(dispatch, 'http://example.com', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'example.com:80')
  })
})

test('includes default https port in host header', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.host)
  }

  inject(dispatch, 'https://example.com', (err, res) => {
    t.error(err)
    t.equal(res.payload, 'example.com:443')
  })
})

test('optionally accepts an object as url', (t) => {
  t.plan(5)
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

  inject(dispatch, { url }, (err, res) => {
    t.error(err)
    t.ok(res.headers.date)
    t.ok(res.headers.connection)
    t.notOk(res.headers['transfer-encoding'])
    t.equal(res.payload, output)
  })
})

test('leaves user-agent unmodified', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers['user-agent'])
  }

  inject(dispatch, { method: 'GET', url: 'http://example.com:8080/hello', headers: { 'user-agent': 'duper' } }, (err, res) => {
    t.error(err)
    t.equal(res.payload, 'duper')
  })
})

test('returns chunked payload', (t) => {
  t.plan(5)
  const dispatch = function (req, res) {
    res.writeHead(200, 'OK')
    res.write('a')
    res.write('b')
    res.end()
  }

  inject(dispatch, { method: 'GET', url: '/' }, (err, res) => {
    t.error(err)
    t.ok(res.headers.date)
    t.ok(res.headers.connection)
    t.equal(res.headers['transfer-encoding'], 'chunked')
    t.equal(res.payload, 'ab')
  })
})

test('sets trailers in response object', (t) => {
  t.plan(4)
  const dispatch = function (req, res) {
    res.setHeader('Trailer', 'Test')
    res.addTrailers({ 'Test': 123 })
    res.end()
  }

  inject(dispatch, { method: 'GET', url: '/' }, (err, res) => {
    t.error(err)
    t.equal(res.headers.trailer, 'Test')
    t.equal(res.headers.test, undefined)
    t.equal(res.trailers.test, '123')
  })
})

test('parses zipped payload', (t) => {
  t.plan(4)
  const dispatch = function (req, res) {
    res.writeHead(200, 'OK')
    const stream = fs.createReadStream('./package.json')
    stream.pipe(zlib.createGzip()).pipe(res)
  }

  inject(dispatch, { method: 'GET', url: '/' }, (err, res) => {
    t.error(err)
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
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200)
    res.write('a')
    res.write(Buffer.from('b'))
    res.end()
  }

  inject(dispatch, { method: 'GET', url: '/' }, (err, res) => {
    t.error(err)
    t.equal(res.payload, 'ab')
  })
})

test('returns null payload', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Length': 0 })
    res.end()
  }

  inject(dispatch, { method: 'GET', url: '/' }, (err, res) => {
    t.error(err)
    t.equal(res.payload, '')
  })
})

test('allows ending twice', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Length': 0 })
    res.end()
    res.end()
  }

  inject(dispatch, { method: 'GET', url: '/' }, (err, res) => {
    t.error(err)
    t.equal(res.payload, '')
  })
})

test('identifies injection object', (t) => {
  t.plan(3)
  const dispatch = function (req, res) {
    t.equal(inject.isInjection(req), true)
    t.equal(inject.isInjection(res), true)

    res.writeHead(200, { 'Content-Length': 0 })
    res.end()
  }

  inject(dispatch, { method: 'GET', url: '/' }, (err, res) => {
    t.error(err)
  })
})

test('pipes response', (t) => {
  t.plan(3)
  let finished = false
  const dispatch = function (req, res) {
    res.writeHead(200)
    const stream = getTestStream()

    res.on('finish', () => {
      finished = true
    })

    stream.pipe(res)
  }

  inject(dispatch, { method: 'GET', url: '/' }, (err, res) => {
    t.error(err)
    t.equal(finished, true)
    t.equal(res.payload, 'hi')
  })
})

test('pipes response with old stream', (t) => {
  t.plan(3)
  let finished = false
  const dispatch = function (req, res) {
    res.writeHead(200)
    const stream = getTestStream()
    stream.pause()
    const stream2 = new Readable().wrap(stream)
    stream.resume()

    res.on('finish', () => {
      finished = true
    })

    stream2.pipe(res)
  }

  inject(dispatch, { method: 'GET', url: '/' }, (err, res) => {
    t.error(err)
    t.equal(finished, true)
    t.equal(res.payload, 'hi')
  })
})

test('echos object payload', (t) => {
  t.plan(3)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'content-type': req.headers['content-type'] })
    req.pipe(res)
  }

  inject(dispatch, { method: 'POST', url: '/test', payload: { a: 1 } }, (err, res) => {
    t.error(err)
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(res.payload, '{"a":1}')
  })
})

test('supports body option in Request and property in Response', (t) => {
  t.plan(3)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'content-type': req.headers['content-type'] })
    req.pipe(res)
  }

  inject(dispatch, { method: 'POST', url: '/test', body: { a: 1 } }, (err, res) => {
    t.error(err)
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(res.body, '{"a":1}')
  })
})

test('echos buffer payload', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200)
    req.pipe(res)
  }

  inject(dispatch, { method: 'POST', url: '/test', payload: Buffer.from('test!') }, (err, res) => {
    t.error(err)
    t.equal(res.payload, 'test!')
  })
})

test('echos object payload with non-english utf-8 string', (t) => {
  t.plan(3)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'content-type': req.headers['content-type'] })
    req.pipe(res)
  }

  inject(dispatch, { method: 'POST', url: '/test', payload: { a: '½½א' } }, (err, res) => {
    t.error(err)
    t.equal(res.headers['content-type'], 'application/json')
    t.equal(res.payload, '{"a":"½½א"}')
  })
})

test('echos object payload without payload', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200)
    req.pipe(res)
  }

  inject(dispatch, { method: 'POST', url: '/test' }, (err, res) => {
    t.error(err)
    t.equal(res.payload, '')
  })
})

test('retains content-type header', (t) => {
  t.plan(3)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'content-type': req.headers['content-type'] })
    req.pipe(res)
  }

  inject(dispatch, { method: 'POST', url: '/test', payload: { a: 1 }, headers: { 'content-type': 'something' } }, (err, res) => {
    t.error(err)
    t.equal(res.headers['content-type'], 'something')
    t.equal(res.payload, '{"a":1}')
  })
})

test('adds a content-length header if none set when payload specified', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers['content-length'])
  }

  inject(dispatch, { method: 'POST', url: '/test', payload: { a: 1 } }, (err, res) => {
    t.error(err)
    t.equal(res.payload, '{"a":1}'.length.toString())
  })
})

test('retains a content-length header when payload specified', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers['content-length'])
  }

  inject(dispatch, { method: 'POST', url: '/test', payload: '', headers: { 'content-length': '10' } }, (err, res) => {
    t.error(err)
    t.equal(res.payload, '10')
  })
})

test('can handle a stream payload', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    readStream(req, (buff) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end(buff)
    })
  }

  inject(dispatch, { method: 'POST', url: '/', payload: getTestStream() }, (err, res) => {
    t.error(err)
    t.equal(res.payload, 'hi')
  })
})

test('can handle a stream payload of utf-8 strings', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    readStream(req, (buff) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end(buff)
    })
  }

  inject(dispatch, { method: 'POST', url: '/', payload: getTestStream('utf8') }, (err, res) => {
    t.error(err)
    t.equal(res.payload, 'hi')
  })
})

test('can override stream payload content-length header', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers['content-length'])
  }

  const headers = { 'content-length': '100' }

  inject(dispatch, { method: 'POST', url: '/', payload: getTestStream(), headers }, (err, res) => {
    t.error(err)
    t.equal(res.payload, '100')
  })
})

test('can override stream payload content-length header without request content-length', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    t.equal(req.headers['content-length'], '2')
  }

  inject(dispatch, { method: 'POST', url: '/', payload: getTestStream() }, () => {})
})

test('writeHead returns single buffer payload', (t) => {
  t.plan(4)
  const reply = 'Hello World'
  const statusCode = 200
  const statusMessage = 'OK'
  const dispatch = function (req, res) {
    res.writeHead(statusCode, statusMessage, { 'Content-Type': 'text/plain', 'Content-Length': reply.length })
    res.end(reply)
  }

  inject(dispatch, { method: 'GET', url: '/' }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, statusCode)
    t.equal(res.statusMessage, statusMessage)
    t.equal(res.payload, reply)
  })
})

test('_read() plays payload', (t) => {
  t.plan(2)
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
  inject(dispatch, { method: 'GET', url: '/', payload: body }, (err, res) => {
    t.error(err)
    t.equal(res.payload, body)
  })
})

test('simulates split', (t) => {
  t.plan(2)
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
  inject(dispatch, { method: 'GET', url: '/', payload: body, simulate: { split: true } }, (err, res) => {
    t.error(err)
    t.equal(res.payload, body)
  })
})

test('simulates error', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    req.on('readable', () => {
    })

    req.on('error', () => {
      res.writeHead(200, { 'Content-Length': 0 })
      res.end('error')
    })
  }

  const body = 'something special just for you'
  inject(dispatch, { method: 'GET', url: '/', payload: body, simulate: { error: true } }, (err, res) => {
    t.error(err)
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
  inject(dispatch, { method: 'GET', url: '/', simulate: { end: false } }, (notHandledErr, res) => {
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
  inject(dispatch, { method: 'GET', url: '/', payload: '1234567', simulate: { end: false } }, (notHandledErr, res) => {
    replied = true
  })

  setTimeout(() => {
    t.equal(end, false)
    t.equal(replied, false)
  }, 10)
})

test('simulates close', (t) => {
  t.plan(2)
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
  inject(dispatch, { method: 'GET', url: '/', payload: body, simulate: { close: true } }, (err, res) => {
    t.error(err)
    t.equal(res.payload, 'close')
  })
})

test('errors for invalid input options', (t) => {
  t.plan(1)
  try {
    inject({}, {}, () => {})
    t.fail('This should throw')
  } catch (err) {
    t.is(err.message, 'dispatchFunc should be a function')
  }
})

test('errors for missing url', (t) => {
  t.plan(1)
  try {
    inject((req, res) => {}, {}, () => {})
  } catch (err) {
    t.ok(err)
  }
})

test('errors for an incorrect simulation object', (t) => {
  t.plan(1)
  try {
    inject((req, res) => {}, { url: '/', simulate: 'sample string' }, () => {})
  } catch (err) {
    t.ok(err)
  }
})

test('ignores incorrect simulation object', (t) => {
  t.plan(1)
  try {
    inject((req, res) => { }, { url: '/', simulate: 'sample string', validate: false }, () => { })
    t.pass()
  } catch (err) {
    t.fail('we shoult not be here')
  }
})

test('errors for an incorrect simulation object values', (t) => {
  t.plan(1)
  try {
    inject((req, res) => {}, { url: '/', simulate: { end: 'wrong input' } }, () => {})
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

  inject(dispatch, { method: 'GET', url: 'http://example.com:8080/hello' })
    .then(res => t.equal(res.payload, 'hello'))
    .catch(err => t.fail(err))
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

  inject(dispatch, { method: 'GET', url: 'http://example.com:8080/hello', server: server })
    .then(res => t.equal(res.statusCode, 200))
    .catch(err => t.fail(err))
})

test('should handle response errors', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.connection.destroy(new Error('kaboom'))
  }

  inject(dispatch, 'http://example.com:8080/hello', (err, res) => {
    t.ok(err)
  })
})

test('should handle response errors (promises)', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.connection.destroy(new Error('kaboom'))
  }

  inject(dispatch, { method: 'GET', url: 'http://example.com:8080/hello' })
    .then(res => t.fail('should throw'))
    .catch(err => t.ok(err))
})

test('should throw on unknown HTTP method', (t) => {
  t.plan(1)
  const dispatch = function (req, res) { }

  t.throws(() => inject(dispatch, { method: 'UNKNOWN_METHOD', url: 'http://example.com:8080/hello' }), Error)
})

test('HTTP method is case insensitive', (t) => {
  t.plan(3)

  const dispatch = function (req, res) {
    res.end('Hi!')
  }

  inject(dispatch, { method: 'get', url: 'http://example.com:8080/hello' }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.payload, 'Hi!')
  })
})

test('form-data should be handled correctly', (t) => {
  t.plan(3)

  const dispatch = function (req, res) {
    let body = ''
    req.on('data', d => {
      body += d
    })
    req.on('end', () => {
      res.end(body)
    })
  }

  const form = new FormData()
  form.append('my_field', 'my value')

  inject(dispatch, {
    method: 'POST',
    url: 'http://example.com:8080/hello',
    payload: form
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.ok(/--.+\r\nContent-Disposition: form-data; name="my_field"\r\n\r\nmy value\r\n--.+--\r\n/.test(res.payload))
  })
})

function getTestStream (encoding) {
  const word = 'hi'
  let i = 0

  const stream = new Readable({
    read (n) {
      this.push(word[i] ? word[i++] : null)
    }
  })

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
