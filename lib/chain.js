'use strict'

const doInject = require('./do-inject')

const errorMessage = 'The dispatch function has already been invoked'

class Chain {
  _hasInvoked = false
  _promise = null
  option
  dispatch

  constructor (dispatch, option) {
    this.dispatch = dispatch
    if (typeof option === 'string') {
      this.option = { url: option }
    } else {
      this.option = Object.assign({}, option)
    }

    if (this.option.autoStart !== false) {
      process.nextTick(() => {
        if (!this._hasInvoked) {
          this.end()
        }
      })
    }
  }

  /**
   * @private
   * @param {string} method
   * @param {string} url
   */
  wrapHttpMethod (method, url) {
    if (this._hasInvoked === true || this._promise) {
      throw new Error(errorMessage)
    }
    this.option.url = url
    this.option.method = method.toUpperCase()
    return this
  }

  delete (url) { return this.wrapHttpMethod('delete', url) }
  get (url) { return this.wrapHttpMethod('get', url) }
  head (url) { return this.wrapHttpMethod('head', url) }
  options (url) { return this.wrapHttpMethod('options', url) }
  patch (url) { return this.wrapHttpMethod('patch', url) }
  post (url) { return this.wrapHttpMethod('post', url) }
  put (url) { return this.wrapHttpMethod('put', url) }
  trace (url) { return this.wrapHttpMethod('trace', url) }

  /**
   * @private
   * @param {string} method
   * @param {string} url
   */
  wrapChainMethod (method, value) {
    if (this._hasInvoked === true || this._promise) {
      throw new Error(errorMessage)
    }
    this.option[method] = value
    return this
  }

  body (url) { return this.wrapChainMethod('body', url) }
  cookies (url) { return this.wrapChainMethod('cookies', url) }
  headers (url) { return this.wrapChainMethod('headers', url) }
  payload (url) { return this.wrapChainMethod('payload', url) }
  query (url) { return this.wrapChainMethod('query', url) }

  end (callback) {
    if (this._hasInvoked === true || this._promise) {
      throw new Error(errorMessage)
    }
    this._hasInvoked = true
    if (typeof callback === 'function') {
      doInject(this.dispatch, this.option, callback)
    } else {
      this._promise = doInject(this.dispatch, this.option)
      return this._promise
    }
  }

  /**
   * @private
   * @template {keyof Promise} T
   * @param {T} method
   * @param  {Parameters<Promise[T]>} args
   */
  promisify (method, args) {
    if (!this._promise) {
      if (this._hasInvoked === true) {
        throw new Error(errorMessage)
      }
      this._hasInvoked = true
      this._promise = doInject(this.dispatch, this.option)
    }
    return this._promise[method](...args)
  }

  then (...args) { return this.promisify('then', args) }
  catch (...args) { return this.promisify('catch', args) }
  finally (...args) { return this.promisify('finally', args) }
}

module.exports = Chain
