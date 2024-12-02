'use strict'

const { test } = require('tap')

const Response = require('../lib/response')

test('multiple calls to res.destroy should not be called', (t) => {
  t.plan(2)

  const mockReq = {}
  const res = new Response(mockReq, (err, response) => {
    t.ok(err)
    t.equal(err.code, 'LIGHT_ECONNRESET')
  })

  res.destroy()
  res.destroy()
})
