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
})

inject(dispatch)
  .get('/')
  .end((err, res) => {
    expectType<Error>(err)
    expectType<Response>(res)
    console.log(res.payload)
  })

expectType<Chain>(inject(dispatch))
expectType<Chain>(inject(dispatch, { method: 'get', url: '/' }))
// @ts-ignore tsd supports top-level await, but normal ts does not so ignore
expectType<Response>(await inject(dispatch, { method: 'get', url: '/' }))
