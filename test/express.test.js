'use strict'

const test = require('tap').test
const express = require('express')

const inject = require('../index')

test('works with express with callback', (t) => {
  t.plan(8)

  const app = express()

  app.get('/', (req, res) => {
    res.send({ ok: true, path: '/' })
  })

  app.get('/blah', (req, res) => {
    res.send({ ok: true, path: '/blah' })
  })

  inject(app, { url: '/', express: true }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.deepEqual(res.json(), { ok: true, path: '/' })
  })

  inject(app, { url: '/blah', express: true }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 200)
    t.deepEqual(res.json(), { ok: true, path: '/blah' })
  })

  inject(app, { url: '/bad-path', express: true }, (err, res) => {
    t.error(err)
    t.equal(res.statusCode, 404)
  })
})

test('works with express with promise', (t) => {
  t.plan(5)

  const app = express()

  app.get('/', (req, res) => {
    res.send({ ok: true, path: '/' })
  })

  app.get('/blah', (req, res) => {
    res.send({ ok: true, path: '/blah' })
  })

  inject(app, { url: '/', express: true }).then((res) => {
    t.equal(res.statusCode, 200)
    t.deepEqual(res.json(), { ok: true, path: '/' })
  })

  inject(app, { url: '/blah', express: true }).then((res) => {
    t.equal(res.statusCode, 200)
    t.deepEqual(res.json(), { ok: true, path: '/blah' })
  })

  inject(app, { url: '/bad-path', express: true }).then((res) => {
    t.equal(res.statusCode, 404)
  })
})
