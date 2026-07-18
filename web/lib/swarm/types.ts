/** The eight things a company's knowledge actually arrives as. */
export type ArtifactKind = 'chat' | 'doc' | 'image' | 'audio' | 'pdf' | 'email' | 'sheet' | 'slack'

/** One beat of the scroll screenplay. */
export type SceneId =
  'hero' | 'problem' | 'turn' | 'ask' | 'sovereign' | 'features' | 'proof' | 'cta'

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
