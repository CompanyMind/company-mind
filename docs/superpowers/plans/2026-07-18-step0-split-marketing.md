# Step 0 — Split Marketing Into Its Own Deployable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the public marketing site out of `web/` into a separate `marketing/` Next app so the product deployable contains zero marketing code and never ships to a customer datacenter.

**Architecture:** `web/` becomes the auth-gated product only. A new sibling Next app `marketing/` holds the public site (home, pricing, product, security, legal, contact, waitlist). The two apps share nothing at runtime; brand tokens (`tokens.css`, fonts) are duplicated by copy, which is correct for two independent deployables (extract a shared package only if it ever causes real drift — YAGNI now).

**Tech Stack:** Next 16 App Router, React 19, Tailwind v3, TypeScript. No new dependencies.

## Global Constraints

- Node/Next: Next `16.2.9`, React `19.2.4`, Tailwind `3.4.19` — copied verbatim from `web/package.json`.
- Brand name is **CompanyMind** (not CompBrain/CompanyBrain).
- No behavior change to either surface — this is a pure move. The marketing site renders identically; the product renders identically.
- `web/` after this step imports nothing from `@/components`, `@/content`, or `@/lib/swarm`.
- Verify with builds, not assumptions: both `web` and `marketing` must `next build` clean and `tsc --noEmit` clean.

---

### Task 1: Scaffold the `marketing/` app config

**Files:**
- Create: `marketing/package.json`, `marketing/next.config.ts`, `marketing/tsconfig.json`, `marketing/tailwind.config.ts`, `marketing/postcss.config.mjs`, `marketing/eslint.config.mjs`, `marketing/.prettierrc`, `marketing/.gitignore`, `marketing/.dockerignore`, `marketing/Dockerfile`

**Interfaces:**
- Produces: a buildable (empty-of-source) Next app rooted at `marketing/` with the same toolchain as `web/`.

- [ ] **Step 1: Copy the build config from web to marketing**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain
mkdir -p marketing
cp web/next.config.ts web/tsconfig.json web/tailwind.config.ts web/postcss.config.mjs \
   web/eslint.config.mjs web/.prettierrc web/.gitignore web/.dockerignore web/Dockerfile marketing/
