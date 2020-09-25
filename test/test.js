'use strict'

const t = require('tap')
const test = t.test
const { Readable } = require('readable-stream')
const qs = require('querystring')
const fs = require('fs')
const zlib = require('zlib')
const http = require('http')

const inject = require('../index')
const parseURL = require('../lib/parseURL')

const FormData = require('form-data')
const formAutoContent = require('form-auto-content')

const httpMethods = [
  'delete',
  'get',
  'head',
  'options',
  'patch',
  'post',
  'put',
  'trace'
]

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
    res.end(req.socket.remoteAddress)
  }

  inject(dispatch, { method: 'GET', url: 'http://example.com:8080/hello', remoteAddress: '1.2.3.4' }, (err, res) => {
    t.error(err)
    t.equal(res.payload, '1.2.3.4')
  })
})

test('includes deprecated connection on request', (t) => {
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

const parseQuery = url => {
  const parsedURL = parseURL(url)
  return qs.parse(parsedURL.search.slice(1))
}

test('passes query', (t) => {
  t.plan(2)

  const query = {
    message: 'OK',
    xs: ['foo', 'bar']
  }

  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.url)
  }

  inject(dispatch, { method: 'GET', url: 'http://example.com:8080/hello', query }, (err, res) => {
    t.error(err)
    t.deepEqual(parseQuery(res.payload), query)
  })
})

test('query will be merged into that in url', (t) => {
  t.plan(2)

  const query = {
    xs: ['foo', 'bar']
  }

  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.url)
  }

  inject(dispatch, { method: 'GET', url: 'http://example.com:8080/hello?message=OK', query }, (err, res) => {
    t.error(err)
    t.deepEqual(parseQuery(res.payload), Object.assign({ message: 'OK' }, query))
  })
})

test('passes localhost as default remote address', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.socket.remoteAddress)
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
    res.addTrailers({ Test: 123 })
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

test('should handle response timeout handler', (t) => {
  t.plan(3)
  const dispatch = function (req, res) {
    const handle = setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('incorrect')
    }, 200)
    res.setTimeout(100, () => {
      clearTimeout(handle)
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('correct')
    })
    res.on('timeout', () => {
      t.ok(true, 'Response timeout event not emitted')
    })
  }
  inject(dispatch, { method: 'GET', url: '/test' }, (err, res) => {
    t.error(err)
    t.equal(res.payload, 'correct')
  })
})

test('should throw on unknown HTTP method', (t) => {
  t.plan(1)
  const dispatch = function (req, res) { }

  t.throws(() => inject(dispatch, { method: 'UNKNOWN_METHOD', url: 'http://example.com:8080/hello' }, (err, res) => {
    t.ok(err)
  }), Error)
})

test('should throw on unknown HTTP method (promises)', (t) => {
  t.plan(1)
  const dispatch = function (req, res) { }

  t.throws(() => inject(dispatch, { method: 'UNKNOWN_METHOD', url: 'http://example.com:8080/hello' })
    .then(res => {}), Error)
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

test('path as alias to url', (t) => {
  t.plan(2)

  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.url)
  }

  inject(dispatch, { method: 'GET', path: 'http://example.com:8080/hello' }, (err, res) => {
    t.error(err)
    t.strictEqual(res.payload, '/hello')
  })
})

test('Should throw if both path and url are missing', (t) => {
  t.plan(1)

  try {
    inject(() => {}, { method: 'GET' }, () => {})
    t.fail('Should throw')
  } catch (err) {
    t.ok(err)
  }
})

test('chainable api: backwards compatibility for promise (then)', (t) => {
  t.plan(1)

  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('hello')
  }

  inject(dispatch)
    .get('/')
    .then(res => t.equal(res.payload, 'hello'))
    .catch(err => t.fail(err))
})

test('chainable api: backwards compatibility for promise (catch)', (t) => {
  t.plan(1)

  function dispatch (req, res) {
    throw Error
  }

  inject(dispatch)
    .get('/')
    .catch(err => t.ok(err))
})

test('chainable api: multiple call of then should return the same promise', (t) => {
  t.plan(2)
  let id = 0

  function dispatch (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Request-Id': id })
    ++id
    t.pass('request id incremented')
    res.end('hello')
  }

  const chain = inject(dispatch).get('/')
  chain.then(res => {
    chain.then(rep => {
      t.equal(res.headers['request-id'], rep.headers['request-id'])
    })
  })
})

test('chainable api: http methods should work correctly', (t) => {
  t.plan(16)

  function dispatch (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.method)
  }

  httpMethods.forEach(method => {
    inject(dispatch)[method]('http://example.com:8080/hello')
      .end((err, res) => {
        t.error(err)
        t.equal(res.body, method.toUpperCase())
      })
  })
})

test('chainable api: http methods should throw if already invoked', (t) => {
  t.plan(8)

  function dispatch (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end()
  }

  httpMethods.forEach(method => {
    const chain = inject(dispatch)[method]('http://example.com:8080/hello')
    chain.end()
    t.throws(() => chain[method]('/'), Error)
  })
})

