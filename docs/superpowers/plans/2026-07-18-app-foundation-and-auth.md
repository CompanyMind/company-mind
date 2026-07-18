# App Foundation & Auth — Implementation Plan (Plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the repo into `web/` + `engine/` behind docker-compose (Postgres/pgvector + a FastAPI engine skeleton), and ship sovereign email+password auth so a seeded beta user can log into a workspace-scoped dashboard.

**Architecture:** Split services — `web` (Next.js/TS) owns the browser, auth, and workspace data; `engine` (FastAPI/Python) is a skeleton here (only `/health`), fleshed out in Plans 2–3. Both share one Postgres+pgvector. Auth is hand-rolled and sovereign: argon2id password hashing, opaque session tokens stored **hashed** in the DB, an HttpOnly/Secure/SameSite=Lax cookie. Session *presence* is checked in middleware for redirect UX; real session validation happens in the authed layout (Node runtime, DB-backed).

**Tech Stack:** Next.js 16.2.9, React 19.2.4, TypeScript (strict), Tailwind v3.4; Drizzle ORM + drizzle-kit + `postgres` (postgres.js); `@node-rs/argon2`; FastAPI + uvicorn (uv-managed); Postgres 16 + pgvector; Docker Compose.

This is **Plan 1 of 3**. Plan 2 = Dataset Upload & Ingestion. Plan 3 = Ask & Citations. This plan produces working, testable software on its own (login works, health green).

## Global Constraints

Copied verbatim from `docs/superpowers/specs/2026-07-18-compbrain-app-core-loop-design.md`. Every task inherits these.

- **Stack floors:** Next.js `16.2.9`, React `19.2.4`, TS strict, Tailwind `^3.4`. Do not upgrade majors.
- **Split layout:** `web/` (Next.js) + `engine/` (FastAPI) + root `docker-compose.yml`. The reference folder `CompBrain Company Website/` and `docs/` stay at repo root, outside `web/`.
- **Engine is never internet-exposed.** Only `web` publishes a host port. `web`→`engine` calls carry `ENGINE_INTERNAL_SECRET`; engine authorizes nothing from a browser.
- **Tenant isolation in the query:** every content/identity read is scoped by `workspace_id` (or `user_id`) in the SQL predicate, never only at the app layer.
- **Sovereign:** no third-party auth, analytics, model, or vector service. No `NEXT_PUBLIC_*` secret ever.
- **Secrets:** read from env at runtime; never committed. `.env.example` documents every var name with empty values.
- **Auth specifics:** argon2id hashing; opaque session token, only its hash stored; cookie HttpOnly + Secure + SameSite=Lax; login rate-limited; **accounts created by seed script only — no public sign-up route exists.**
- **Brand:** reuse the marketing tokens (`--paper`, `--paper-raised`, `--ink`, `--ink-soft`, `--line`, `--brain`, `--query`); do not fork the palette. The dashboard is calmer/more utilitarian than the poster site.
- **Datastore:** one Postgres with the `vector` extension enabled (used in Plan 2; enabled here).

---

## File Structure (what this plan creates or moves)

**Moved (Task 1):** the entire existing Next.js app (`app/`, `components/`, `content/`, `hooks/`, `lib/`, `styles/`, `public` assets, `hero.png`, `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`, `.prettierrc`, `eslint.config.mjs`, `next-env.d.ts`) → under `web/`.

**Created:**
- `docker-compose.yml`, `.env.example` (root)
- `engine/` — `pyproject.toml`, `Dockerfile`, `app/main.py`, `app/health.py`, `app/settings.py`, `tests/test_health.py`, `.dockerignore`
- `web/Dockerfile`, `web/.dockerignore`
- `web/drizzle.config.ts`
- `web/lib/db/client.ts` — postgres.js + Drizzle client
- `web/lib/db/schema.ts` — `users`, `workspaces`, `memberships`, `sessions`
- `web/lib/auth/password.ts` — argon2id hash/verify
- `web/lib/auth/session.ts` — token gen/hash, create/validate/revoke session, cookie helpers
- `web/lib/auth/current-user.ts` — server helper: resolve session → { user, workspace }
- `web/lib/auth/rate-limit.ts` — in-memory login throttle
- `web/lib/env.ts` — server-only env access + validation
- `web/app/(app)/layout.tsx` — authed shell (validates session server-side)
- `web/app/(app)/dashboard/page.tsx` — placeholder authed page (proves login)
- `web/app/login/page.tsx`, `web/app/login/actions.ts` — login form + server action
- `web/app/logout/route.ts` — logout
- `web/middleware.ts` — cookie-presence redirect guard
- `web/scripts/seed.ts` — create beta user + workspace + membership
- `web/lib/auth/__tests__/password.test.ts`, `web/lib/auth/__tests__/session.test.ts`
- `web/vitest.config.ts`
- Test tooling deps added to `web/package.json`

