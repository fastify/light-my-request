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
    options: string | InjectOptions
  ): Promise<Response>
  function inject (
    dispatchFunc: DispatchFunc,
    options: string | InjectOptions,
    callback: (err: Error, response: Response) => void
  ): void

  type DispatchFunc = (req: Request, res: Response) => void

  type InjectPayload = string | object | Buffer | NodeJS.ReadableStream

  function isInjection (obj: Request | Response): boolean

  interface InjectOptions {
    url?: string | {
      pathname: string
      protocal?: string
      hostname?: string
      port?: string | number
      query?: string
    }
    path?: string | {
      pathname: string
      protocal?: string
      hostname?: string
      port?: string | number
      query?: string
    }
    headers?: http.IncomingHttpHeaders | http.OutgoingHttpHeaders
    query?: string
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
    addTrailers: (trailers: { [key: string]: string }) => void
  }
}

export = LightMyRequest
