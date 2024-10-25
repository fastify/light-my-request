'use strict'

const t = require('tap')
const fs = require('node:fs')
const test = t.test
const zlib = require('node:zlib')
const express = require('express')

const inject = require('../index')

function accumulate (stream, cb) {
  const chunks = []
  stream.on('error', cb)
  stream.on('data', (chunk) => {
    chunks.push(chunk)
  })
  stream.on('end', () => {
    cb(null, Buffer.concat(chunks))
  })
}

test('stream mode - non-chunked payload', (t) => {
  t.plan(9)
  const output = 'example.com:8080|/hello'

  const dispatch = function (req, res) {
    res.statusMessage = 'Super'
    res.setHeader('x-extra', 'hello')
    res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': output.length })
    res.end(req.headers.host + '|' + req.url)
  }

  inject(dispatch, {
    url: 'http://example.com:8080/hello',
    payloadAsStream: true
  }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.equal(res.statusMessage, 'Super')
    t.ok(res.headers.date)
    t.strictSame(res.headers, {
      date: res.headers.date,
      connection: 'keep-alive',
      'x-extra': 'hello',
      'content-type': 'text/plain',
      'content-length': output.length.toString()
    })
    t.equal(res.payload, undefined)
    t.equal(res.rawPayload, undefined)

    accumulate(res.stream(), (err, payload) => {
      t.error(err)
      t.equal(payload.toString(), 'example.com:8080|/hello')
    })
  })
})

test('stream mode - passes headers', (t) => {
  t.plan(3)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end(req.headers.super)
  }

  inject(dispatch, {
    method: 'GET',
    url: 'http://example.com:8080/hello',
    headers: { Super: 'duper' },
    payloadAsStream: true
  }, (err, res) => {
    t.error(err)
    accumulate(res.stream(), (err, payload) => {
      t.error(err)
      t.equal(payload.toString(), 'duper')
    })
  })
})

test('stream mode - returns chunked payload', (t) => {
  t.plan(6)
  const dispatch = function (req, res) {
    res.writeHead(200, 'OK')
    res.write('a')
    res.write('b')
    res.end()
  }

  inject(dispatch, { method: 'GET', url: '/', payloadAsStream: true }, (err, res) => {
    t.error(err)
    t.ok(res.headers.date)
    t.ok(res.headers.connection)
    t.equal(res.headers['transfer-encoding'], 'chunked')
    accumulate(res.stream(), (err, payload) => {
      t.error(err)
      t.equal(payload.toString(), 'ab')
    })
  })
})

test('stream mode - sets trailers in response object', (t) => {
  t.plan(4)
  const dispatch = function (req, res) {
    res.setHeader('Trailer', 'Test')
    res.addTrailers({ Test: 123 })
    res.end()
  }

  inject(dispatch, { method: 'GET', url: '/', payloadAsStream: true }, (err, res) => {
    t.error(err)
    t.equal(res.headers.trailer, 'Test')
    t.equal(res.headers.test, undefined)
    t.equal(res.trailers.test, '123')
  })
})

test('stream mode - parses zipped payload', (t) => {
  t.plan(5)
  const dispatch = function (req, res) {
    res.writeHead(200, 'OK')
    const stream = fs.createReadStream('./package.json')
    stream.pipe(zlib.createGzip()).pipe(res)
  }

  inject(dispatch, { method: 'GET', url: '/', payloadAsStream: true }, (err, res) => {
    t.error(err)
    fs.readFile('./package.json', { encoding: 'utf-8' }, (err, file) => {
      t.error(err)

      accumulate(res.stream(), (err, payload) => {
        t.error(err)

        zlib.unzip(payload, (err, unzipped) => {
          t.error(err)
          t.equal(unzipped.toString('utf-8'), file)
        })
      })
    })
  })
})

