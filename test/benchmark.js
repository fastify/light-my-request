const http = require('http')

const Benchmark = require('benchmark')
const suite = new Benchmark.Suite()
const Request = require('../lib/request')
const parseURL = require('../lib/parseURL')

const mockReq = {
  url: 'http://localhost',
  method: 'GET',
  headers: {
    foo: 'bar',
    'content-type': 'html',
    accepts: 'json',
    authorization: 'granted'
  }
}
const mockCustomReq = {
  url: 'http://localhost',
  method: 'GET',
  headers: {
    foo: 'bar',
    'content-type': 'html',
    accepts: 'json',
    authorization: 'granted'
  },
  Request: http.IncomingMessage
}
const mockReqCookies = {
  url: 'http://localhost',
  method: 'GET',
  cookies: { foo: 'bar', grass: 'àìùòlé' },
  headers: {
    foo: 'bar',
    'content-type': 'html',
    accepts: 'json',
    authorization: 'granted'
  }
}
const mockReqCookiesPayload = {
  url: 'http://localhost',
  method: 'GET',
  headers: {
    foo: 'bar',
    'content-type': 'html',
    accepts: 'json',
    authorization: 'granted'
  },
  payload: {
    foo: { bar: 'fiz' },
    bim: { bar: { boom: 'paf' } }
  }
}

suite.add('Request', function () {
  new Request(mockReq)
})
  .add('Custom Request', function () {
    new Request.CustomRequest(mockCustomReq)
  })
  .add('Request With Cookies', function () {
    new Request(mockReqCookies)
  })
  .add('Request With Cookies n payload', function () {
    new Request(mockReqCookiesPayload)
  })
  .add('ParseUrl', function () {
    parseURL('http://example.com:8080/hello')
  })
  .add('ParseUrl and query', function () {
    parseURL('http://example.com:8080/hello', {
      foo: 'bar',
      message: 'OK',
      xs: ['foo', 'bar']
    })
  })
  .on('cycle', function (event) {
    console.log(String(event.target))
  })
  .on('complete', function () {
    console.log('Fastest is: ' + this.filter('fastest').map('name'))
  })
  .run()
