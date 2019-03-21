import * as stream from 'stream'
import * as http from 'http'

type HTTPMethods = 'DELETE' | 'GET' | 'HEAD' | 'PATCH' | 'POST' | 'PUT' | 'OPTIONS'

declare namespace LightMyRequest {

  type inject<Payload> = (
    dispatchFunc: (req: Request, res: Response) => void,
    options: string | InjectOptions,
    callback: (err: Error, payload: any) => void | Promise<Payload>
  ) => void

  function isInjection (obj: Request | Response): boolean

  interface InjectOptions {
    url: string | {
      pathname: string
      protocal?: string
      hostname?: string
      port?: any
      query?: any
    }
    headers?: http.IncomingHttpHeaders | http.OutgoingHttpHeaders
    query?: any
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
    payload?: any
    server?: http.Server
  }

  interface Request<Payload = string> extends stream.Readable {
    url: string
    httpVersion: string
    method: HTTPMethods
    headers: http.IncomingHttpHeaders
    connection: string
    _lightMyRequest: {
      payload: Payload
      isDone: boolean,
      simulate: {
        end: boolean,
        split: boolean,
        error: boolean,
        close: boolean
      }
    }
    prepare: (next: () => void) => void
    _read: () => void
  }

  interface Response extends http.ServerResponse {
    _lightMyRequest: {
      headers: http.OutgoingHttpHeaders,
      trailers: { [key: string]: string },
      payloadChunks: Array<Buffer>
    }
    _headers: http.OutgoingHttpHeaders
    _promiseCallback: boolean
    addTrailers: (trailers: { [key: string]: string }) => void
  }
}

export = LightMyRequest
