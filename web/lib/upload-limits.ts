export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

/**
 * Cheap pre-parse guard. `req.formData()` buffers the entire body into memory, so
 * a declared Content-Length over the limit must be rejected BEFORE parsing.
 * Content-Length can lie, so this is a fast path, not the authority — the real
 * `file.size` check after parsing stays.
 */
export function exceedsUploadLimit(contentLength: string | null): boolean {
  if (!contentLength) return false
  const n = Number(contentLength)
  if (!Number.isFinite(n)) return false
  return n > MAX_UPLOAD_BYTES
}
