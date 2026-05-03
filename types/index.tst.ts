/// <reference types="node" />

import * as http from 'node:http'
import { Readable } from 'node:stream'
import { bindInject, type BoundInjectFunction, type Chain, type DispatchFunc, inject, type InjectOptions, isInjection, type Response } from '.'
import { expect } from 'tstyche'

expect({ url: '/' }).type.toBeAssignableTo<InjectOptions>()
expect({ autoStart: true }).type.toBeAssignableTo<InjectOptions>()
expect({ autoStart: false }).type.toBeAssignableTo<InjectOptions>()
expect({ validate: true }).type.toBeAssignableTo<InjectOptions>()
expect({ validate: false }).type.toBeAssignableTo<InjectOptions>()

const dispatch: http.RequestListener = function (req, res) {
  expect(req).type.toBeAssignableTo<http.IncomingMessage>()
  expect(res).type.toBeAssignableTo<http.ServerResponse>()
  expect(isInjection(req)).type.toBe<boolean>()
  expect(isInjection(res)).type.toBe<boolean>()

  const reply = 'Hello World'
  res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': reply.length })
  res.end(reply)
}

expect(dispatch).type.toBe<DispatchFunc>()

const expectResponse = function (res: Response | undefined) {
  if (!res) {
    return
  }

  expect(res).type.toBe<Response>()
  expect(res.json).type.toBeAssignableTo<Function>()
  expect(res.stream).type.toBeAssignableTo<Function>()
  expect(res.raw.res).type.toBeAssignableTo<http.ServerResponse>()
  expect(res.raw.req).type.toBeAssignableTo<http.IncomingMessage>()
  expect(res.stream()).type.toBe<Readable>()
  expect(res.payload).type.toBe<string>()
  expect(res.body).type.toBe<string>()
  expect(res.cookies).type.toBeAssignableTo<Array<any>>()

  const cookie = res.cookies[0]

  if (cookie) {
    expect(cookie.name).type.toBe<string>()
    expect(cookie.value).type.toBe<string>()
    expect(cookie.expires).type.toBe<Date | undefined>()
    expect(cookie.maxAge).type.toBe<number | undefined>()
    expect(cookie.httpOnly).type.toBe<boolean | undefined>()
    expect(cookie.secure).type.toBe<boolean | undefined>()
    expect(cookie.sameSite).type.toBe<string | undefined>()
    expect(cookie.additional).type.toBe<unknown | undefined>()
  }
}

inject(dispatch, { method: 'get', url: '/' }, (err, res) => {
  expect(err).type.toBe<Error | undefined>()
  expectResponse(res)
})

const url = {
  protocol: 'http',
  hostname: 'example.com',
  port: '8080',
  pathname: 'hello',
  query: {
    test: '1234'
  }
}

inject(dispatch, { method: 'get', url }, (err, res) => {
  expect(err).type.toBe<Error | undefined>()
  expectResponse(res)
})

inject(dispatch, { method: 'get', url: '/', cookies: { name1: 'value1', value2: 'value2' } }, (err, res) => {
  expect(err).type.toBe<Error | undefined>()
  expectResponse(res)
})

inject(dispatch, { method: 'get', url: '/', query: { name1: 'value1', value2: 'value2' } }, (err, res) => {
  expect(err).type.toBe<Error | undefined>()
  expectResponse(res)
})

inject(dispatch, { method: 'get', url: '/', query: { name1: ['value1', 'value2'] } }, (err, res) => {
  expect(err).type.toBe<Error | undefined>()
  expectResponse(res)
})

inject(dispatch, { method: 'get', url: '/', query: 'name1=value1' }, (err, res) => {
  expect(err).type.toBe<Error | undefined>()
  expectResponse(res)
})

inject(dispatch, { method: 'post', url: '/', payload: { name1: 'value1', value2: 'value2' } }, (err, res) => {
  expect(err).type.toBe<Error | undefined>()
  expectResponse(res)
})

inject(dispatch, { method: 'post', url: '/', body: { name1: 'value1', value2: 'value2' } }, (err, res) => {
  expect(err).type.toBe<Error | undefined>()
  expectResponse(res)
})

inject(dispatch)
  .get('/')
  .then((value) => {
    expect(value).type.toBe<Response>()
  })

expect(inject(dispatch)).type.toBe<Chain>()
expect(inject(dispatch).end()).type.toBe<Promise<Response>>()
expect(inject(dispatch, { method: 'get', url: '/' })).type.toBe<Chain>()

const boundInject = bindInject(dispatch, { headers: { authorization: 'Bearer token' } });

(async () => {
  expect(await inject(dispatch, { method: 'get', url: '/' })).type.toBe<Response>()

  type ParsedValue = { field: string }
  const response = await inject(dispatch)

  expect(response).type.toBe<Response>()

  const parsedValue: ParsedValue = response.json()
  expect(parsedValue).type.toBe<ParsedValue>()

  const parsedValueUsingGeneric = response.json<ParsedValue>()
  expect(parsedValueUsingGeneric).type.toBe<ParsedValue>()

  expect(response).type.not.toBeAssignableTo<http.ServerResponse>()

  expect(await boundInject({ method: 'get', url: '/' })).type.toBe<Response>()
})()

const httpDispatch = function (req: http.IncomingMessage, res: http.ServerResponse) {
  expect(isInjection(req)).type.toBe<boolean>()
  expect(isInjection(res)).type.toBe<boolean>()

  const reply = 'Hello World'
  res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': reply.length })
  res.end(reply)
}

inject(httpDispatch, { method: 'get', url: '/' }, (err, res) => {
  expect(err).type.toBe<Error | undefined>()
})

inject(httpDispatch, { method: 'get', url: '/', payloadAsStream: true }, (err, res) => {
  expect(err).type.toBe<Error | undefined>()
})

expect(boundInject).type.toBe<BoundInjectFunction>()

boundInject({ method: 'get', url: '/' }, (err, res) => {
  expect(err).type.toBe<Error | undefined>()
})

expect(boundInject({ method: 'get', url: '/' })).type.toBe<Chain>()

boundInject()
  .get('/')
  .then((value) => {
    expect(value).type.toBe<Response>()
  })

const boundInjectWithDefaults = bindInject(dispatch, {
  headers: { 'x-custom': 'value' },
  cookies: { session: 'abc123' },
  query: { version: '1' }
})
expect(boundInjectWithDefaults).type.toBe<BoundInjectFunction>()
