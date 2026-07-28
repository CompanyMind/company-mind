# CompanyMind — company website

The marketing site for CompanyMind: one platform that ingests everything a company knows and turns
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

## Languages

The site ships in **Uzbek, Russian and English**, and Uzbek is the default.

```
/            -> 307 /uz            (or the language in the NEXT_LOCALE cookie)
/pricing     -> 307 /uz/pricing
/ru/pricing                        served
```

| File | Owns |
|---|---|
| `i18n/config.ts` | The locale list, the default, the cookie, `localePath()`. Imported by `proxy.ts`, so it must never import copy. |
| `proxy.ts` | The redirect. Next 16 renamed `middleware.ts` to `proxy.ts`. |
| `app/[locale]/layout.tsx` | **The root layout.** It lives under the dynamic segment so `<html lang>` can be the visitor's language. |

Every page is prerendered in all three languages (`● SSG` in the build output) and carries a
canonical URL plus `hreflang` alternates for the other two. `/contact` is the one dynamic route,
because it reads `?sent=`.

**The 404 is always in Uzbek**, deliberately — a not-found component gets no params, and the only
ways to read the locale (`headers()`, a client hook) either cost the whole site its static
rendering or ship all three dictionaries to the browser. The reasoning is written out in
`app/[locale]/not-found.tsx`; read it before "fixing" this.

Adding a language: add it to `locales` in `i18n/config.ts`, add `content/<code>.ts`, register it in
`content/dictionaries.ts`. TypeScript will then list every string that is missing.

---

## Editing copy

**Every word of marketing copy lives in `content/` as typed objects.** No component inlines its own
strings, and no client component imports a dictionary — pages resolve one on the server and pass
the slice down as props, which is what keeps two of the three languages out of the JS bundle.

| File | Owns |
|---|---|
| `content/types.ts` | **The contract.** One `Dictionary` type; all three languages are annotated with it, so a missing or misspelled key is a compile error rather than a blank page in the language nobody on the team reads. |
| `content/uz.ts` | Every word of the site in Uzbek — the default locale |
| `content/ru.ts` | …in Russian |
| `content/en.ts` | …in English, and **the honesty rules** in its header |
| `content/routes.ts` | Internal paths, once. Not translated — labels are. |
| `content/brand.ts` | Name, domain, mailbox. Not translated. |

### The honesty rules are load-bearing

Read the header comment in `content/en.ts` before changing any claim, and apply it to all three
languages — the rules are about what may be *asserted*, so they survive translation unchanged.
CompanyMind is **pre-launch**: no customers, no revenue, **no certifications**. Therefore:

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
- **Prices are the one exception, added deliberately on 2026-07-27.** Individual ($15/mo) and Team
  ($1,300/mo, up to 100 people) carry published figures; Enterprise is quoted, and the page says
  why in one sentence rather than hiding behind "contact sales". The plans live once, in each
  dictionary's `pricing.plans`, and are rendered by both `/pricing` and the homepage scene — do not
  copy a price into a second place. Everything else above is unchanged and still binding: no SLAs,
  no uptime figures, no deployment durations.

These are not style preferences. A regulated buyer's procurement team verifies claims on day one,
and being caught inflating costs more than having nothing to inflate.

---

## Architecture

```
proxy.ts             locale redirect; runs before every route (Next 16's middleware.ts)
i18n/config.ts       locale list, default, cookie, localePath() — imports no copy
app/[locale]/        THE ROOT LAYOUT lives here: html/body/fonts, so <html lang> can vary
  (marketing)/       Nav + Footer chrome; the eight public pages
  not-found.tsx      404, outside the chrome, always in the default locale
app/api/waitlist/    one endpoint, NOT under [locale] — the locale rides in the body
components/          Nav, Footer, LocaleSwitcher, Telemetry, SwarmCanvas, LegalPage, …
components/scenes/   one file per homepage beat (Hero, Problem, Turn, Ask, …, Pricing, CTA)
lib/swarm/           the canvas engine — see below
lib/metadata.ts      canonical + hreflang + the complete OpenGraph block per page
hooks/               useReducedMotion, useScrolled
content/             all copy, one file per language + the Dictionary contract
styles/tokens.css    design tokens — the single source of truth for color
```

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind 3 · GSAP + ScrollTrigger ·
Lenis · `next/font` (self-hosted, no layout shift).

**Fonts:** Space Grotesk (display), Inter (body), IBM Plex Mono (telemetry) — plus **Manrope**,
which exists solely because Space Grotesk has no Cyrillic. It sits *behind* Space Grotesk in the
display stack, so the browser falls through glyph by glyph: Russian headlines get Manrope, Latin
stays Space Grotesk everywhere, and the Cyrillic file is never downloaded on the other two locales.
Do not reorder that stack.

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

**Every tall homepage section must BE a scene.** `activeScene()` picks the section straddling the
viewport centre and falls back to `'hero'` when none does, so a plain `<section>` dropped between
two scenes snaps the whole composition back to the opening frame for as long as it is on screen.
Adding one means three lines: the id in `lib/swarm/types.ts`, an entry in `SCENES` and in `prog`,
and a `brainCfg` case. That is why Pricing is a scene.

**The telemetry rail yields to content.** It is fixed in the bottom-right, which is empty in most
scenes (features runs five cards in a three-column grid). Where a scene fills that corner it sets
`data-hides-telemetry` and the rail fades out — see `components/Telemetry.tsx`.

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
- The canvas is `aria-hidden` decoration; the story it tells is available as text (`home.canvasAlt`
  in each dictionary — translated, like everything else). The animation is never the only way to
  receive the message.
- Headlines decode visually, but the real text is always in the DOM for assistive tech and crawlers.
- `<html lang>` is the visitor's actual language, which is why the root layout sits under
  `[locale]`. A screen reader switches pronunciation on it.
- The language switcher is three real links, not a `<select>`: it works before hydration, opens in
  a new tab on middle-click, and points at the *same page* in the other language.
- WCAG AA throughout; semantic landmarks; visible focus rings; a skip link.