---

## Task 1: Restructure repo into `web/`

**Files:**
- Move: all Next.js app files (listed above) → `web/`
- Modify: `web/eslint.config.mjs` (drop the now-outside reference-folder ignore)
- Modify: root `.gitignore` (paths for `web/`)

**Interfaces:**
- Produces: a Next.js app rooted at `web/` that builds and runs exactly as before, with the marketing site intact.

- [ ] **Step 1: Create `web/` and move the app with git (preserves history)**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain
mkdir -p web
git mv app components content hooks lib styles \
       package.json package-lock.json tsconfig.json next.config.ts \
       tailwind.config.ts postcss.config.mjs .prettierrc eslint.config.mjs \
       next-env.d.ts hero.png web/
# node_modules and .next are gitignored; move them too so dev keeps working:
[ -d node_modules ] && mv node_modules web/ || true
[ -d .next ] && mv .next web/ || true
[ -f tsconfig.tsbuildinfo ] && mv tsconfig.tsbuildinfo web/ || true
```

- [ ] **Step 2: Fix `web/eslint.config.mjs`** — the reference folder now lives *outside* `web/`, so its ignore entry is dead. Remove just that entry, keep the rest.

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
```

- [ ] **Step 3: Update root `.gitignore`** so the ignored build artifacts resolve under `web/`. Replace the `next.js`, `dependencies`, and `typescript` sections' bare paths with `web/`-prefixed ones; keep the reference-folder and `.DS_Store`/`.env*` rules.

```gitignore
# dependencies
/web/node_modules
/node_modules

# next.js
/web/.next/
/web/out/

# production
/web/build

# misc
.DS_Store
*.pem

# env files
.env*

# vercel
.vercel

# typescript
*.tsbuildinfo
web/next-env.d.ts

# test artifacts
.playwright-mcp/

# reference implementation (kept locally, not part of the build)
"CompBrain Company Website"/
```

- [ ] **Step 4: Verify the site still builds and runs from `web/`**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain/web && npm run build
```
Expected: build succeeds (same as before the move); no missing-module errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain
git add -A
git commit -m "Restructure: move Next.js app into web/ for split web+engine layout"
```

---

## Task 2: Root docker-compose + env scaffolding

**Files:**
- Create: `docker-compose.yml`, `.env.example` (root)
- Create: `web/Dockerfile`, `web/.dockerignore`

**Interfaces:**
- Produces: `db` (postgres+pgvector) reachable on the compose network as host `db:5432`; service names `web`, `engine`, `db`. Env var names other tasks rely on: `DATABASE_URL`, `SESSION_SECRET`, `ENGINE_INTERNAL_SECRET`, `ENGINE_BASE_URL`, `MODELS_BASE_URL`, `EMBED_MODEL`, `LLM_MODEL`.

- [ ] **Step 1: Create root `.env.example`** (documents every var; empty values)

```bash
# Copy to .env for docker-compose. NEVER commit .env.
# --- Postgres ---
POSTGRES_USER=compbrain
POSTGRES_PASSWORD=
POSTGRES_DB=compbrain
# DATABASE_URL is consumed by web (Drizzle) and engine. Host is the compose service name.
DATABASE_URL=postgres://compbrain:@db:5432/compbrain
# --- Auth (web) ---
# 32+ random bytes, base64. Signs/derives session material. Rotating it logs everyone out.
SESSION_SECRET=
# --- web <-> engine trust ---
# Shared secret on every web->engine call. Engine rejects calls without it.
ENGINE_INTERNAL_SECRET=
ENGINE_BASE_URL=http://engine:8000
# --- engine -> models (self-hosted, OpenAI-compatible) ---
MODELS_BASE_URL=
EMBED_MODEL=
LLM_MODEL=
```

- [ ] **Step 2: Create `web/.dockerignore`**

```
node_modules
.next
npm-debug.log
Dockerfile
.dockerignore
```

- [ ] **Step 3: Create `web/Dockerfile`** (standalone Next build)

