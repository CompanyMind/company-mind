/**
 * A `Content-Disposition: attachment` value that survives a real filename.
 *
 * Uploads here are routinely Uzbek and Russian ("Ички-қоидалар.pdf"), and a
 * header is not a JavaScript string: anything outside latin-1 either throws
 * when the response is constructed or arrives mangled. RFC 6266 answers this
 * with two parameters — a plain `filename` for old parsers and `filename*` in
 * RFC 5987 form, which every current browser prefers — so the name is emitted
 * twice, degraded and exact.
 */
export function contentDisposition(filename: string): string {
  // CR/LF would end the header and start another one; a quote or backslash
  // would end the quoted-string early. Neither can be allowed to originate in
  // an uploaded filename.
  const clean = filename.replace(/[\r\n"\\]/g, '').replace(/[\u0000-\u001f\u007f]/g, '')

  // The degraded copy: latin-1 parsers get ASCII or nothing. If a name is
  // entirely non-ASCII, stripping leaves an empty string — hence the fallback,
  // since `filename=""` reads to some browsers as "save as the URL's last
  // segment", which here would be the literal word "file".
  const ascii = clean.replace(/[^\x20-\x7e]/g, '').trim() || 'document'

  // encodeURIComponent leaves !'()* alone, which RFC 5987's attr-char does not
  // permit; percent-encode them too rather than emit a value a strict parser
  // may reject.
  const encoded = encodeURIComponent(clean).replace(
    /['()!*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  )

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`
}