test('stream mode - returns multi buffer payload', (t) => {
  t.plan(3)
  const dispatch = function (req, res) {
    res.writeHead(200)
    res.write('a')
    res.write(Buffer.from('b'))
    res.end()
  }

  inject(dispatch, { method: 'GET', url: '/', payloadAsStream: true }, (err, res) => {
    t.error(err)

    const chunks = []
    const stream = res.stream()
    stream.on('data', (chunk) => {
      chunks.push(chunk)
    })

    stream.on('end', () => {
      t.equal(chunks.length, 2)
      t.equal(Buffer.concat(chunks).toString(), 'ab')
    })
  })
})

test('stream mode - returns null payload', (t) => {
  t.plan(4)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Length': 0 })
    res.end()
  }

  inject(dispatch, { method: 'GET', url: '/', payloadAsStream: true }, (err, res) => {
    t.error(err)
    t.equal(res.payload, undefined)
    accumulate(res.stream(), (err, payload) => {
      t.error(err)
      t.equal(payload.toString(), '')
    })
  })
})

test('stream mode - simulates error', (t) => {
  t.plan(3)
  const dispatch = function (req, res) {
    req.on('readable', () => {
    })

    req.on('error', () => {
      res.writeHead(200, { 'Content-Length': 0 })
      res.end('error')
    })
  }

  const body = 'something special just for you'
  inject(dispatch, { method: 'GET', url: '/', payload: body, simulate: { error: true }, payloadAsStream: true }, (err, res) => {
    t.error(err)
    accumulate(res.stream(), (err, payload) => {
      t.error(err)
      t.equal(payload.toString(), 'error')
    })
  })
})

test('stream mode - promises support', (t) => {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('hello')
  }

  inject(dispatch, { method: 'GET', url: 'http://example.com:8080/hello', payloadAsStream: true })
    .then((res) => {
      return new Promise((resolve, reject) => {
        accumulate(res.stream(), (err, payload) => {
          if (err) {
            return reject(err)
          }
          resolve(payload)
        })
      })
    })
    .then(payload => t.equal(payload.toString(), 'hello'))
    .catch(t.fail)
})

test('stream mode - Response.json() should throw', (t) => {
  t.plan(2)

  const jsonData = {
    a: 1,
    b: '2'
  }

  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(jsonData))
  }

  inject(dispatch, { method: 'GET', path: 'http://example.com:8080/hello', payloadAsStream: true }, (err, res) => {
    t.error(err)
    const { json } = res
    t.throws(json)
  })
})

test('stream mode - error for response destroy', (t) => {
  t.plan(2)

  const dispatch = function (req, res) {
    res.destroy()
  }

  inject(dispatch, { method: 'GET', url: '/', payloadAsStream: true }, (err, res) => {
    t.error(err)
    accumulate(res.stream(), (err) => {
      t.ok(err)
    })
  })
})

test('stream mode - request destory with error', (t) => {
  t.plan(2)

  const fakeError = new Error('some-err')

  const dispatch = function (req, res) {
    req.destroy(fakeError)
  }

  inject(dispatch, { method: 'GET', url: '/', payloadAsStream: true }, (err, res) => {
    t.error(err)
    accumulate(res.stream(), (err, res) => {
      t.equal(err, fakeError)
    })
  })
})

test('stream mode - Can abort a request using AbortController/AbortSignal', async (t) => {
  const dispatch = function (req, res) {
    res.writeHead(200)
  }

  const controller = new AbortController()
  const res = await inject(dispatch, {
    method: 'GET',
    url: 'http://example.com:8080/hello',
    signal: controller.signal,
    payloadAsStream: true
  })
  controller.abort()

  await t.rejects(async () => {
    for await (const c of res.stream()) {
      t.fail(`should not loop, got ${c.toString()}`)
    }
  })
}, { skip: globalThis.AbortController == null })

test("stream mode - passes payload when using express' send", (t) => {
  t.plan(4)

  const app = express()

  app.get('/hello', (req, res) => {
    res.send('some text')
  })

  inject(app, { method: 'GET', url: 'http://example.com:8080/hello', payloadAsStream: true }, (err, res) => {
    t.error(err)
    t.equal(res.headers['content-length'], '9')
    accumulate(res.stream(), function (err, payload) {
      t.error(err)
      t.equal(payload.toString(), 'some text')
    })
  })
})