```dockerfile
FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 4: Enable standalone output** in `web/next.config.ts` (needed by the Dockerfile). Add `output: 'standalone'` to the config object; leave the rest unchanged.

- [ ] **Step 5: Create root `docker-compose.yml`**

```yaml
services:
  db:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: ${POSTGRES_DB}
    volumes:
      - dbdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 5s
      timeout: 3s
      retries: 10

  engine:
    build: ./engine
    environment:
      DATABASE_URL: ${DATABASE_URL}
      ENGINE_INTERNAL_SECRET: ${ENGINE_INTERNAL_SECRET}
      MODELS_BASE_URL: ${MODELS_BASE_URL}
      EMBED_MODEL: ${EMBED_MODEL}
      LLM_MODEL: ${LLM_MODEL}
    depends_on:
      db:
        condition: service_healthy
    # No ports: engine is never internet-exposed.

  web:
    build: ./web
    environment:
      DATABASE_URL: ${DATABASE_URL}
      SESSION_SECRET: ${SESSION_SECRET}
      ENGINE_INTERNAL_SECRET: ${ENGINE_INTERNAL_SECRET}
      ENGINE_BASE_URL: ${ENGINE_BASE_URL}
      NODE_ENV: production
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "3000:3000"

volumes:
  dbdata:
```

- [ ] **Step 6: Verify db starts and pgvector is available**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain
cp .env.example .env
# fill POSTGRES_PASSWORD + DATABASE_URL password inline for local dev, e.g. "devpass"
docker compose up -d db
sleep 5
docker compose exec db psql -U compbrain -d compbrain -c "CREATE EXTENSION IF NOT EXISTS vector; SELECT extname FROM pg_extension WHERE extname='vector';"
```
Expected: prints `vector` in the result — extension installs cleanly on the image.

- [ ] **Step 7: Commit**

```bash
git add docker-compose.yml .env.example web/Dockerfile web/.dockerignore web/next.config.ts
git commit -m "Add docker-compose (postgres+pgvector, web, engine) and env scaffolding"
```

---

## Task 3: Engine skeleton (FastAPI + /health)

**Files:**
- Create: `engine/pyproject.toml`, `engine/Dockerfile`, `engine/.dockerignore`
- Create: `engine/app/__init__.py`, `engine/app/settings.py`, `engine/app/health.py`, `engine/app/main.py`
- Test: `engine/tests/test_health.py`

**Interfaces:**
- Produces: `GET /health` → `{"status": "ok", "db": bool, "models": bool}`; FastAPI app object `app.main:app`; settings object reading `DATABASE_URL`, `ENGINE_INTERNAL_SECRET`, `MODELS_BASE_URL`, `EMBED_MODEL`, `LLM_MODEL`.

- [ ] **Step 1: Write the failing test** `engine/tests/test_health.py`

```python
from fastapi.testclient import TestClient
from app.main import app

def test_health_ok():
    client = TestClient(app)
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert "db" in body and "models" in body
```

- [ ] **Step 2: Create `engine/pyproject.toml`**

```toml
[project]
name = "compbrain-engine"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
  "fastapi>=0.115",
  "uvicorn[standard]>=0.32",
  "httpx>=0.27",
  "psycopg[binary]>=3.2",
  "pydantic-settings>=2.5",
]

[dependency-groups]
dev = ["pytest>=8.3"]

[tool.pytest.ini_options]
pythonpath = ["."]
```

- [ ] **Step 3: Create `engine/app/__init__.py`** (empty) and `engine/app/settings.py`

```python
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")
    database_url: str = ""
    engine_internal_secret: str = ""
    models_base_url: str = ""
    embed_model: str = ""
    llm_model: str = ""

settings = Settings()
```

- [ ] **Step 4: Create `engine/app/health.py`**

```python
import httpx
import psycopg
from .settings import settings

def db_ok() -> bool:
    if not settings.database_url:
        return False
    try:
        with psycopg.connect(settings.database_url, connect_timeout=3) as conn:
            conn.execute("SELECT 1")
        return True
    except Exception:
        return False

def models_ok() -> bool:
    if not settings.models_base_url:
        return False
    try:
        r = httpx.get(f"{settings.models_base_url}/models", timeout=3)
        return r.status_code < 500
    except Exception:
        return False
```

- [ ] **Step 5: Create `engine/app/main.py`**

```python
from fastapi import FastAPI
from .health import db_ok, models_ok

app = FastAPI(title="CompBrain Engine")

@app.get("/health")
def health():
    return {"status": "ok", "db": db_ok(), "models": models_ok()}
```

