# CompBrain — company website design spec

**Date:** 2026-07-17
**Status:** Approved
**Owner:** Dovud

---

## 1. Product truth (decided, do not invent beyond this)

| Fact | Value |
|---|---|
| Name | CompBrain |
| One-liner | One platform that ingests everything a company knows and turns it into a single brain you can ask. |
| Audience | **Regulated enterprises** — banks, healthcare, legal, defense. On-prem is a compliance requirement, not a preference. |
| Stage | **Pre-launch.** No customers. No certifications. No revenue. |
| Pricing | Named tiers, **no public prices**. |
| About | Mission + lab with **placeholder roles**. No named people. |
| Security posture | **Architecture as the argument.** No certification claims. |
| Primary CTA | **Design-partner recruitment**, not a generic waitlist. |

### Three pillars
1. **UNIFY** — every scattered file, image, chat, and email becomes one organized brain.
2. **SOVEREIGN** — fully on-prem. Data never leaves your infrastructure.
3. **TRUSTWORTHY** — answers grounded in your data; every claim cited and verifiable.

### Honesty constraints (hard rules)
These are not style preferences. Violating them loses a regulated buyer permanently.

- **NEVER** claim SOC 2, HIPAA, ISO 27001, FedRAMP, or any certification. CompBrain holds none.
- **NEVER** render badge-shaped graphics that imply certification.
- Frameworks may be named **only** as obligations the customer has, which the deployment model helps them meet. Never as something CompBrain has been audited against.
- **NEVER** invent customer counts, logos, testimonials, or named people.
- Trust claims are **verifiable, not absolute**: "every answer cited to its source" ✓ / "100% accurate" ✗.
- Security claims are **architectural, not absolute**: "your data never leaves your infrastructure" ✓ / "unhackable" ✗.
- PROOF metrics must be **true by construction** (see §6).

---

## 2. Copy — the spine

**Hero H1:** `Everything your company knows. Behind your own walls.`
**Hero sub:** One brain for every file, chat, image and call — deployed entirely inside your infrastructure.

Voice: confident, spare, cinematic. Short lines, active verbs. No buzzword soup. No em-dash-heavy corporate mush.

| Scene | Headline | Job |
|---|---|---|
| 1 Hero | Everything your company knows. Behind your own walls. | State product + differentiator |
| 2 Problem | Your company already knows the answer. Nobody can find it. | Name the pain |
| 3 The Turn | One brain. Everything in it. | Emotional peak — the money shot |
| 4 Ask | Ask anything. Trace every word back. | Trust |
| 5 Sovereign | Nothing leaves. Nothing foreign enters. | Security |
| 6 Features | Built for the companies that can't use the cloud. | Capability |
| 7 Proof | True by construction. | Honest numbers |
| 8 CTA | We're choosing a few design partners. | Convert |

---

## 3. Art direction (locked)

### Palette — "warm studio paper"
```
--paper:        #F3EEE3   warm cream — site background
--paper-raised: #FBF8F1   raised cards / surfaces
--paper-sunk:   #E8E1D2   insets, telemetry rail
--ink:          #1C1B18   warm near-black — primary text
--ink-soft:     #6B665C   warm gray — secondary text
--line:         #D8D0BE   hairline dividers
--brain:        #0F8A7E   deep teal — indexed/organized knowledge
--query:        #E07B39   burnt amber — a live question in motion
--sovereign:    #D8315B   crimson-rose — RARE. perimeter pulse + final CTA only.
```

### Contrast law (WCAG AA on `--paper`)
Accent colors are **graphics-only**. They may not carry body text.

| Token | Est. ratio | Allowed use |
|---|---|---|
| `--ink` | ~15:1 | Any text |
| `--ink-soft` | ~4.6:1 | Body/secondary text (passes, barely) |
| `--brain` | ~3.3:1 | **Lines, shapes, UI strokes only** |
| `--query` | ~2.2:1 | **Graphics only** |
| `--sovereign` | ~4.0:1 | **Graphics + large display text only** |

Darkened text-safe variants where an accent must read as text:
```
--brain-text:     #0A6B61
--sovereign-text: #B02348
```
**Action:** ratios above are estimates. Compute them for real during build and correct the tokens if any fail.

### Type
- **Display:** Space Grotesk 700 — massive scale, tight tracking. Headlines decode (scramble → resolve).
- **Mono:** IBM Plex Mono — telemetry, file names, labels **only**.
- **Body:** Inter.
- Self-host via `next/font`. No layout shift. No serifs anywhere.

