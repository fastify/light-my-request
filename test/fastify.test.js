'use strict'

const fs = require('fs')
const path = require('path')

const t = require('tap')
const formAutoContent = require('form-auto-content')

const fastify = require('fastify')
const fastifyMultipart = require('@fastify/multipart')

t.test('Works with multipart', async t => {
  const app = fastify()
  app.register(fastifyMultipart)

  app.post('/', async function (req, reply) {
    const data = await req.file()
    const buffer = await data.toBuffer()

    t.equal(data.filename, 'bar.md')
    return buffer.toString()
  })

  const filePath = path.join(__dirname, '../README.md')
  const myForm = formAutoContent({
    myRenamedFile: {
      value: fs.createReadStream(filePath),
      options: {
        filename: 'bar.md',
        contentType: 'text/markdown'
      }
    }
  })

  const res = await app.inject({
    method: 'POST',
    url: '/',
    ...myForm
  })
  t.equal(res.statusCode, 200)
  t.ok(res.payload.startsWith('# Light my Request'))
})