- [ ] **Step 6: Run the test**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain/engine
uv run pytest tests/test_health.py -v
```
Expected: PASS (`db`/`models` are `false` with no env set, but the route returns 200 with the right shape).

- [ ] **Step 7: Create `engine/.dockerignore`**

```
.venv
__pycache__
*.pyc
tests
```

- [ ] **Step 8: Create `engine/Dockerfile`**

```dockerfile
FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml ./
RUN uv sync --no-dev
COPY app ./app
EXPOSE 8000
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 9: Verify the engine builds and answers under compose**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain
docker compose up -d --build engine db
sleep 5
docker compose exec engine python -c "from fastapi.testclient import TestClient; from app.main import app; print(TestClient(app).get('/health').json())"
```
Expected: prints a dict with `status: ok`.

- [ ] **Step 10: Commit**

```bash
git add engine
git commit -m "Engine skeleton: FastAPI app with /health, Dockerfile, uv project"
```

---

## Task 4: Web DB layer (Drizzle schema + migration)

**Files:**
- Modify: `web/package.json` (add deps + scripts)
- Create: `web/lib/env.ts`, `web/drizzle.config.ts`, `web/lib/db/client.ts`, `web/lib/db/schema.ts`

**Interfaces:**
- Produces:
  - `web/lib/db/schema.ts` exports Drizzle tables `users`, `workspaces`, `memberships`, `sessions` with columns per spec §6.
  - `web/lib/db/client.ts` exports `db` (Drizzle instance) and `sql` (postgres.js client).
  - `web/lib/env.ts` exports `env` with validated `DATABASE_URL`, `SESSION_SECRET`, `ENGINE_INTERNAL_SECRET`, `ENGINE_BASE_URL`.

- [ ] **Step 1: Add deps and scripts to `web/package.json`**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain/web
npm i drizzle-orm postgres @node-rs/argon2
npm i -D drizzle-kit tsx vitest
npm pkg set scripts.db:generate="drizzle-kit generate"
npm pkg set scripts.db:migrate="drizzle-kit migrate"
npm pkg set scripts.seed="tsx scripts/seed.ts"
npm pkg set scripts.test="vitest run"
```

- [ ] **Step 2: Create `web/lib/env.ts`** (server-only; fail fast on missing secrets)

```ts
import 'server-only'

function required(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing required env var: ${name}`)
  return v
}

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  SESSION_SECRET: required('SESSION_SECRET'),
  ENGINE_INTERNAL_SECRET: process.env.ENGINE_INTERNAL_SECRET ?? '',
  ENGINE_BASE_URL: process.env.ENGINE_BASE_URL ?? '',
}
```

- [ ] **Step 3: Create `web/lib/db/schema.ts`**

```ts
import { pgTable, uuid, text, timestamp, integer, primaryKey, index } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const workspaces = pgTable('workspaces', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const memberships = pgTable(
  'memberships',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'), // 'owner' | 'member'
  },
  (t) => [primaryKey({ columns: [t.userId, t.workspaceId] })],
)

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tokenHash: text('token_hash').notNull().unique(), // sha256(token), never the token
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
)
```

- [ ] **Step 4: Create `web/lib/db/client.ts`**

```ts
import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/lib/env'
import * as schema from './schema'

export const sql = postgres(env.DATABASE_URL, { max: 10 })
export const db = drizzle(sql, { schema })
```

- [ ] **Step 5: Create `web/drizzle.config.ts`**

```ts
import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './lib/db/schema.ts',
  out: './lib/db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
```

- [ ] **Step 6: Generate the migration and add a pgvector-enable migration**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain/web
npm run db:generate
# Prepend a pgvector-enable statement so Plan 2 can add vector columns later:
printf 'CREATE EXTENSION IF NOT EXISTS vector;\n' > lib/db/migrations/0000_enable_vector.sql
```
Expected: a `0001_*.sql` (or similar) migration file is created under `lib/db/migrations/` containing the four tables.

- [ ] **Step 7: Apply migrations against the running db and verify tables**

```bash
# From host, point at the exposed db (add "5432:5432" temporarily to compose db ports, or run inside):
DATABASE_URL="postgres://compbrain:devpass@localhost:5432/compbrain" npm run db:migrate
docker compose exec db psql -U compbrain -d compbrain -c "\dt"
```
Expected: lists `users`, `workspaces`, `memberships`, `sessions`.