### Surfaces
Soft, low, warm shadows — objects resting on paper. Never hard drop-shadows. Faint warm grain, desktop only.

---

## 4. The swarm — architecture

### The load-bearing decision
**ONE fixed full-viewport canvas behind the entire homepage.** Not one per section.

Artifacts must persist and flow *between* scenes — the email buried in scene 2 is the same object ingested in scene 3 and assembled into a card in scene 6. Per-section canvases would reset the swarm and destroy the story.

- Canvas: `position: fixed; inset: 0; z-index: 0`, `aria-hidden="true"`.
- Scene sections: transparent DOM at `z-index: 10`.
- Canvas is decorative; §8 defines its text equivalent.

### State flow
Scroll → GSAP ScrollTrigger → **plain mutable object** `{ scene, progress }` → read by RAF loop.

**Never React state for frame data.** That would re-render 60×/sec.

### Files
```
lib/swarm/
  engine.ts     boids + spring-to-target + wall collision; pooled; RAF
  artifacts.ts  8 kinds; each prerendered ONCE to an offscreen sprite
  scenes.ts     target-position solvers per scene
  tokens.ts     reads CSS vars → canvas colors (single source of truth)
```

### The perf contract (non-negotiable)
- Each artifact kind is drawn **once** to an offscreen canvas at DPR, **shadow baked in**, then blitted via `drawImage` + rotation.
- **Zero per-frame allocation.** Pool artifacts, reuse arrays, no object literals in the loop.
- Cap: **70 desktop / 28 mobile**.
- Pause RAF via IntersectionObserver when offscreen; destroy on unmount.
- Target 60fps. Low-power: fewer artifacts, simpler shadows, no grain.

### Artifact kinds (all 8 recognizable at a glance)
| Kind | Rendering |
|---|---|
| `chat` | White rounded bubble, Telegram-blue tail, one line, timestamp, double ticks |
| `doc` | Docs-style page card, colored corner, ruled lines |
| `image` | Photo thumb, rounded, mountain glyph, tinted |
| `audio` | Pill, play triangle, waveform |
| `pdf` | White card, red "PDF" tab |
| `email` | Envelope/inbox row, sender + subject |
| `sheet` | Green-accented grid |
| `slack` | Bubble, avatar dot, text |

~28–44px rounded cards, soft warm paper-shadow. **App-authentic but generic** — evocative, never exact copies of third-party marks.

### Engine API
```ts
class SwarmEngine {
  constructor(canvas: HTMLCanvasElement, opts: SwarmOpts)
  setScene(id: SceneId, progress: number): void
  setPointer(x: number, y: number): void
  start(): void
  stop(): void
  resize(): void
  destroy(): void
  getTelemetry(): Telemetry   // { indexed, cited, queries, egress: 0 }
}
```

### Physics per frame
1. Resolve target from `scenes.ts` given `(scene, progress)`.
2. Blend `chaosWeight × boids` + `orderWeight × spring(target)` — weights are per-scene.
3. Wall collision at perimeter — always on, always bounces inward.
4. Subtle pointer lean.

---

## 5. Scroll screenplay

| # | Scene | Swarm behavior | Scroll |
|---|---|---|---|
| 1 | **Hero** | Perimeter draws first. Chaotic storm: scattered, tilted, some duplicated/faded. | Trigger |
| 2 | **Problem** | Chaos intensifies. Duplicates multiply, an email sinks and is buried, a doc grays out and vanishes, a search returns nothing. | Scrub |
| 3 | **The Turn** | Every artifact flows inward and is ingested. Duplicates merge. Lattice assembles. Perimeter pulses `--sovereign` once. | **PIN 150vh + scrub** |
| 4 | **Ask** | `--query` packet enters. Answer draws live citation lines back to specific source artifacts. `[1][2][3]` markers connect to nodes. | Pin + hold 60vh |
| 5 | **Sovereign** | Hostile packet from OUTSIDE repelled at the wall. Internal data drifts to edge, bounces back. | Scrub |
| 6 | **Features** | Artifacts fly into card formation → **DOM cards fade in at settle**. | Trigger per card |
| 7 | **Proof** | Settle. Numbers count up. | Scrub |
| 8 | **CTA** | Converge into one calm secured core. Slow `--sovereign` heartbeat. Brain watches cursor. | Trigger |

**Scene 3 is the money shot.** If it feels rushed, lengthen the pin — do not speed up the ingestion.
**Scene 4:** citation lines must be the strongest thing on screen.

