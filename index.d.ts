import * as stream from 'stream'
import * as http from 'http'

type HTTPMethods = 'DELETE' | 'delete' |
                   'GET' | 'get' |
                   'HEAD' | 'head' |
                   'PATCH' | 'patch' |
                   'POST' | 'post' |
                   'PUT' | 'put' |
                   'OPTIONS' | 'options'

declare namespace LightMyRequest {
  function inject (
    dispatchFunc: DispatchFunc,
    options?: string | InjectOptions
  ): Chain
  function inject (
    dispatchFunc: DispatchFunc,
    options: string | InjectOptions,
    callback: CallbackFunc
  ): void

  type DispatchFunc = (req: Request, res: Response) => void

  type CallbackFunc = (err: Error, response: Response) => void

  type InjectPayload = string | object | Buffer | NodeJS.ReadableStream

  function isInjection (obj: Request | Response): boolean

  interface InjectOptions {
    url?: string | {
      pathname: string
      protocol?: string
      hostname?: string
      port?: string | number
      query?: string | { [k: string]: string | string[] }
    }
    path?: string | {
      pathname: string
      protocol?: string
      hostname?: string
      port?: string | number
      query?: string | { [k: string]: string | string[] }
    }
    headers?: http.IncomingHttpHeaders | http.OutgoingHttpHeaders
    query?: string | { [k: string]: string | string[] }
    simulate?: {
      end: boolean,
      split: boolean,
      error: boolean,
      close: boolean
    }
    authority?: string
    remoteAddress?: string
    method?: HTTPMethods
    validate?: boolean
    payload?: InjectPayload
    server?: http.Server
    cookies?: { [k: string]: string }
  }

  interface Request extends stream.Readable {
    url: string
    httpVersion: string
    method: HTTPMethods
    headers: http.IncomingHttpHeaders
    prepare: (next: () => void) => void
  }

  interface Response extends http.ServerResponse {
    raw: {
      res: http.ServerResponse
    }
    rawPayload: Buffer
    headers: http.OutgoingHttpHeaders
    statusCode: number
    statusMessage: string
    trailers: { [key: string]: string }
    payload: string
    body: string
    json: () => any
    cookies: Array<object>
  }

  interface Chain {
    delete: (url: string) => Chain
    get: (url: string) => Chain
    head: (url: string) => Chain
    options: (url: string) => Chain
    patch: (url: string) => Chain
    post: (url: string) => Chain
    put: (url: string) => Chain
    trace: (url: string) => Chain
    body: (body: InjectPayload) => Chain
    headers: (headers: http.IncomingHttpHeaders | http.OutgoingHttpHeaders) => Chain
    payload: (payload: InjectPayload) => Chain
    query: (query: object) => Chain
    cookies: (query: object) => Chain
    end: (callback?: CallbackFunc) => Promise<Response>
  }
}

export = LightMyRequest
