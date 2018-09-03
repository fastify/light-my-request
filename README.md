# Light my Request

[![Greenkeeper badge](https://badges.greenkeeper.io/fastify/light-my-request.svg)](https://greenkeeper.io/)

[![Build Status](https://travis-ci.org/fastify/light-my-request.svg?branch=master)](https://travis-ci.org/fastify/light-my-request) [![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](http://standardjs.com/)

Injects a fake HTTP request/response into a node HTTP server for simulating server logic, writing tests, or debugging.  
Does not use a socket connection so can be run against an inactive server (server not in listen mode).  

## Example

```javascript
const http = require('http')
const inject = require('light-my-request')

const dispatch = function (req, res) {
  const reply = 'Hello World'
  res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': reply.length })
  res.end(reply)
}

const server = http.createServer(dispatch)

inject(dispatch, { method: 'get', url: '/' }, (err, res) => {
  console.log(res.payload)
})
```
Note how `server.listen` is never called.

Async await and promises are supported as well!
```javascript
// promises
inject(dispatch, { method: 'get', url: '/' })
  .then(res => console.log(res.payload))
  .catch(console.log)

// async-await
try {
  const res = await inject(dispatch, { method: 'get', url: '/' })
  console.log(res.payload)
} catch (err) {
  console.log(err)
}
```

## API

#### `inject(dispatchFunc, options, callback)`

Injects a fake request into an HTTP server.

- `dispatchFunc` - listener function. The same as you would pass to `Http.createServer` when making a node HTTP server. Has the signature `function (req, res)` where:
    - `req` - a simulated request object. Inherits from `Stream.Readable`.
    - `res` - a simulated response object. Inherits from node's `Http.ServerResponse`.
- `options` - request options object where:
  - `url` - a string specifying the request URL.
  - `method` - a string specifying the HTTP request method, defaulting to `'GET'`.
  - `authority` - a string specifying the HTTP HOST header value to be used if no header is provided, and the `url`
    does not include an authority component. Defaults to `'localhost'`.
  - `headers` - an optional object containing request headers.
  - `remoteAddress` - an optional string specifying the client remote address. Defaults to `'127.0.0.1'`.
  - `payload` - an optional request payload. Can be a string, Buffer, Stream or object.
  - `body` - alias for payload.
  - `simulate` - an object containing flags to simulate various conditions:
    - `end` - indicates whether the request will fire an `end` event. Defaults to `undefined`, meaning an `end` event will fire.
    - `split` - indicates whether the request payload will be split into chunks. Defaults to `undefined`, meaning payload will not be chunked.
    - `error` - whether the request will emit an `error` event. Defaults to `undefined`, meaning no `error` event will be emitted. If set to `true`, the emitted error will have a message of `'Simulated'`.
    - `close` - whether the request will emit a `close` event. Defaults to `undefined`, meaning no `close` event will be emitted.
  - `validate` - Optional flag to validate this options object. Defaults to `true`.
  - `server` - Optional http server. It is used for binding the `dispatchFunc`.
- `callback` - the callback function using the signature `function (err, res)` where:
  - `err` - error object
  - `res` - a response object where:
    - `raw` - an object containing the raw request and response objects where:
      - `req` - the simulated request object.
      - `res` - the simulated response object.
    - `headers` - an object containing the response headers.
    - `statusCode` - the HTTP status code.
    - `statusMessage` - the HTTP status message.
    - `payload` - the payload as a UTF-8 encoded string.
    - `body` - alias for payload.
    - `rawPayload` - the raw payload as a Buffer.
    - `trailers` - an object containing the response trailers.

Note: You can also pass a string in place of the `options` object as a shorthand for `{url: string, method: 'GET'}`.

#### `inject.isInjection(obj)`

Checks if given object `obj` is a *light-my-request* `Request` object.

## Acknowledgements
This project has been forked from [`hapi/shot`](https://github.com/hapijs/shot) because we wanted to support *Node ≥ v4* and not only *Node ≥ v8*.  
All the credits before the commit [00a2a82](https://github.com/fastify/light-my-request/commit/00a2a82eb773b765003b6085788cc3564cd08326) goes to the `hapi/shot` project [contributors](https://github.com/hapijs/shot/graphs/contributors).  
Since the commit [db8bced](https://github.com/fastify/light-my-request/commit/db8bced10b4367731688c8738621d42f39680efc) the project will be maintained by the Fastify team.

## License

Licensed under [BSD-3-Clause](./LICENSE).