- [ ] **Step 8: Commit**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain
git add web/package.json web/package-lock.json web/lib web/drizzle.config.ts
git commit -m "Web DB layer: Drizzle schema (users/workspaces/memberships/sessions) + pgvector migration"
```

---

## Task 5: Password + session library (TDD)

**Files:**
- Create: `web/vitest.config.ts`
- Create: `web/lib/auth/password.ts`, `web/lib/auth/session.ts`
- Test: `web/lib/auth/__tests__/password.test.ts`, `web/lib/auth/__tests__/session.test.ts`

**Interfaces:**
- Produces:
  - `password.ts`: `hashPassword(plain: string): Promise<string>`, `verifyPassword(hash: string, plain: string): Promise<boolean>`.
  - `session.ts`: `generateToken(): string`, `hashToken(token: string): string` (sha256 hex), `SESSION_TTL_MS: number`, `SESSION_COOKIE: string`, `cookieOptions(expires: Date)`.
- Consumes: nothing from other tasks (pure logic).

- [ ] **Step 1: Create `web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node', include: ['lib/**/*.test.ts'] },
})
```

- [ ] **Step 2: Write failing test** `web/lib/auth/__tests__/password.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../password'

describe('password', () => {
  it('verifies a correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery staple')
    expect(hash).not.toContain('correct horse')
    expect(await verifyPassword(hash, 'correct horse battery staple')).toBe(true)
    expect(await verifyPassword(hash, 'wrong password')).toBe(false)
  })
})
```

- [ ] **Step 3: Run to verify it fails**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain/web && npx vitest run lib/auth/__tests__/password.test.ts
```
Expected: FAIL — cannot resolve `../password`.

- [ ] **Step 4: Implement `web/lib/auth/password.ts`**

```ts
import 'server-only'
import { hash, verify } from '@node-rs/argon2'

// argon2id defaults tuned for interactive login on a server CPU.
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTS)
}

export async function verifyPassword(hashed: string, plain: string): Promise<boolean> {
  try {
    return await verify(hashed, plain)
  } catch {
    return false
  }
}
```

- [ ] **Step 5: Run to verify it passes**

```bash
npx vitest run lib/auth/__tests__/password.test.ts
```
Expected: PASS.

- [ ] **Step 6: Write failing test** `web/lib/auth/__tests__/session.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { generateToken, hashToken, SESSION_TTL_MS, SESSION_COOKIE } from '../session'

describe('session tokens', () => {
  it('generates unguessable tokens and a stable hex hash', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).not.toEqual(b)
    expect(a.length).toBeGreaterThanOrEqual(32)
    const h = hashToken(a)
    expect(h).toMatch(/^[0-9a-f]{64}$/)
    expect(hashToken(a)).toEqual(h) // deterministic
    expect(h).not.toContain(a) // never store the raw token
  })
  it('has a positive TTL and a cookie name', () => {
    expect(SESSION_TTL_MS).toBeGreaterThan(0)
    expect(SESSION_COOKIE).toBeTruthy()
  })
})
```

- [ ] **Step 7: Run to verify it fails**

```bash
npx vitest run lib/auth/__tests__/session.test.ts
```
Expected: FAIL — cannot resolve `../session`.

- [ ] **Step 8: Implement `web/lib/auth/session.ts`** (pure crypto + cookie config; DB writes live in Task 6's helper)

```ts
import 'server-only'
import { randomBytes, createHash } from 'node:crypto'

export const SESSION_COOKIE = 'cb_session'
export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    expires,
  }
}
```

- [ ] **Step 9: Run to verify it passes**

```bash
npx vitest run lib/auth/__tests__/session.test.ts
```
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain
git add web/vitest.config.ts web/lib/auth web/package.json
git commit -m "Auth lib: argon2id password hash/verify + session token crypto (TDD)"
```

---

## Task 6: Session persistence + current-user resolver + rate limiter

**Files:**
- Create: `web/lib/auth/session-store.ts` (DB-backed create/validate/revoke)
- Create: `web/lib/auth/current-user.ts`
- Create: `web/lib/auth/rate-limit.ts`

**Interfaces:**
- Consumes: `db` + `schema` (Task 4); `generateToken`, `hashToken`, `SESSION_TTL_MS`, `SESSION_COOKIE`, `cookieOptions` (Task 5); `verifyPassword` (Task 5).
- Produces:
  - `session-store.ts`: `createSession(userId: string, meta?: {userAgent?: string; ip?: string}): Promise<{token: string; expires: Date}>`, `validateSessionToken(token: string): Promise<{ user: User; workspace: Workspace } | null>`, `revokeSessionToken(token: string): Promise<void>`.
  - `current-user.ts`: `getCurrentUser(): Promise<{ user: User; workspace: Workspace } | null>` (reads the cookie via `next/headers`).
  - `rate-limit.ts`: `checkLoginRate(key: string): { ok: boolean; retryAfterMs: number }`.
  - Exported types `User`, `Workspace` (inferred from schema `$inferSelect`).

- [ ] **Step 1: Create `web/lib/auth/session-store.ts`**

```ts
import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { sessions, users, workspaces, memberships } from '@/lib/db/schema'
import { generateToken, hashToken, SESSION_TTL_MS } from './session'

export type User = typeof users.$inferSelect
export type Workspace = typeof workspaces.$inferSelect

export async function createSession(
  userId: string,
  meta: { userAgent?: string; ip?: string } = {},
): Promise<{ token: string; expires: Date }> {
  const token = generateToken()
  const expires = new Date(Date.now() + SESSION_TTL_MS)
  await db.insert(sessions).values({
    tokenHash: hashToken(token),
    userId,
    expiresAt: expires,
    userAgent: meta.userAgent ?? null,
    ip: meta.ip ?? null,
  })
  return { token, expires }
}

export async function validateSessionToken(
  token: string,
): Promise<{ user: User; workspace: Workspace } | null> {
  const row = await db.query.sessions.findFirst({
    where: eq(sessions.tokenHash, hashToken(token)),
  })
  if (!row) return null
  if (row.expiresAt.getTime() < Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, row.id))
    return null
  }
  const user = await db.query.users.findFirst({ where: eq(users.id, row.userId) })
  if (!user) return null
  // v1: one workspace per user via their first membership.
  const membership = await db.query.memberships.findFirst({
    where: eq(memberships.userId, user.id),
  })
  if (!membership) return null
  const workspace = await db.query.workspaces.findFirst({
    where: eq(workspaces.id, membership.workspaceId),
  })
  if (!workspace) return null
  return { user, workspace }
}

