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

You can also use chaining methods if you do not pass the callback function. Check [here](#method-chaining) for details.

```js
// chaining methods
inject(dispatch)
  .get('/')                   // set the request method to GET, and request URL to '/'
  .headers({ foo: 'bar' })    // set the request headers
  .query({ foo: 'bar' })      // set the query parameters
  .end((err, res) => {
    console.log(res.payload)
  })

inject(dispatch)
  .post('/')                  // set the request method to POST, and request URL to '/'
  .payload('request payload') // set the request payload
  .body('request body')       // alias for payload
  .end((err, res) => {
    console.log(res.payload)
  })

// async-await is also supported
try {
  const chain = inject(dispatch).get('/')
  const res = await chain.end()
  console.log(res.payload)
} catch (err) {
  console.log(err)
}
```

File uploads (multipart/form-data) can be achieved by using [form-data](https://github.com/form-data/form-data) package as shown below:

```js
const FormData = require('form-data')
const fs = require('fs')

try {
  const form = new FormData()
  form.append('myfile', fs.createReadStream(`./path/to/file`))

  const res = await inject(dispatch, {
    method: 'post',
    url: '/upload',
    payload: form,
    headers: form.getHeaders()
  })
  console.log(res.payload)
} catch (err) {
  console.log(err)
}
```

This module ships with a handwritten TypeScript declaration file for TS support. The declaration exports a single namespace `LightMyRequest`. You can import it one of two ways:
```typescript
import * as LightMyRequest from 'light-my-request'

const dispatch: LightMyRequest.DispatchFunc = function (req, res) {
  const reply = 'Hello World'
  res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': reply.length })
  res.end(reply)
}

LightMyRequest.inject(dispatch, { method: 'get', url: '/' }, (err, res) => {
  console.log(res.payload)
})

// or
import { inject, DistpatchFunc } from 'light-my-request'

const dispatch: DispatchFunc = function (req, res) {
  const reply = 'Hello World'
  res.writeHead(200, { 'Content-Type': 'text/plain', 'Content-Length': reply.length })
  res.end(reply)
}

inject(dispatch, { method: 'get', url: '/' }, (err, res) => {
  console.log(res.payload)
})
```
The declaration file exports types for the following parts of the API:
- `inject` - standard light-my-request `inject` method
- `DispatchFunc` - the fake HTTP dispatch function
- `InjectPayload` - a union type for valid payload types
- `isInjection` - standard light-my-request `isInjection` method
- `InjectOptions` - options object for `inject` method
- `Request` - custom light-my-request `request` object interface. Extends Node.js `stream.Readable` type
- `Response` - custom light-my-request `response` object interface. Extends Node.js `http.ServerResponse` type

## API

#### `inject(dispatchFunc[, options, callback])`

Injects a fake request into an HTTP server.

- `dispatchFunc` - listener function. The same as you would pass to `Http.createServer` when making a node HTTP server. Has the signature `function (req, res)` where:
    - `req` - a simulated request object. Inherits from `Stream.Readable`.
    - `res` - a simulated response object. Inherits from node's `Http.ServerResponse`.
- `options` - request options object where:
  - `url` | `path` - a string specifying the request URL.
  - `method` - a string specifying the HTTP request method, defaulting to `'GET'`.
  - `authority` - a string specifying the HTTP HOST header value to be used if no header is provided, and the `url`
    does not include an authority component. Defaults to `'localhost'`.
  - `headers` - an optional object containing request headers.
  - `remoteAddress` - an optional string specifying the client remote address. Defaults to `'127.0.0.1'`.
  - `payload` - an optional request payload. Can be a string, Buffer, Stream or object. If the payload is string, Buffer or Stream is used as is as the request payload. Oherwise it is serialized with `JSON.stringify` forcing the request to have the `Content-type` equal to `application/json`
  - `query` - an optional object containing query parameters.
  - `body` - alias for payload.
  - `simulate` - an object containing flags to simulate various conditions:
    - `end` - indicates whether the request will fire an `end` event. Defaults to `undefined`, meaning an `end` event will fire.
    - `split` - indicates whether the request payload will be split into chunks. Defaults to `undefined`, meaning payload will not be chunked.
    - `error` - whether the request will emit an `error` event. Defaults to `undefined`, meaning no `error` event will be emitted. If set to `true`, the emitted error will have a message of `'Simulated'`.
    - `close` - whether the request will emit a `close` event. Defaults to `undefined`, meaning no `close` event will be emitted.
  - `validate` - Optional flag to validate this options object. Defaults to `true`.
  - `server` - Optional http server. It is used for binding the `dispatchFunc`.
  - `autoStart` - Automatically start the request as soon as the method
    is called. It is only valid when not passing a callback. Defaults to `true`.
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
    - `json` - a function that parses the `application/json` response payload and returns an object. Throws if the content type does not contain `application/json`.

Note: You can also pass a string in place of the `options` object as a shorthand for `{url: string, method: 'GET'}`.

#### `inject.isInjection(obj)`

Checks if given object `obj` is a *light-my-request* `Request` object.

#### Method chaining

There are following methods you can used as chaining:
- `delete`, `get`, `head`, `options`, `patch`, `post`, `put`, `trace`. They will set the HTTP request method and also the request URL.
- `body`, `headers`, `payload`, `query`. They can be used to set the request options object.

And finally you need to call `end`. It has the signature `function (callback)`.
If you invoke `end` without a callback function, the method will return a promise, thus you can:

```js
const chain = inject(dispatch).get('/')

try {
  const res = await chain.end()
  console.log(res.payload)
} catch (err) {
  // handle error
}

// or
chain.end()
  .then(res => {
    console.log(res.payload)
  })
  .catch(err => {
    // handle error
  })
```

By the way, you can also use promises without calling `end`!

```js
inject(dispatch)
  .get('/')
  .then(res => {
    console.log(res.payload)
  })
  .catch(err => {
    // handle error
  })
```

Note: The application would not respond multiple times. If you try to invoking any method after the application has responded, the application would throw an error.

## Acknowledgements
This project has been forked from [`hapi/shot`](https://github.com/hapijs/shot) because we wanted to support *Node ≥ v4* and not only *Node ≥ v8*.  
All the credits before the commit [00a2a82](https://github.com/fastify/light-my-request/commit/00a2a82eb773b765003b6085788cc3564cd08326) goes to the `hapi/shot` project [contributors](https://github.com/hapijs/shot/graphs/contributors).  
Since the commit [db8bced](https://github.com/fastify/light-my-request/commit/db8bced10b4367731688c8738621d42f39680efc) the project will be maintained by the Fastify team.

## License

Licensed under [BSD-3-Clause](./LICENSE).