```

- [ ] **Step 2: Write `marketing/package.json`**

Marketing needs only the deps it actually uses (no db/auth/argon2). Runtime deps used by marketing code: `clsx`, `tailwind-merge`, `lenis`, `next`, `react`, `react-dom`.

```json
{
  "name": "companymind-marketing",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev -p 3001",
    "build": "next build",
    "start": "next start -p 3001",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "clsx": "^2.1.1",
    "lenis": "^1.3.25",
    "next": "16.2.9",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "tailwind-merge": "^3.6.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "autoprefixer": "^10.5.4",
    "eslint": "^9",
    "eslint-config-next": "16.2.9",
    "postcss": "^8.5.19",
    "prettier": "^3.9.5",
    "prettier-plugin-tailwindcss": "^0.8.1",
    "tailwindcss": "^3.4.19",
    "typescript": "^5"
  }
}
```

- [ ] **Step 3: Point `marketing/Dockerfile` at port 3001**

In `marketing/Dockerfile`, change any `EXPOSE 3000` to `EXPOSE 3001` and any `-p 3000`/`PORT 3000` to `3001` so it does not collide with `web`. (Open the copied file, edit the port literals; leave the multi-stage build steps as-is.)

- [ ] **Step 4: Commit the scaffold**

```bash
git add marketing/
git commit -m "Scaffold marketing/ app (config only, no source yet)"
```

---

### Task 2: Move the marketing source into `marketing/`

**Files:**
- Move (git mv) into `marketing/`: `web/app/(marketing)/**`, `web/components/**`, `web/lib/swarm/**`, `web/lib/ticker.ts`, `web/lib/cn.ts`, `web/content/**`, `web/styles/**`, `web/app/globals.css`, `web/app/sitemap.ts`, `web/app/robots.ts`, `web/app/opengraph-image.tsx`, `web/app/icon.tsx`, `web/app/api/waitlist/**`
- Create: `marketing/app/layout.tsx` (moved from `web/app/layout.tsx`), `marketing/app/not-found.tsx` (copied), `marketing/app/globals.css`

**Interfaces:**
- Consumes: the scaffold from Task 1.
- Produces: `marketing/` containing the full public site; `web/` no longer contains any `(marketing)` route, `components/`, `content/`, or `lib/swarm`.

- [ ] **Step 1: Move the route group, components, swarm, content, styles**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain
mkdir -p marketing/app marketing/lib
git mv "web/app/(marketing)" "marketing/app/(marketing)"
git mv web/components marketing/components
git mv web/content marketing/content
git mv web/styles marketing/styles
git mv web/lib/swarm marketing/lib/swarm
git mv web/lib/ticker.ts marketing/lib/ticker.ts
git mv web/lib/cn.ts marketing/lib/cn.ts
git mv web/app/api/waitlist marketing/app/api/waitlist
git mv web/app/sitemap.ts marketing/app/sitemap.ts
git mv web/app/robots.ts marketing/app/robots.ts
git mv web/app/opengraph-image.tsx marketing/app/opengraph-image.tsx
git mv web/app/globals.css marketing/app/globals.css
```

- [ ] **Step 2: Move the root layout and icon into marketing (marketing keeps the full brand shell)**

`web` will get a fresh minimal root layout in Task 3; the current rich one (fonts + full SEO metadata + `content/site`) belongs to marketing.

```bash
git mv web/app/layout.tsx marketing/app/layout.tsx
git mv web/app/icon.tsx marketing/app/icon.tsx
cp web/app/not-found.tsx marketing/app/not-found.tsx
git add marketing/app/not-found.tsx
```

- [ ] **Step 3: Verify no import paths need rewriting**

All moved files reference each other via the `@/` alias, which resolves to the app root in both apps (tsconfig `paths` was copied). Confirm nothing in marketing points back into web:

Run:
```bash
cd /Users/dovud/Developer/personal/startup/compbrain
grep -rnE "from '(\.\./)*(web|@/lib/(db|auth|engine|chat|source|groups|documents|storage|telegram|csrf|env))" marketing/ || echo "CLEAN: no back-references into web"
```
Expected: `CLEAN: no back-references into web`

- [ ] **Step 4: Install marketing deps and build it**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain/marketing
npm install
npx tsc --noEmit
npm run build
```
Expected: `tsc` prints nothing (success); `next build` completes with the marketing routes listed (`/`, `/pricing`, `/product`, `/security`, `/about`, `/contact`, `/privacy`, `/terms`, `/api/waitlist`) and exits 0.

- [ ] **Step 5: Commit the move**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain
git add -A marketing web
git commit -m "Move marketing site into marketing/ app"
```

---

### Task 3: Slim the product `web/` and give it a minimal root shell

**Files:**
- Create: `web/app/layout.tsx` (new minimal root layout — no `content/site`, no marketing SEO)
- Create: `web/app/globals.css` (minimal — Tailwind layers + the tokens the product actually uses)
- Create: `web/styles/tokens.css` (copy of the brand tokens; product needs the palette/fonts vars)
- Verify: `web/app/not-found.tsx` still resolves (it has no marketing imports)

**Interfaces:**
- Consumes: the now-marketing-free `web/`.
- Produces: a product app that builds with no `@/components`/`@/content` dependency.

- [ ] **Step 1: Recreate the product brand tokens**

The product UI (Rail, AskChat, tokens like `bg-paper`, `text-ink`) needs the CSS custom properties. Copy them back for the product app:

```bash
cd /Users/dovud/Developer/personal/startup/compbrain
mkdir -p web/styles
cp marketing/styles/tokens.css web/styles/tokens.css
```

- [ ] **Step 2: Write `web/app/globals.css`**

```css
@import '../styles/tokens.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```
(If `marketing/app/globals.css` has additional product-relevant base rules, copy those lines too — inspect it first with `cat marketing/app/globals.css` and bring over anything the dashboard depends on, e.g. body/scrollbar defaults. Do not bring marketing-only animation keyframes.)

- [ ] **Step 3: Write the minimal `web/app/layout.tsx`**

```tsx
import type { Metadata, Viewport } from 'next'
import { Space_Grotesk, IBM_Plex_Mono, Inter } from 'next/font/google'
import './globals.css'

const display = Space_Grotesk({
  subsets: ['latin'],
  weight: ['500', '700'],
  display: 'swap',
  variable: '--font-display',
})
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  variable: '--font-mono',
})
const body = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-body' })

export const metadata: Metadata = {
  title: { default: 'CompanyMind', template: '%s — CompanyMind' },
  description: 'On-premise knowledge platform.',
  robots: { index: false, follow: false }, // the product is private, not for indexing
}

export const viewport: Viewport = {
  themeColor: '#F3EEE3',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${mono.variable} ${body.variable}`}>
      <body className="min-h-dvh bg-paper text-ink antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 4: Confirm `web/app/not-found.tsx` has no marketing imports**

Run: `grep -nE "@/(components|content|lib/swarm)" web/app/not-found.tsx || echo "CLEAN"`
Expected: `CLEAN`. If it imports marketing components, replace it with a minimal product 404 (a centered "Not found" link back to `/dashboard`).

- [ ] **Step 5: Confirm web no longer references marketing modules anywhere**

Run:
```bash
cd /Users/dovud/Developer/personal/startup/compbrain
grep -rnE "@/(components|content)/|@/lib/(swarm|cn|ticker)" web/ || echo "CLEAN: web has no marketing imports"
```
Expected: `CLEAN: web has no marketing imports`. Fix any hit before continuing.

- [ ] **Step 6: Remove marketing-only deps from `web/package.json`**

`web` no longer uses `lenis`, `clsx`, or `tailwind-merge` (those were marketing/`cn`/`SmoothScroll`). Confirm, then remove:

```bash
cd /Users/dovud/Developer/personal/startup/compbrain/web
grep -rnE "from 'lenis'|from 'clsx'|from 'tailwind-merge'" app lib || echo "none used"
```
If `none used`, delete those three lines from `web/package.json` `dependencies` and run `npm install`. If any ARE used, keep the ones that are.

- [ ] **Step 7: Typecheck and build the product**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain/web
npx tsc --noEmit
npm run build
```
Expected: `tsc` clean; `next build` lists only product routes (`/login`, `/logout`, `/dashboard`, `/dashboard/sources`, `/dashboard/access`, `/dashboard/integrations`, `/s/[chunkId]`, and the `/api/*` product routes) — NO `(marketing)` routes — and exits 0.

- [ ] **Step 8: Commit**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain
git add -A web
git commit -m "Slim web/ to the product: minimal root shell, drop marketing deps"
```

---

### Task 4: Wire both apps into docker-compose and update docs

**Files:**
- Modify: `docker-compose.yml` (add a `marketing` service; `web` unchanged except confirming it stays product-only)
- Modify: `README.md` (document the two apps and their ports)
- Modify: `.env.example` if it references marketing-only vars (none expected)

**Interfaces:**
- Consumes: buildable `web/` and `marketing/`.
- Produces: `docker compose build` succeeds for all services.

- [ ] **Step 1: Add the marketing service to `docker-compose.yml`**

Add after the `web` service (marketing needs no DB, no engine, no secrets):

```yaml
  marketing:
    build: ./marketing
    environment:
      NODE_ENV: production
    ports:
      - "3001:3001"
```

- [ ] **Step 2: Update README**

In `README.md`, replace any single-app description with the two-app layout: `web/` = auth-gated product (port 3000, ships on-prem), `marketing/` = public site (port 3001, ships to the CDN/public host, never to a customer datacenter), `engine/` = knowledge service. State that marketing is deliberately a separate deployable.

- [ ] **Step 3: Build all compose services**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain
docker compose build web marketing
```
Expected: both image builds succeed.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml README.md .env.example
git commit -m "Compose + docs: web (product) and marketing as separate deployables"
```

---

## Self-Review

- **Spec coverage:** Implements spec Step 0 ("Split marketing out"). The other faults (access rule, shared DB, Telegram) are later steps with their own plans — out of scope here by design.
- **Placeholder scan:** Config copies are explicit `cp` of real files (not placeholders); the two files written from scratch (`web/app/layout.tsx`, `web/app/globals.css`) show full content.
- **Type consistency:** `web` root layout keeps the same font CSS-var names (`--font-display/mono/body`) the product components already use; tokens.css is copied verbatim so class utilities (`bg-paper`, `text-ink`) still resolve.
- **Risk note:** the one judgment call is Task 3 Step 2/6 (which globals base rules and which of clsx/lenis/tailwind-merge the product still needs) — both are guarded by a `grep` check before deletion, so nothing is removed blind.
