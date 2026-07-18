# CompanyMind

An on-premise knowledge platform for regulated enterprises. Ingest everything a company
knows, index it on self-hosted models, and ask it in plain language — every answer traced
back to its source, with nothing ever leaving your infrastructure.

## The system is three deployables

Each is independent on purpose. The boundary between them is **domain**, not language —
see `docs/superpowers/specs/2026-07-18-rearchitecture-domain-vs-delivery-design.md`.

| Deployable | Path | What it is | Ships to |
|---|---|---|---|
| **Product** | `web/` | The auth-gated app: sign in → upload → ask → cited answer. Next.js BFF + UI. Port **3000**. | The customer's datacenter (on-prem / air-gapped) |
| **Knowledge engine** | `engine/` | The domain service: parse, chunk, embed, permission-aware retrieval, answering, Telegram bot. FastAPI. Owns the knowledge DB. Never internet-exposed. | The customer's datacenter |
| **Marketing site** | `marketing/` | The public website. Stateless, no DB, no secrets. Port **3001**. | A public CDN/edge host — **never** a customer datacenter |

`web/` and `marketing/` share no code at runtime. The marketing site is deliberately a
separate app so the product image that ships into a regulated environment contains zero
public-facing code. Marketing has its own README at `marketing/README.md`.

## Run it locally

```bash
cp .env.example .env          # fill in secrets
docker compose up db -d       # Postgres + pgvector

# Product (web) — port 3000
cd web && npm install && npm run db:migrate && npm run seed && npm run dev

# Knowledge engine — no host port; reached by web over the compose network
docker compose up engine bot -d

# Marketing (optional, independent) — port 3001
cd marketing && npm install && npm run dev
```

Or build everything as containers:

```bash
docker compose build          # db, engine, bot, web, marketing
docker compose up -d
```

## Architecture direction

This repo is mid-migration from a language-drawn service boundary (TS vs Python) to a
domain-drawn one. The target and the ordered migration steps are specified in
`docs/superpowers/specs/2026-07-18-rearchitecture-domain-vs-delivery-design.md`; step
plans live in `docs/superpowers/plans/`.

- **Step 0 — split marketing out** into its own deployable. ✅ done.
- **Step 1 — the knowledge engine owns the single access rule** (kill the duplicated
  permission logic).
- **Step 2 — web stops touching knowledge tables** (becomes a pure BFF; split the shared
  Postgres into an auth DB and a knowledge DB).
- **Step 3 — Telegram becomes an API client** (one ask path for every surface).
- **Step 4 — hardening** (engine connection pool, single `EMBED_DIM`, engine migrations).

## Repos of record

Product code (`web/`, `engine/`) is the deliverable. `marketing/` is the public site.
`docs/` holds the specs and plans. `reference/` is a kept-local design reference (the
original site comp), not part of any build.
