/** The eight things a company's knowledge actually arrives as. */
export type ArtifactKind = 'chat' | 'doc' | 'image' | 'audio' | 'pdf' | 'email' | 'sheet' | 'slack'

/**
 * One beat of the scroll screenplay.
 *
 * EVERY tall section on the homepage must be in here and must carry a matching
 * `data-scene` attribute. `activeScene()` picks the section straddling the
 * viewport centre-line and falls back to 'hero' when none does — so a section
 * that is NOT a scene makes the composition snap back to the opening frame for
 * as long as it is on screen. That is why 'pricing' is a scene rather than an
 * ordinary section dropped between two of them.
 */
export type SceneId =
  'hero' | 'problem' | 'turn' | 'ask' | 'sovereign' | 'features' | 'proof' | 'pricing' | 'cta'

/**
 * Live system state, read by the telemetry rail. Never invented — every field
 * is derived from what the engine is actually doing this frame.
 */
export interface Telemetry {
  indexed: number
  total: number
  cited: number
  queries: number
  /** Always 0. It is not a setting; there is no outbound path. */
  egress: 0
  scene: SceneId
}
