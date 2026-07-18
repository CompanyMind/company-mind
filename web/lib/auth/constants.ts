// Edge-safe constants: no node:crypto, no server-only. Imported by both the
// Edge middleware (which must not pull in Node built-ins) and the Node-runtime
// auth modules. Keep this file free of any runtime-specific imports.
export const SESSION_COOKIE = 'cb_session'
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days
