import * as http from 'http'
import { inject, isInjection, Request, Response, DispatchFunc, InjectOptions, Chain } from '../index'
import { expectType, expectAssignable } from 'tsd'

expectAssignable<InjectOptions>({ url: '/' })

const dispatch = function (req: Request, res: Response) {
  expectType<boolean>(isInjection(req))
  expectType<boolean>(isInjection(res))

  const reply = 'Hello World'
  res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': reply.length })
  res.end(reply)
}

const expectResponse = function (res: Response) {
  expectType<Response>(res)
  console.log(res.payload)
  expectAssignable<Function>(res.json)
  expectAssignable<http.ServerResponse>(res.raw.res)
  expectAssignable<Request>(res.raw.req)
  console.log(res.cookies)
}

expectType<DispatchFunc>(dispatch)

inject(dispatch, { method: 'get', url: '/' }, (err, res) => {
  expectType<Error>(err)
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
  expectType<Error>(err)
  expectResponse(res)
})

inject(dispatch, { method: 'get', url: '/', cookies: { name1: 'value1', value2: 'value2' } }, (err, res) => {
  expectType<Error>(err)
  expectResponse(res)
})

inject(dispatch, { method: 'get', url: '/', query: { name1: 'value1', value2: 'value2' } }, (err, res) => {
  expectType<Error>(err)
  expectResponse(res)
})

inject(dispatch, { method: 'get', url: '/', query: { name1: ['value1', 'value2'] } }, (err, res) => {
  expectType<Error>(err)
  expectResponse(res)
})

inject(dispatch)
  .get('/')
  .end((err, res) => {
    expectType<Error>(err)
    expectType<Response>(res)
    console.log(res.payload)
  })

expectType<Chain>(inject(dispatch))
expectType<Promise<Response>>(inject(dispatch).end())
expectType<Chain>(inject(dispatch, { method: 'get', url: '/' }))
// @ts-ignore tsd supports top-level await, but normal ts does not so ignore
expectType<Response>(await inject(dispatch, { method: 'get', url: '/' }))

type ParsedValue = { field: string }
// @ts-ignore tsd supports top-level await, but normal ts does not so ignore
const response: Response = await inject(dispatch)
const parsedValue: ParsedValue = response.json()
expectType<ParsedValue>(parsedValue)

const parsedValueUsingGeneric = response.json<ParsedValue>()
expectType<ParsedValue>(parsedValueUsingGeneric)
