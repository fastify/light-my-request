const t = require('tap')
const test = t.test

const Request = require('../lib/request')
const Response = require('../lib/response')

test('fixProto freezes proto methods', (t) => {
  t.plan(5)

  const opts = {
    path: '/dummy',
    method: 'get'
  }
  const cb = () => {}

  const req = new Request(opts)
  const res = new Response(req, cb)
  res.fixProto()

  const { write, end, writeHead, destroy, addTrailers } = res

  res.write = 'changed write'
  res.end = 'changed end'
  res.writeHead = 'changed writeHead'
  res.destroy = 'changed destroy'
  res.addTrailers = 'changed addTrailers'

  t.equal(res.write, write)
  t.equal(res.end, end)
  t.equal(res.writeHead, writeHead)
  t.equal(res.destroy, destroy)
  t.equal(res.addTrailers, addTrailers)
})
