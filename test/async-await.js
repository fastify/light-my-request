'use strict'

function asyncAwaitTest (t, inject) {
  t.plan(2)

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
}

module.exports = asyncAwaitTest
