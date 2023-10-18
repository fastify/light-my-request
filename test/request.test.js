'use strict'

const { test } = require('tap')

const Request = require('../lib/request')

test('aborted property should be false', async (t) => {
  const mockReq = {
    url: 'http://localhost',
    method: 'GET',
    headers: {}
  }
  const req = new Request(mockReq)

  t.same(req.aborted, false)
})