export async function revokeSessionToken(token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)))
}
```

- [ ] **Step 2: Create `web/lib/auth/current-user.ts`**

```ts
import 'server-only'
import { cookies } from 'next/headers'
import { SESSION_COOKIE } from './session'
import { validateSessionToken, type User, type Workspace } from './session-store'

export async function getCurrentUser(): Promise<{ user: User; workspace: Workspace } | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null
  return validateSessionToken(token)
}
```

- [ ] **Step 3: Create `web/lib/auth/rate-limit.ts`** (in-memory; sufficient for single-instance beta, swappable later)

```ts
import 'server-only'

const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 10
const hits = new Map<string, number[]>()

export function checkLoginRate(key: string): { ok: boolean; retryAfterMs: number } {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(key, recent)
  if (recent.length > MAX_ATTEMPTS) {
    return { ok: false, retryAfterMs: WINDOW_MS - (now - recent[0]) }
  }
  return { ok: true, retryAfterMs: 0 }
}
```

- [ ] **Step 4: Typecheck**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain/web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain
git add web/lib/auth
git commit -m "Session persistence, current-user resolver, and login rate limiter"
```

---

## Task 7: Login page, server action, logout, middleware, authed layout

**Files:**
- Create: `web/app/login/page.tsx`, `web/app/login/actions.ts`
- Create: `web/app/logout/route.ts`
- Create: `web/middleware.ts`
- Create: `web/app/(app)/layout.tsx`, `web/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `getCurrentUser` (Task 6), `createSession`/`revokeSessionToken` (Task 6), `verifyPassword` (Task 5), `checkLoginRate` (Task 6), `SESSION_COOKIE`/`cookieOptions` (Task 5), `db`+`schema` (Task 4).
- Produces: a protected route group `(app)` that redirects to `/login` when unauthenticated and renders the user's workspace when authenticated.

- [ ] **Step 1: Create the login server action** `web/app/login/actions.ts`

```ts
'use server'

import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { users } from '@/lib/db/schema'
import { verifyPassword } from '@/lib/auth/password'
import { createSession } from '@/lib/auth/session-store'
import { checkLoginRate } from '@/lib/auth/rate-limit'
import { SESSION_COOKIE, cookieOptions } from '@/lib/auth/session'

