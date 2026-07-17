# CompBrain — company website

The marketing site for CompBrain: one platform that ingests everything a company knows and turns
it into a single brain you can ask, running entirely inside your own infrastructure, where every
answer traces back to its source.

Built for **regulated enterprises** — banks, healthcare, legal, defense — where on-prem is a
compliance requirement rather than a preference.

---

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run build        # production build + typecheck
npm start            # serve the build
npx eslint .         # lint
npx prettier -w .    # format
```

Deploys to **Vercel with zero config**. Set one environment variable before launch — see below.

---

## ⚠️ Before you launch

Three things need a decision from a human. They are marked in the code and listed here so they
cannot be missed.

**1. Set `WAITLIST_WEBHOOK_URL`** (see `.env.example`)

Without it, `/api/waitlist` returns **503 in production — on purpose**. Design-partner enquiries
are the entire point of this site, and a route that logs a lead to stdout and replies *"Received.
We will be in touch shortly."* is lying: serverless stdout is not storage, and the enquiry is gone
at the next cold start. It fails closed instead, and the form shows a real mailto fallback so the
person still reaches you. Point the variable at any endpoint accepting a JSON POST — a Zapier or
Make catch hook, a Slack incoming webhook, a CRM intake, your own server.

**2. Confirm two claims on `/security`.** They are architecturally plausible for on-prem but were
not in the brief, so they were introduced rather than given. If either is not true today, soften it
in `content/security.ts` — do not leave it:
  - *"Data at rest is encrypted with keys you hold and rotate"* (your KMS/HSM)
  - Air-gap updates ship as a *"signed artifact"*

**3. Get `/privacy` and `/terms` reviewed by a lawyer.** They are honest, plainly-worded stubs
describing what is actually true for a pre-launch marketing site. They are not legal advice, and
they are marked in-file as needing review.

---

## Editing copy

**Every word of marketing copy lives in `content/` as typed objects.** No component inlines its own
strings, so copy can be rewritten without touching a single component.

| File | Owns |
|---|---|
| `content/site.ts` | Homepage (all 8 scenes), nav, footer, canvas alt text, **the honesty rules** |
| `content/product.ts` | `/product` |
| `content/security.ts` | `/security` |
| `content/pricing.ts` | `/pricing` |
| `content/about.ts` | `/about` |
| `content/contact.ts` | `/contact` + the form |
| `content/legal.ts` | `/privacy`, `/terms` |

### The honesty rules are load-bearing

Read the header comment in `content/site.ts` before changing any claim. CompBrain is **pre-launch**:
no customers, no revenue, **no certifications**. Therefore:

- **Never** claim SOC 2 / HIPAA / ISO 27001 / FedRAMP, or render badge-shaped graphics implying
  certification. Frameworks appear only as obligations the *customer* has, which the deployment
  model helps *them* meet.
- **Never** invent customer counts, logos, testimonials, or named people with bios.
- Trust claims are verifiable, never absolute: *"every answer cited to its source"* ✓ /
  *"100% accurate"* ✗.
- Security claims are architectural, never absolute: *"your data never leaves your infrastructure"* ✓ /
  *"unhackable"* ✗.
- Every number in PROOF is true **by construction** — it follows from how the system is built, not
  from traction. Do not add latency or accuracy figures; they are unverifiable until there is a real
  deployment.

These are not style preferences. A regulated buyer's procurement team verifies claims on day one,
and being caught inflating costs more than having nothing to inflate.

---

## Architecture

```
app/                 routes; layout.tsx owns fonts + Nav/Footer; page.tsx is the scrollytelling home
components/          Nav, Footer, Telemetry, SwarmCanvas, DecodeText, MagneticButton, StaticBrain
components/scenes/   one file per homepage beat (Hero, Problem, Turn, Ask, Sovereign, …)
lib/swarm/           the canvas engine — see below
hooks/               useReducedMotion, useScrolled
content/             all copy
styles/tokens.css    design tokens — the single source of truth for color
```

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind 3 · GSAP + ScrollTrigger ·
Lenis · `next/font` (self-hosted, no layout shift).

> Next.js 16 has real breaking changes (e.g. `middleware` → `proxy.ts`). Read
> `node_modules/next/dist/docs/` before writing framework code rather than working from memory.

### The swarm

```
lib/swarm/artifacts.ts   8 artifact kinds; each prerendered ONCE to an offscreen sprite
lib/swarm/engine.ts      boids + spring-to-target + wall collision; pooled; one rAF loop
lib/swarm/scenes.ts      pure geometry — scroll position in, target positions out
lib/swarm/tokens.ts      reads CSS vars → canvas colors, so canvas and CSS cannot drift apart
```

**One fixed full-viewport canvas sits behind the entire homepage** — not one per section. The
artifacts must persist across scenes: the email buried in scene 2 is the same object ingested in
scene 3 and assembled into a feature card in scene 6. That continuity *is* the story.

Scroll drives a plain mutable `{scene, progress}` object read by the frame loop — **never React
state**, which would re-render 60×/sec.

**Performance contract** (violations are bugs, not preferences):
- Zero allocation inside the frame loop. Artifacts are pooled and mutated in place.
- Cards are never path-drawn per frame — only blitted from the sprite atlas.
- `getComputedStyle` / `getBoundingClientRect` are init/resize only.
- The loop stops dead when the canvas is offscreen or the tab is hidden.
- Caps: 70 desktop / 44 low-power / 28 mobile.

**Exactly one scene may be active at a time.** ScrollTriggers use `top center` → `bottom center`, so
each section owns the viewport centre-line and hands off cleanly to the next. The intuitive ranges
(`top bottom` → `bottom top`) keep three scenes live simultaneously, all writing `setScene` every
frame — last writer wins and the engine thrashes.

### Tuning the scenes

`lib/swarm/scenes.ts` → `fieldFor()` holds the physics blend per scene: `chaos` (boids weight),
`order` (spring-to-target weight), `k` (stiffness), `damp`, `lean` (cursor attraction). Scene 3 is
the money shot — if it feels rushed, lengthen the pin in `components/SwarmCanvas.tsx`
(`end: '+=150%'`); do not speed up the ingestion.

---

## Design system

Tokens live in `styles/tokens.css` and surface through `tailwind.config.ts`, so Tailwind classes and
canvas code read the same values.

### The contrast law

Verified with real WCAG relative-luminance math, not eyeballed. **The accent inks cannot carry body
text on this paper:**

| Token | on `--paper` | Allowed use |
|---|---|---|
| `--ink` | 14.89 | any text |
| `--ink-soft` | 5.57 | body / secondary text |
| `--brain` | 3.66 | **lines and shapes only** |
| `--query` | 2.57 | **graphics only — never text** |
| `--sovereign` | 4.02 | graphics + large display only |

For accent-colored **text**, use the darkened variants — `text-brain-text`, `text-query-text`,
`text-sovereign-text` — which pass AA on all three paper surfaces.

`--line` (1.45 on paper-raised) is for **decorative rules only**. Form controls must use
`--line-control` (4.04): WCAG SC 1.4.11 requires ≥3:1 for the boundary identifying a UI component.

**`--sovereign` is rare.** Reserved for the perimeter pulse and the final CTA. It carries the
sovereignty idea; it never decorates.

**Mono is for telemetry, file names, and labels only** — never body copy.

---

## Accessibility

- `prefers-reduced-motion` freezes the swarm into one resolved static composition — the brain
  assembled inside the perimeter. No rAF, no scrub, no scramble. Verified pixel-identical across
  900ms.
- The canvas is `aria-hidden` decoration; the story it tells is available as text (`canvasAlt` in
  `content/site.ts`). The animation is never the only way to receive the message.
- Headlines decode visually, but the real text is always in the DOM for assistive tech and crawlers.
- WCAG AA throughout; semantic landmarks; visible focus rings; a skip link.
