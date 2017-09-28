'use strict'

async function asyncAwaitTest (t, inject) {
  t.plan(1)
  const dispatch = function (req, res) {
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('hello')
  }

  const res = await inject(dispatch, { method: 'get', url: 'http://example.com:8080/hello' })
  t.equal(res.payload, 'hello')
}

module.exports = asyncAwaitTest
