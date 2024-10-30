'use strict'

const { test } = require('node:test')

const Response = require('../lib/response')

test('multiple calls to res.destroy should not be called', (t, done) => {
  t.plan(1)

  const mockReq = {}
  const res = new Response(mockReq, (err, response) => {
    t.assert.ifError(err)
    done()
  })

  res.destroy()
  res.destroy()
})
