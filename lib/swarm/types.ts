/** The eight things a company's knowledge actually arrives as. */
export type ArtifactKind = 'chat' | 'doc' | 'image' | 'audio' | 'pdf' | 'email' | 'sheet' | 'slack'

/** One beat of the scroll screenplay. */
export type SceneId =
  'hero' | 'problem' | 'turn' | 'ask' | 'sovereign' | 'features' | 'proof' | 'cta'

/**
 * A single drifting object. POOLED — allocated once at init and mutated in
 * place forever after. Never construct one of these inside the frame loop.
 */
export interface Artifact {
  kind: ArtifactKind
  variant: number

  x: number
  y: number
  vx: number
  vy: number

  rot: number
  vrot: number

  /** Where physics is currently pulling it. */
  tx: number
  ty: number
  trot: number

  scale: number
  opacity: number

  /** Stable per-artifact randomness. Same every frame, so drift is deterministic. */
  seed: number

  /**
   * A SECOND, INDEPENDENT random. Not derived from `seed`.
   * Deriving the Y placement from the X seed (e.g. `(seed * 7.13) % 1`) makes Y
   * a deterministic function of X, which strings every artifact along a handful
   * of diagonal lines — measurably ~30% tighter packed than a true scatter, and
   * visibly banded. A mess must actually be a mess.
   */
  seedB: number

  /** Revealed on hover: "Q3_report_final_v4.pdf". */
  label: string

  /** Slot in the resolved lattice. -1 until assigned. */
  node: number

  /** Greyed out and sinking — the knowledge that left with the person who had it. */
  lost: boolean

  /** Index of the artifact this one duplicates, or -1. Duplicates merge in scene 3. */
  dupOf: number

  /** 0..1 — how merged-away this duplicate is. */
  merge: number

  /** 0..1 — hover label reveal. */
  hover: number
}

/** Live system state, read by the telemetry rail. Never invented. */
export interface Telemetry {
  indexed: number
  total: number
  cited: number
  queries: number
  /** Always 0. It is not a setting; there is no outbound path. */
  egress: 0
  scene: SceneId
}

/** A DOM rect the swarm should assemble into (scene 6 feature cards). */
export interface Slot {
  x: number
  y: number
  w: number
  h: number
}

export interface SwarmOpts {
  /** Artifact count. ~70 desktop, ~28 mobile. */
  count: number
  reducedMotion: boolean
  /** Drop shadows and grain on weak hardware. */
  lowPower: boolean
}
