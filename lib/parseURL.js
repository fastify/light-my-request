'use strict'

const { URL } = require('url')

const BASE_URL = 'http://localhost:80'

/**
 * Create URL from `options` object
 *
 * @param {Object} options
 * @param {(Object|String)} options.url
 * @param {Object} [options.query]
 * @return {URL}
 */
module.exports = function parseURL (options) {
  let parsedURL = null
  let mergedQuery = {}

  if (typeof options.url === 'object') {
    parsedURL = new URL(BASE_URL)

    const { query, ...others } = options.url
    Object.keys(others).forEach(key => {
      parsedURL[key] = others[key]
    })

    Object.assign(mergedQuery, query)
  } else {
    parsedURL = new URL(options.url, BASE_URL)
  }

  Object.assign(mergedQuery, options.query)
  Object.keys(mergedQuery).forEach(key => {
    const value = mergedQuery[key]

    if (Array.isArray(value)) {
      parsedURL.searchParams.delete(key)
      value.forEach(param => {
        parsedURL.searchParams.append(key, param)
      })
    } else {
      parsedURL.searchParams.set(key, value)
    }
  })

  return parsedURL
}
