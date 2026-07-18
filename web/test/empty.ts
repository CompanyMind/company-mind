// Stub for `server-only` / `client-only` under vitest. Those packages throw by
// design when imported outside Next's server/client graphs; in unit tests we
// resolve them to this no-op so server-scoped modules can be exercised directly.
export {}
