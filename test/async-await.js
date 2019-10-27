'use strict'

function asyncAwaitTest (t, inject) {
  t.plan(3)

  t.test('basic async await', async t => {
    const dispatch = function (req, res) {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('hello')
    }

    try {
      const res = await inject(dispatch, { method: 'GET', url: 'http://example.com:8080/hello' })
      t.equal(res.payload, 'hello')
    } catch (err) {
      t.fail(err)
    }
  })

  t.test('basic async await (errored)', async t => {
    const dispatch = function (req, res) {
      res.connection.destroy(new Error('kaboom'))
    }

    try {
      await inject(dispatch, { method: 'GET', url: 'http://example.com:8080/hello' })
      t.fail('should throw')
    } catch (err) {
      t.ok(err)
    }
  })

  t.test('chainable api with async await', async t => {
    const dispatch = function (req, res) {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('hello')
    }

    try {
      const chain = inject(dispatch).get('http://example.com:8080/hello')
      const res = await chain.end()
      t.equal(res.payload, 'hello')
    } catch (err) {
      t.fail(err)
    }
  })
}

module.exports = asyncAwaitTest
