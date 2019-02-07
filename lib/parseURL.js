'use strict'

const { URL } = require('url')

const BASE_URL = 'http://localhost'

/**
 * Parse URL
 *
 * @param {(Object|String)} url
 * @param {Object} [query]
 * @return {URL}
 */
module.exports = function parseURL (url, query) {
  const result = typeof url === 'object'
    ? Object.assign(new URL(BASE_URL), url)
    : new URL(url, BASE_URL)

  const merged = Object.assign({}, url.query, query)
  Object.keys(merged).forEach(key => {
    const value = merged[key]

    if (Array.isArray(value)) {
      result.searchParams.delete(key)
      value.forEach(param => {
        result.searchParams.append(key, param)
      })
    } else {
      result.searchParams.set(key, value)
    }
  })

  return result
}
