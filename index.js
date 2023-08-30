'use strict'

const Request = require('./lib/request')
const Response = require('./lib/response')
const Chain = require('./lib/Chain')
const doInject = require('./lib/doInject')

function inject (dispatchFunc, options, callback) {
  if (typeof callback === 'undefined') {
    return new Chain(dispatchFunc, options)
  } else {
    return doInject(dispatchFunc, options, callback)
  }
}

function isInjection (obj) {
  return (
    obj instanceof Request ||
    obj instanceof Response ||
    (obj && obj.constructor && obj.constructor.name === '_CustomLMRRequest')
  )
}

module.exports = inject
module.exports.default = inject
module.exports.inject = inject
module.exports.isInjection = isInjection