### Deviation from brief — scene 6 canvas→DOM handoff
Particles assemble the card on canvas; **real DOM cards fade in at settle and own the text.**
Rationale: canvas-drawn cards would be invisible to screen readers, unselectable, unsearchable. Canvas owns the assembly moment; DOM owns content. Effect preserved, no a11y hole.

---

## 6. Features & PROOF

### Five features
1. **Ingest everything** — files, chats, images, audio, email, spreadsheets.
2. **Cited answers** — every clause traces to source; open the original.
3. **Permission-aware** — honors existing access control. People only get answers from what they were already cleared to see. *For a regulated buyer this is the objection that kills every other vendor.*
4. **Air-gap capable** — runs with no internet route at all.
5. **Audit trail** — every question, answer, and source logged in your systems.

### PROOF — true by construction
Pre-launch. No traction numbers. These count up and are **architecturally true**:

| Number | Claim | Why it's true |
|---|---|---|
| `0 bytes` | data egress | Nothing calls out. Architectural constant. |
| `12` | source formats ingested | Count of implemented ingest adapters. |
| `100%` | of answers carry a source citation | Answers are constructed from retrieved spans. |
| `1` | deployment — yours | Single-tenant by design. |

**Do not** add latency/accuracy numbers. They are unverifiable pre-launch.

---

## 7. Site structure

| Route | Content |
|---|---|
| `/` | The scrollytelling home |
| `/product` | Deeper on Unify / Ask / cited answers |
| `/security` | Architecture as the argument — data flow, perimeter, air-gap topology, "your controls apply" |
| `/pricing` | **Pilot** (one team, guided onboarding) · **Deployment** (company-wide, your VPC, SSO + permission sync, audit export) · **Sovereign** (air-gapped, your hardware, dedicated support). All → contact. |
| `/about` | Mission + lab, placeholder roles |
| `/contact` | Design-partner form + company paragraph |
| `/privacy`, `/terms` | Stubs |
| `404` | Themed |

Secondary pages reuse the design system and echo a **calm static** brain motif (`StaticBrain.tsx`). They do not run the scroll engine.

---

## 8. Accessibility

- `prefers-reduced-motion`: freeze into **one resolved static composition** — brain assembled inside the perimeter. No RAF, no scrub, no scramble. A real composition, not a blank box.
- Canvas `aria-hidden`, with a visually-hidden text equivalent narrating the story it tells.
- Semantic landmarks, keyboard-focusable interactives, visible focus rings, alt text.
- WCAG AA contrast per §3 contrast law.
- Mobile-first responsive; swarm scales down and never breaks layout.

---

## 9. Stack

Matching sibling project `zynar` for consistency.

- **Next.js 16.2.9** (App Router) · **React 19.2.4** · **TypeScript strict** · **Tailwind 3.4** (tokens in `tailwind.config.ts`)
- **GSAP + ScrollTrigger** · **Lenis** (synced to ScrollTrigger)
- `next/font` self-hosting Space Grotesk, IBM Plex Mono, Inter
- SEO: per-page `metadata`, OG image, favicon, `sitemap.ts`, `robots.ts`
- Form → `/api/waitlist` placeholder; degrades gracefully
- **No `localStorage` / `sessionStorage`. No secrets.**

> ⚠️ Next.js 16 has real breaking changes (e.g. `middleware` → `proxy.ts`).
> **Read `node_modules/next/dist/docs/` before writing framework code.** Do not write Next 16 from memory.

### Quality gates
TypeScript strict clean · ESLint + Prettier clean · no console errors · `npm run build` green · deploys to Vercel zero-config · README covering run/build/deploy/where-to-edit-copy.

---

## 10. Anti-patterns

- No generic SaaS hero (centered headline + gradient blob + two buttons + logo strip).
- No abstract particles — **every particle is a recognizable artifact.**
- No dark neon theme. No glow-on-black language ported onto the paper. Light = the rare `--query` and `--sovereign` pulse only.
- No cream + terracotta serif. No broadsheet hairlines.
- No autoplaying video or audio. No cookie-banner clutter.
- No fake testimonials, no fake logos, no fake certifications.
- **Motion must mean something.** If an animation doesn't advance the story, cut it.

---

## 11. Where to edit copy later

All marketing copy lives in `content/` as typed objects — not inlined in JSX — so it can be changed without touching components. Pricing tiers, features, PROOF numbers, and nav live in single named exports. README documents this.
