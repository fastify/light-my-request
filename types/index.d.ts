import * as http from 'http'

type HTTPMethods = 'DELETE' | 'delete' |
                   'GET' | 'get' |
                   'HEAD' | 'head' |
                   'PATCH' | 'patch' |
                   'POST' | 'post' |
                   'PUT' | 'put' |
                   'OPTIONS' | 'options'

type Inject = typeof inject

declare namespace inject {

  export type DispatchFunc = http.RequestListener

  export type CallbackFunc = (err: Error, response: Response) => void

  export type InjectPayload = string | object | Buffer | NodeJS.ReadableStream

  export function isInjection (obj: http.IncomingMessage | http.ServerResponse): boolean

  export interface AbortSignal {
    readonly aborted: boolean;
  }

  export interface InjectOptions {
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
    cookies?: { [k: string]: string },
    signal?: AbortSignal,
    Request?: object,
  }

  export interface Response {
    raw: {
      res: http.ServerResponse,
      req: http.IncomingMessage
    }
    rawPayload: Buffer
    headers: http.OutgoingHttpHeaders
    statusCode: number
    statusMessage: string
    trailers: { [key: string]: string }
    payload: string
    body: string
    json: <T = any>() => T
    cookies: Array<object>
  }

  export interface Chain extends Promise<Response> {
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
    query: (query: string | { [k: string]: string | string[] } ) => Chain
    cookies: (query: object) => Chain
    end(): Promise<Response>
    end(callback: CallbackFunc): void
  }

  export const inject: Inject
  export { inject as default }
}

declare function inject (
  dispatchFunc: inject.DispatchFunc,
  options?: string | inject.InjectOptions
): inject.Chain
declare function inject (
  dispatchFunc: inject.DispatchFunc,
  options: string | inject.InjectOptions,
  callback: inject.CallbackFunc
): void

export = inject
