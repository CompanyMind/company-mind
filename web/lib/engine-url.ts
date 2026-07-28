/**
 * Safe construction of engine URLs.
 *
 * Every knowledge-domain id web sends to the engine — chunk, document, folder,
 * group, topic, finding, Telegram link — arrives as a route parameter, and Next
 * hands route parameters over ALREADY URL-DECODED. Interpolating one straight
 * into a template literal is a path traversal into the internal API, because
 * both `new URL()` and `fetch()` normalise dot segments:
 *
 *     new URL('http://engine:8000/source/../usage/summary').href
 *     // -> 'http://engine:8000/usage/summary'
 *
 * That request still carries `x-engine-secret`, which authorises the entire
 * engine API — so an id of `../usage/summary` on the member-reachable
 * `/s/[chunkId]` page reached the platform-wide usage endpoint, and
 * `../documents?workspace_id=<other firm>` reached another firm's library.
 *
 * `seg()` is the fix and the whole of it: a path segment is a value, never
 * structure. Encoding turns `../x` into `..%2Fx`, which stays one segment and
 * 404s at the engine like any other unknown id. Use it for EVERY interpolated
 * segment; `enginePath` is the tagged-template form that makes forgetting hard.
 */

/** Percent-encode one path segment so it cannot introduce `/` or `..`. */
export function seg(value: string): string {
  return encodeURIComponent(value)
}

/**
 * Tagged template that encodes every interpolated value as a path segment:
 *
 *     enginePath`/source/${chunkId}`          // chunkId is encoded
 *     enginePath`/groups/${id}/members`       // id is encoded
 *
 * Query strings are appended by the caller (already built with
 * `URLSearchParams`, which encodes its own values).
 */
export function enginePath(parts: TemplateStringsArray, ...values: string[]): string {
  return parts.reduce((acc, part, i) => acc + part + (i < values.length ? seg(values[i]) : ''), '')
}