test('chainable api: body method should work correctly', (t) => {
  t.plan(2)

  function dispatch (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    req.pipe(res)
  }

  inject(dispatch)
    .get('http://example.com:8080/hello')
    .body('test')
    .end((err, res) => {
      t.error(err)
      t.equal(res.body, 'test')
    })
})

test('chainable api: cookie', (t) => {
  t.plan(2)

  function dispatch (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.cookie)
  }

  inject(dispatch)
    .get('http://example.com:8080/hello')
    .body('test')
    .cookies({ hello: 'world', fastify: 'rulez' })
    .end((err, res) => {
      t.error(err)
      t.equal(res.body, 'hello=world; fastify=rulez')
    })
})

test('chainable api: body method should throw if already invoked', (t) => {
  t.plan(1)

  function dispatch (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end()
  }

  const chain = inject(dispatch)
  chain
    .get('http://example.com:8080/hello')
    .end()
  t.throws(() => chain.body('test'), Error)
})

test('chainable api: headers method should work correctly', (t) => {
  t.plan(2)

  function dispatch (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.foo)
  }

  inject(dispatch)
    .get('http://example.com:8080/hello')
    .headers({ foo: 'bar' })
    .end((err, res) => {
      t.error(err)
      t.equal(res.payload, 'bar')
    })
})

test('chainable api: headers method should throw if already invoked', (t) => {
  t.plan(1)

  function dispatch (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end()
  }

  const chain = inject(dispatch)
  chain
    .get('http://example.com:8080/hello')
    .end()
  t.throws(() => chain.headers({ foo: 'bar' }), Error)
})

test('chainable api: payload method should work correctly', (t) => {
  t.plan(2)

  function dispatch (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    req.pipe(res)
  }

  inject(dispatch)
    .get('http://example.com:8080/hello')
    .payload('payload')
    .end((err, res) => {
      t.error(err)
      t.equal(res.payload, 'payload')
    })
})

test('chainable api: payload method should throw if already invoked', (t) => {
  t.plan(1)

  function dispatch (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end()
  }

  const chain = inject(dispatch)
  chain
    .get('http://example.com:8080/hello')
    .end()
  t.throws(() => chain.payload('payload'), Error)
})

test('chainable api: query method should work correctly', (t) => {
  t.plan(2)

  const query = {
    message: 'OK',
    xs: ['foo', 'bar']
  }

  function dispatch (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.url)
  }

  inject(dispatch)
    .get('http://example.com:8080/hello')
    .query(query)
    .end((err, res) => {
      t.error(err)
      t.deepEqual(parseQuery(res.payload), query)
    })
})

test('chainable api: query method should throw if already invoked', (t) => {
  t.plan(1)

  function dispatch (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end()
  }

  const chain = inject(dispatch)
  chain
    .get('http://example.com:8080/hello')
    .end()
  t.throws(() => chain.query({ foo: 'bar' }), Error)
})

test('chainable api: invoking end method after promise method should throw', (t) => {
  t.plan(1)

  function dispatch (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end()
  }

  const chain = inject(dispatch).get('http://example.com:8080/hello')

  chain.then()
  t.throws(() => chain.end(), Error)
})

test('chainable api: invoking promise method after end method with a callback function should throw', (t) => {
  t.plan(2)

  function dispatch (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end()
  }

  const chain = inject(dispatch).get('http://example.com:8080/hello')

  chain.end((err, res) => {
    t.error(err)
  })
  t.throws(() => chain.then(), Error)
})

test('chainable api: invoking promise method after end method without a callback function should work properly', (t) => {
  t.plan(1)

  function dispatch (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('hello')
  }

  inject(dispatch)
    .get('http://example.com:8080/hello')
    .end()
    .then(res => t.equal(res.payload, 'hello'))
})

test('chainable api: invoking end method multiple times should throw', (t) => {
  t.plan(1)

  function dispatch (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end()
  }

  const chain = inject(dispatch).get('http://example.com:8080/hello')

  chain.end()
  t.throws(() => chain.end(), Error)
})

test('chainable api: string url', (t) => {
  t.plan(2)

  function dispatch (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end()
    t.pass()
  }

  const chain = inject(dispatch, 'http://example.com:8080/hello')

  chain.then(() => t.pass())
})

test('Response.json() should parse the JSON payload', (t) => {
  t.plan(2)

  const json = {
    a: 1,
    b: '2'
  }

  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(json))
  }

  inject(dispatch, { method: 'GET', path: 'http://example.com:8080/hello' }, (err, res) => {
    t.error(err)
    t.deepEqual(res.json(), json)
  })
})

test('Response.json() should throw an error if content-type is not application/json', (t) => {
  t.plan(2)

  const json = {
    a: 1,
    b: '2'
  }

  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(JSON.stringify(json))
  }

  inject(dispatch, { method: 'GET', path: 'http://example.com:8080/hello' }, (err, res) => {
    t.error(err)
    t.throws(res.json, Error)
  })
})

