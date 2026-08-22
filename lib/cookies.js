'use strict'

const { stringifySetCookie } = require('cookie')

/**
 * RFC 6265 §5.1.4 cookie-path matching.
 *
 * A cookie with no Path is treated as "/", matching every request path.
 *
 * @param {string | undefined} cookiePath
 * @param {string} requestPath
 * @return {boolean}
 */
function cookiePathMatches (cookiePath, requestPath) {
  const path = cookiePath || '/'
  if (requestPath === path) {
    return true
  }
  if (!requestPath.startsWith(path)) {
    return false
  }
  return path.endsWith('/') || requestPath.charAt(path.length) === '/'
}

/**
 * Normalize `options.cookies` to `{ name, value, path? }` records.
 *
 * @param {object | Array<object>} cookies
 * @return {Array<{ name: string, value: string, path?: string }>}
 */
function listCookies (cookies) {
  if (Array.isArray(cookies)) {
    return cookies
  }
  return Object.keys(cookies).map((name) => {
    const item = cookies[name]
    if (item !== null && typeof item === 'object') {
      return {
        name: item.name || name,
        value: item.value,
        path: item.path
      }
    }
    return { name, value: item }
  })
}

/**
 * Encode cookies for the request Cookie header, omitting those whose Path
 * does not match the request URL.
 *
 * @param {object | Array<object>} cookies
 * @param {string} requestPath
 * @return {string[]}
 */
function encodeCookies (cookies, requestPath) {
  return listCookies(cookies)
    .filter((item) => cookiePathMatches(item.path, requestPath))
    .map((item) => stringifySetCookie({ name: item.name, value: item.value }))
}

module.exports = {
  cookiePathMatches,
  encodeCookies,
  listCookies
}
