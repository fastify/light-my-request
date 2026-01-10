'use strict'

const { test } = require('node:test')
const { bindInject } = require('../index')

test('bindInject returns a function', (t) => {
  const dispatch = function (req, res) {
    res.writeHead(200)
    res.end()
  }

  const boundInject = bindInject(dispatch, { headers: { authorization: 'Bearer token' } })
  t.assert.strictEqual(typeof boundInject, 'function')
})

test('bindInject applies default headers', async (t) => {
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ authorization: req.headers.authorization }))
  }

  const boundInject = bindInject(dispatch, { headers: { authorization: 'Bearer token123' } })
  const res = await boundInject({ method: 'get', url: '/' })

  t.assert.strictEqual(res.statusCode, 200)
  t.assert.deepStrictEqual(res.json(), { authorization: 'Bearer token123' })
})

test('bindInject merges request headers with default headers', async (t) => {
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      authorization: req.headers.authorization,
      'x-custom': req.headers['x-custom']
    }))
  }

  const boundInject = bindInject(dispatch, { headers: { authorization: 'Bearer token123' } })
  const res = await boundInject({ method: 'get', url: '/', headers: { 'x-custom': 'custom-value' } })

  t.assert.strictEqual(res.statusCode, 200)
  const body = res.json()
  t.assert.deepStrictEqual(body, {
    authorization: 'Bearer token123',
    'x-custom': 'custom-value'
  })
})

test('bindInject request headers override default headers', async (t) => {
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ authorization: req.headers.authorization }))
  }

  const boundInject = bindInject(dispatch, { headers: { authorization: 'Bearer default-token' } })
  const res = await boundInject({ method: 'get', url: '/', headers: { authorization: 'Bearer override-token' } })

  t.assert.strictEqual(res.statusCode, 200)
  t.assert.deepStrictEqual(res.json(), { authorization: 'Bearer override-token' })
})

test('bindInject applies default cookies', async (t) => {
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ cookie: req.headers.cookie }))
  }

  const boundInject = bindInject(dispatch, { cookies: { session: 'abc123' } })
  const res = await boundInject({ method: 'get', url: '/' })

  t.assert.strictEqual(res.statusCode, 200)
  const body = res.json()
  t.assert.ok(body.cookie)
  t.assert.ok(body.cookie.includes('session=abc123'))
})

test('bindInject merges request cookies with default cookies', async (t) => {
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ cookie: req.headers.cookie }))
  }

  const boundInject = bindInject(dispatch, { cookies: { session: 'abc123' } })
  const res = await boundInject({ method: 'get', url: '/', cookies: { user: 'john' } })

  t.assert.strictEqual(res.statusCode, 200)
  const cookie = res.json().cookie
  t.assert.ok(cookie.includes('session=abc123'))
  t.assert.ok(cookie.includes('user=john'))
})

test('bindInject applies default query parameters', async (t) => {
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ url: req.url }))
  }

  const boundInject = bindInject(dispatch, { query: { version: '1' } })
  const res = await boundInject({ method: 'get', url: '/' })

  t.assert.strictEqual(res.statusCode, 200)
  const body = res.json()
  t.assert.ok(body.url)
  t.assert.ok(body.url.includes('version=1'))
})

test('bindInject merges request query with default query', async (t) => {
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ url: req.url }))
  }

  const boundInject = bindInject(dispatch, { query: { version: '1' } })
  const res = await boundInject({ method: 'get', url: '/', query: { page: '2' } })

  t.assert.strictEqual(res.statusCode, 200)
  const url = res.json().url
  t.assert.ok(url.includes('version=1'))
  t.assert.ok(url.includes('page=2'))
})

test('bindInject works with callback', (t, done) => {
  t.plan(2)

  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ authorization: req.headers.authorization }))
  }

  const boundInject = bindInject(dispatch, { headers: { authorization: 'Bearer token123' } })
  boundInject({ method: 'get', url: '/' }, (err, res) => {
    t.assert.ifError(err)
    t.assert.deepStrictEqual(res.json(), { authorization: 'Bearer token123' })
    done()
  })
})

test('bindInject works with method chaining', async (t) => {
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      authorization: req.headers.authorization,
      method: req.method,
      url: req.url
    }))
  }

  const boundInject = bindInject(dispatch, { headers: { authorization: 'Bearer token123' } })
  const res = await boundInject().get('/test')

  t.assert.strictEqual(res.statusCode, 200)
  const body = res.json()
  t.assert.strictEqual(body.authorization, 'Bearer token123')
  t.assert.strictEqual(body.method, 'GET')
  t.assert.ok(body.url)
  t.assert.ok(body.url.includes('/test'))
})