test('Response.json() should throw an error if the payload is not of valid JSON format', (t) => {
  t.plan(2)

  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end('notAJSON')
  }

  inject(dispatch, { method: 'GET', path: 'http://example.com:8080/hello' }, (err, res) => {
    t.error(err)
    t.throws(res.json, Error)
  })
})

test('promise api should auto start (fire and forget)', (t) => {
  t.plan(1)

  function dispatch (req, res) {
    t.pass('dispatch called')
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end()
  }

  inject(dispatch, 'http://example.com:8080/hello')
})

test('disabling autostart', (t) => {
  t.plan(3)

  let called = false

  function dispatch (req, res) {
    t.pass('dispatch called')
    called = true
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end()
  }

  const p = inject(dispatch, {
    url: 'http://example.com:8080/hello',
    autoStart: false
  })

  setImmediate(() => {
    t.equal(called, false)
    p.then(() => {
      t.equal(called, true)
    })
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

test('send cookie', (t) => {
  t.plan(3)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.host + '|' + req.headers.cookie)
  }

  inject(dispatch, { url: 'http://example.com:8080/hello', cookies: { foo: 'bar', grass: 'àìùòlé' } }, (err, res) => {
    t.error(err)
    t.equal(res.payload, 'example.com:8080|foo=bar; grass=%C3%A0%C3%AC%C3%B9%C3%B2l%C3%A9')
    t.equal(res.rawPayload.toString(), 'example.com:8080|foo=bar; grass=%C3%A0%C3%AC%C3%B9%C3%B2l%C3%A9')
  })
})

test('send cookie with header already set', (t) => {
  t.plan(3)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.host + '|' + req.headers.cookie)
  }

  inject(dispatch, {
    url: 'http://example.com:8080/hello',
    headers: { cookie: 'custom=one' },
    cookies: { foo: 'bar', grass: 'àìùòlé' }
  }, (err, res) => {
    t.error(err)
    t.equal(res.payload, 'example.com:8080|custom=one; foo=bar; grass=%C3%A0%C3%AC%C3%B9%C3%B2l%C3%A9')
    t.equal(res.rawPayload.toString(), 'example.com:8080|custom=one; foo=bar; grass=%C3%A0%C3%AC%C3%B9%C3%B2l%C3%A9')
  })
})

test('read cookie', (t) => {
  t.plan(3)
  const dispatch = function (req, res) {
    res.setHeader('Set-Cookie', [
      'type=ninja',
      'dev=me; Expires=Fri, 17 Jan 2020 20:26:08 -0000; Max-Age=1234; Domain=.home.com; Path=/wow; Secure; HttpOnly; SameSite=Strict'
    ])
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.host + '|' + req.headers.cookie)
  }

  inject(dispatch, { url: 'http://example.com:8080/hello', cookies: { foo: 'bar' } }, (err, res) => {
    t.error(err)
    t.equal(res.payload, 'example.com:8080|foo=bar')
    t.deepEqual(res.cookies, [
      { name: 'type', value: 'ninja' },
      {
        name: 'dev',
        value: 'me',
        expires: new Date('Fri, 17 Jan 2020 20:26:08 -0000'),
        maxAge: 1234,
        domain: '.home.com',
        path: '/wow',
        secure: true,
        httpOnly: true,
        sameSite: 'Strict'
      }
    ])
  })
})

test('correctly handles no string headers', (t) => {
  t.plan(2)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(req.headers))
  }

  const date = new Date(0)
  const headers = {
    integer: 12,
    float: 3.14,
    null: null,
    string: 'string',
    object: { foo: 'bar' },
    array: [1, 'two', 3],
    date,
    true: true,
    false: false
  }

  inject(dispatch, { method: 'GET', url: 'http://example.com:8080/hello', headers }, (err, res) => {
    t.error(err)
    t.deepEqual(JSON.parse(res.payload), {
      integer: '12',
      float: '3.14',
      null: 'null',
      string: 'string',
      object: '[object Object]',
      array: '1,two,3',
      date: date.toString(),
      true: 'true',
      false: 'false',
      host: 'example.com:8080',
      'user-agent': 'lightMyRequest'
    })
  })
})

test('errors for invalid undefined header value', (t) => {
  t.plan(1)
  try {
    inject((req, res) => {}, { url: '/', headers: { 'header-key': undefined } }, () => {})
  } catch (err) {
    t.ok(err)
  }
})

test('example with form-auto-content', (t) => {
  t.plan(4)
  const dispatch = function (req, res) {
    let body = ''
    req.on('data', d => {
      body += d
    })
    req.on('end', () => {
      res.end(body)
    })
  }

  const form = formAutoContent({
    myField: 'my value',
    myFile: fs.createReadStream('./LICENSE')
  })

  inject(dispatch, {
    method: 'POST',
    url: 'http://example.com:8080/hello',
    payload: form.payload,
    headers: form.headers
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.ok(/--.+\r\nContent-Disposition: form-data; name="myField"\r\n\r\nmy value\r\n--.*/.test(res.payload))
    t.ok(/--.+\r\nContent-Disposition: form-data; name="myFile"; filename="LICENSE"\r\n.*/.test(res.payload))
  })
})
