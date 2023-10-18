'use strict'

const { test } = require('tap')

const Response = require('../lib/response')

test('multiple calls to res.destroy should not be called', (t) => {
  t.plan(1)

  const mockReq = {}
  const res = new Response(mockReq, (err, response) => {
    t.error(err)
  })

  res.destroy()
  res.destroy()
})
