'use strict'

const Ajv = require('ajv').default
const standaloneCode = require('ajv/dist/standalone').default
const http = require('http')
const fs = require('fs')
const path = require('path')

const ajv = new Ajv({ code: { source: true } })

const urlSchema = {
  oneOf: [
    { type: 'string' },
    {
      type: 'object',
      properties: {
        protocol: { type: 'string' },
        hostname: { type: 'string' },
        pathname: { type: 'string' }
        // port type => any
        // query type => any
      },
      additionalProperties: true,
      required: ['pathname']
    }
  ]
}

const schema = {
  type: 'object',
  properties: {
    url: urlSchema,
    path: urlSchema,
    cookies: {
      type: 'object',
      additionalProperties: true
    },
    headers: {
      type: 'object',
      additionalProperties: true
    },
    query: {
      type: 'object',
      additionalProperties: true
    },
    simulate: {
      type: 'object',
      properties: {
        end: { type: 'boolean' },
        split: { type: 'boolean' },
        error: { type: 'boolean' },
        close: { type: 'boolean' }
      }
    },
    authority: { type: 'string' },
    remoteAddress: { type: 'string' },
    method: { type: 'string', enum: http.METHODS.concat(http.METHODS.map(toLowerCase)) },
    validate: { type: 'boolean' }
    // payload type => any
  },
  additionalProperties: true,
  oneOf: [
    { required: ['url'] },
    { required: ['path'] }
  ]
}

const validate = ajv.compile(schema)

const moduleCode = standaloneCode(ajv, validate)

fs.writeFileSync(path.join(__dirname, '/validate.js'), moduleCode)

function toLowerCase (m) { return m.toLowerCase() }
