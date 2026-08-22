# Cookies

`options.cookies` is encoded onto the `Cookie` request header. If that header is already set, the encoded cookies are appended.

It accepts:

- an object of `name: value` strings (sent on every path, same as `Path=/`)
- an object of `name: { value, path?, ... }` records
- an array of cookie objects, such as a previous response's `res.cookies`

> [!NOTE]
> When a cookie includes `path`, it is sent only if that path matches the request URL as specified in [RFC 6265 §5.1.4](https://datatracker.ietf.org/doc/html/rfc6265#section-5.1.4) related to HTTP State Management Mechanism.
>
> Cookies without `path` are treated as `Path=/`.

```js
await inject(dispatch, { url: '/anywhere', cookies: { session: 'abc' } })

await inject(dispatch, {
  url: '/account/other',
  cookies: {
    session: 'ok',
    scoped: { value: 'uid-cookie', path: '/account/123' }
  }
})
// Cookie: session=ok

const login = await inject(dispatch, { url: '/login' })
await inject(dispatch, { url: '/account/other', cookies: login.cookies })
```

`res.cookies` parses the `Set-Cookie` response header into an array of cookie objects, including `path` and other attributes.