test('bindInject chain headers override defaults', async (t) => {
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      authorization: req.headers.authorization,
      'x-custom': req.headers['x-custom']
    }))
  }

  const boundInject = bindInject(dispatch, { headers: { authorization: 'Bearer token123' } })
  // Note: chain .headers() replaces the entire headers object, it does not merge
  const res = await boundInject().get('/').headers({ 'x-custom': 'custom-value' })

  t.assert.strictEqual(res.statusCode, 200)
  const body = res.json()
  // Authorization header is not present because .headers() replaces the entire headers object
  t.assert.deepStrictEqual(body, {
    'x-custom': 'custom-value'
  })
})

test('bindInject with URL string as options', async (t) => {
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      authorization: req.headers.authorization,
      url: req.url
    }))
  }

  const boundInject = bindInject(dispatch, { headers: { authorization: 'Bearer token123' } })
  const res = await boundInject('/test-path')

  t.assert.strictEqual(res.statusCode, 200)
  t.assert.deepStrictEqual(res.json(), {
    authorization: 'Bearer token123',
    url: '/test-path'
  })
})

test('bindInject without options uses defaults only', async (t) => {
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      authorization: req.headers.authorization
    }))
  }

  const boundInject = bindInject(dispatch, { headers: { authorization: 'Bearer token123' }, url: '/' })
  const res = await boundInject()

  t.assert.strictEqual(res.statusCode, 200)
  t.assert.deepStrictEqual(res.json(), { authorization: 'Bearer token123' })
})

test('bindInject throws with invalid dispatchFunc', (t) => {
  const boundInject = bindInject('not a function', { headers: {} })

  return t.assert.rejects(boundInject, /dispatchFunc should be a function/)
})

test('bindInject does not throw with validate false', (t) => {
  t.assert.doesNotThrow(() => {
    bindInject('not a function', { validate: false })
  })
})

test('boundInject creates independent chains', async (t) => {
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      authorization: req.headers.authorization,
      url: req.url
    }))
  }

  const boundInject = bindInject(dispatch, { headers: { authorization: 'Bearer token123' } })

  const [res1, res2] = await Promise.all([
    boundInject({ method: 'get', url: '/path1' }),
    boundInject({ method: 'get', url: '/path2' })
  ])

  t.assert.deepStrictEqual(res1.json(), {
    authorization: 'Bearer token123',
    url: '/path1'
  })
  t.assert.deepStrictEqual(res2.json(), {
    authorization: 'Bearer token123',
    url: '/path2'
  })
})

test('bindInject preserves other default options', async (t) => {
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      method: req.method,
      remoteAddress: req.socket.remoteAddress
    }))
  }

  const boundInject = bindInject(dispatch, { method: 'POST', remoteAddress: '192.168.1.1' })
  const res = await boundInject({ url: '/' })

  t.assert.strictEqual(res.statusCode, 200)
  t.assert.deepStrictEqual(res.json(), {
    method: 'POST',
    remoteAddress: '192.168.1.1'
  })
})

test('bindInject request options override non-header defaults', async (t) => {
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ method: req.method }))
  }

  const boundInject = bindInject(dispatch, { method: 'POST' })
  const res = await boundInject({ method: 'PUT', url: '/' })

  t.assert.strictEqual(res.statusCode, 200)
  t.assert.deepStrictEqual(res.json(), { method: 'PUT' })
})

test('bindInject with string query in request', async (t) => {
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ url: req.url }))
  }

  const boundInject = bindInject(dispatch, { query: { version: '1' } })
  const res = await boundInject({ method: 'get', url: '/', query: 'page=2' })

  t.assert.strictEqual(res.statusCode, 200)
  const body = res.json()
  // String query should override object query from defaults
  t.assert.ok(body.url)
  t.assert.ok(body.url.includes('page=2'))
})

test('bindInject with string defaults', async (t) => {
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ url: req.url }))
  }

  const boundInject = bindInject(dispatch, '/default-path')
  const res = await boundInject()

  t.assert.strictEqual(res.statusCode, 200)
  t.assert.deepStrictEqual(res.json(), { url: '/default-path' })
})