export async function login(_prev: unknown, formData: FormData): Promise<{ error: string } | void> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const password = String(formData.get('password') ?? '')
  const h = await headers()
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'

  const rate = checkLoginRate(`${ip}:${email}`)
  if (!rate.ok) return { error: 'Too many attempts. Try again later.' }
  if (!email || !password) return { error: 'Email and password are required.' }

  const user = await db.query.users.findFirst({ where: eq(users.email, email) })
  // Always run a verify to keep timing uniform whether or not the user exists.
  const ok = user ? await verifyPassword(user.passwordHash, password) : await verifyPassword('$argon2id$v=19$m=19456,t=2,p=1$c29tZXNhbHQ$0000000000000000000000000000000000000000000', password)
  if (!user || !ok) return { error: 'Invalid email or password.' }

  const { token, expires } = await createSession(user.id, {
    userAgent: h.get('user-agent') ?? undefined,
    ip,
  })
  ;(await cookies()).set(SESSION_COOKIE, token, cookieOptions(expires))
  redirect('/dashboard')
}
```

- [ ] **Step 2: Create the login page** `web/app/login/page.tsx` (brand tokens; if already authed, bounce to dashboard)

```tsx
'use client'

import { useActionState } from 'react'
import { login } from './actions'

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined)
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6">
      <form action={action} className="w-full max-w-sm rounded-lg bg-paper-raised p-8 shadow-card">
        <h1 className="font-display text-2xl text-ink">Sign in to CompBrain</h1>
        <p className="mt-1 text-body-sm text-ink-soft">Closed beta — invite only.</p>
        <label className="mt-6 block text-body-sm text-ink-soft" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required
          className="mt-1 w-full rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink" />
        <label className="mt-4 block text-body-sm text-ink-soft" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required
          className="mt-1 w-full rounded-md border border-line-control bg-paper px-3 py-2 text-body text-ink" />
        {state?.error && <p className="mt-3 text-body-sm text-sovereign-text">{state.error}</p>}
        <button type="submit" disabled={pending}
          className="mt-6 w-full rounded-md bg-ink px-4 py-2 text-body text-paper disabled:opacity-60">
          {pending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Create logout** `web/app/logout/route.ts`

```ts
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/session'
import { revokeSessionToken } from '@/lib/auth/session-store'

export async function POST(request: Request) {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (token) await revokeSessionToken(token)
  jar.delete(SESSION_COOKIE)
  return NextResponse.redirect(new URL('/login', request.url), 303)
}
```

- [ ] **Step 4: Create presence-check middleware** `web/middleware.ts` (cheap redirect UX; real validation in the layout)

```ts
import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth/session'

export function middleware(req: NextRequest) {
  const hasCookie = req.cookies.has(SESSION_COOKIE)
  if (!hasCookie) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }
  return NextResponse.next()
}

export const config = { matcher: ['/dashboard/:path*'] }
```

- [ ] **Step 5: Create the authed layout** `web/app/(app)/layout.tsx` (DB-backed validation, Node runtime)

```tsx
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = await getCurrentUser()
  if (!auth) redirect('/login')
  return (
    <div className="min-h-dvh bg-paper">
      <header className="flex items-center justify-between border-b border-line px-6 py-3">
        <span className="font-display text-ink">CompBrain</span>
        <div className="flex items-center gap-4 text-body-sm text-ink-soft">
          <span>{auth.workspace.name}</span>
          <form action="/logout" method="post"><button className="underline">Sign out</button></form>
        </div>
      </header>
      <div className="p-6">{children}</div>
    </div>
  )
}
```

- [ ] **Step 6: Create the placeholder authed page** `web/app/(app)/dashboard/page.tsx`

```tsx
import { getCurrentUser } from '@/lib/auth/current-user'

export const runtime = 'nodejs'

export default async function Dashboard() {
  const auth = await getCurrentUser()
  return (
    <div>
      <h1 className="font-display text-3xl text-ink">Welcome{auth?.user.name ? `, ${auth.user.name}` : ''}.</h1>
      <p className="mt-2 text-body text-ink-soft">
        Workspace <strong className="text-ink">{auth?.workspace.name}</strong>. Upload and ask arrive in Plan 2–3.
      </p>
    </div>
  )
}
```

- [ ] **Step 7: Typecheck + build**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain/web && npx tsc --noEmit && npm run build
```
Expected: no type errors; build succeeds.

- [ ] **Step 8: Commit**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain
git add web/app web/middleware.ts
git commit -m "Login/logout, presence middleware, DB-validated authed layout + dashboard"
```

---

## Task 8: Seed script + full-loop verification

**Files:**
- Create: `web/scripts/seed.ts`

**Interfaces:**
- Consumes: `db`+`schema` (Task 4), `hashPassword` (Task 5).
- Produces: a runnable seed that creates one beta user, one workspace, and an owner membership from env (`SEED_EMAIL`, `SEED_PASSWORD`, `SEED_NAME`, `SEED_WORKSPACE`).

- [ ] **Step 1: Create `web/scripts/seed.ts`**

```ts
import 'dotenv/config'
import { eq } from 'drizzle-orm'
import { db, sql } from '@/lib/db/client'
import { users, workspaces, memberships } from '@/lib/db/schema'
import { hashPassword } from '@/lib/auth/password'

async function main() {
  const email = (process.env.SEED_EMAIL ?? '').trim().toLowerCase()
  const password = process.env.SEED_PASSWORD ?? ''
  const name = process.env.SEED_NAME ?? null
  const wsName = process.env.SEED_WORKSPACE ?? 'My Workspace'
  if (!email || !password) throw new Error('Set SEED_EMAIL and SEED_PASSWORD')

  const existing = await db.query.users.findFirst({ where: eq(users.email, email) })
  if (existing) {
    console.log(`User ${email} already exists — skipping.`)
    await sql.end()
    return
  }

  const [user] = await db.insert(users).values({ email, passwordHash: await hashPassword(password), name }).returning()
  const slug = wsName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'workspace'
  const [ws] = await db.insert(workspaces).values({ name: wsName, slug }).returning()
  await db.insert(memberships).values({ userId: user.id, workspaceId: ws.id, role: 'owner' })

  console.log(`Seeded ${email} → workspace "${wsName}".`)
  await sql.end()
}

main().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Run the seed against the running db**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain/web
DATABASE_URL="postgres://compbrain:devpass@localhost:5432/compbrain" \
SEED_EMAIL="dovud@compbrain.ai" SEED_PASSWORD="change-me-now" SEED_NAME="Dovud" SEED_WORKSPACE="CompBrain HQ" \
  npm run seed
```
Expected: prints `Seeded dovud@compbrain.ai → workspace "CompBrain HQ".`

- [ ] **Step 3: Verify the row exists**

```bash
docker compose exec db psql -U compbrain -d compbrain -c "SELECT u.email, w.name, m.role FROM users u JOIN memberships m ON m.user_id=u.id JOIN workspaces w ON w.id=m.workspace_id;"
```
Expected: one row — `dovud@compbrain.ai | CompBrain HQ | owner`.

- [ ] **Step 4: Manual end-to-end login check**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain/web
DATABASE_URL="postgres://compbrain:devpass@localhost:5432/compbrain" SESSION_SECRET="dev-secret" npm run dev
```
Then: open `http://localhost:3000/dashboard` → redirected to `/login`; sign in with the seeded credentials → lands on `/dashboard` showing "Welcome, Dovud." and workspace "CompBrain HQ"; "Sign out" returns to `/login`; revisiting `/dashboard` redirects to `/login` again.

- [ ] **Step 5: Run the auth unit tests once more**

```bash
npm run test
```
Expected: password + session tests PASS.

- [ ] **Step 6: Commit**

```bash
cd /Users/dovud/Developer/personal/startup/compbrain
git add web/scripts/seed.ts
git commit -m "Seed script for invite-only beta accounts; login loop verified end to end"
```

---

## Self-Review (against the spec)

**Spec coverage:**
- §5.1 services (web/engine/db, engine private) → Tasks 2, 3. ✓
- §6 identity tables (users/workspaces/memberships/sessions) → Task 4. ✓ (documents/chunks/chats/messages/citations are Plan 2–3.)
- §9 auth (argon2id, hashed opaque sessions, HttpOnly/Secure/SameSite=Lax cookie, CSRF via SameSite, login throttle, seed-only) → Tasks 5–8. ✓
- §10 web (authed segment, middleware redirect, brand tokens, BFF env server-only) → Tasks 4, 7. ✓ (engine proxy fleshed out in Plan 2.)
- §11 deploy (docker-compose, pgvector extension, secrets from env, `.env.example`) → Tasks 2, 4. ✓
- **CSRF note:** v1 relies on SameSite=Lax + POST-only state changes; a double-submit token is added in Plan 2 when cross-origin fetch flows appear. Recorded so it isn't lost.

**Placeholder scan:** no TBD/TODO; every code step shows full code. ✓
**Type consistency:** `User`/`Workspace` exported once from `session-store.ts` and reused; `SESSION_COOKIE`/`cookieOptions`/`hashToken` names identical across tasks. ✓

---

## Next plans (not built here)
- **Plan 2 — Dataset Upload & Ingestion:** documents/ingestion_jobs/chunks schema (+ `vector(D)`), file storage, upload UI with polling, engine parse→chunk→embed→store, web→engine proxy + internal-secret guard, CSRF double-submit.
- **Plan 3 — Ask & Citations:** engine retrieve→answer→citation-resolution, chats/messages/citations, ask UI with clickable source passages, retrieval eval.
