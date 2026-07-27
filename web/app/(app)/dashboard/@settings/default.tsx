/**
 * The @settings slot renders nothing unless the Settings route is intercepted
 * into it. Without this file every route under /dashboard 404s on a hard
 * navigation — Next requires a default for a parallel slot that the current URL
 * does not match.
 */
export default function SettingsSlotDefault() {
  return null
}
