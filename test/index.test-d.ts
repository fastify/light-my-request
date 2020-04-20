import { inject, isInjection, Request, Response, DispatchFunc, InjectOptions, Chain } from '../index'
import { expectType } from 'tsd'

expectType<InjectOptions>({ url: '/' })

const dispatch = function (req: Request, res: Response) {
  expectType<boolean>(isInjection(req))
  expectType<boolean>(isInjection(res))

  const reply = 'Hello World'
  res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': reply.length })
  res.end(reply)
}

expectType<DispatchFunc>(dispatch)

inject(dispatch, { method: 'get', url: '/' }, (err, res) => {
  expectType<Error>(err)
  expectType<Response>(res)
  console.log(res.payload)
  expectType<Function>(res.json)
  console.log(res.cookies)
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
  expectType<Response>(res)
  console.log(res.payload)
  expectType<Function>(res.json)
  console.log(res.cookies)
})

inject(dispatch, { method: 'get', url: '/', cookies: { name1: 'value1', value2: 'value2' } }, (err, res) => {
  expectType<Error>(err)
  expectType<Response>(res)
  console.log(res.payload)
  expectType<Function>(res.json)
  console.log(res.cookies)
})

inject(dispatch, { method: 'get', url: '/', query: { name1: 'value1', value2: 'value2' } }, (err, res) => {
  expectType<Error>(err)
  expectType<Response>(res)
  console.log(res.payload)
  expectType<Function>(res.json)
  console.log(res.cookies)
})

inject(dispatch, { method: 'get', url: '/', query: { name1: ['value1', 'value2'] } }, (err, res) => {
  expectType<Error>(err)
  expectType<Response>(res)
  console.log(res.payload)
  expectType<Function>(res.json)
  console.log(res.cookies)
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
