# CompanyMind

On-premise knowledge platform for regulated enterprises. Ingest everything a company
knows, index it on self-hosted models, and ask it in plain language — every answer cited
to its source, nothing ever leaving your infrastructure.

## Three deployables

| Path | What it is | Port | Ships to |
|---|---|---|---|
| `web/` | Auth-gated product: sign in → upload → ask → cited answer. Next.js BFF + UI. | 3000 | Customer datacenter (on-prem) |
| `engine/` | Knowledge service: parse, embed, permission-aware retrieval, answering, Telegram bot. FastAPI. | internal | Customer datacenter |
| `marketing/` | Public website. Stateless, no DB, no secrets. | 3001 | Public CDN — **never** on-prem |

## Run it

```bash
cp .env.example .env                 # fill in secrets
docker compose up db -d              # Postgres + pgvector
cd web && npm install && npm run db:migrate && npm run seed && npm run dev
docker compose up engine bot -d      # knowledge engine + Telegram worker
```

Or containerize everything: `docker compose build && docker compose up -d`.

## Architecture

Mid-migration to a **domain-drawn** service boundary (knowledge vs auth), not a
language-drawn one. Full spec + steps:
`docs/superpowers/specs/2026-07-18-rearchitecture-domain-vs-delivery-design.md`.

- **Step 0** — split marketing into its own deployable. ✅
- **Step 1** — engine owns the single access rule (kill duplicated permission logic).
- **Step 2** — web stops touching knowledge tables; split Postgres into auth + knowledge DBs.
- **Step 3** — Telegram becomes an API client (one ask path for every surface).
- **Step 4** — hardening (engine connection pool, single `EMBED_DIM`, engine migrations).

`docs/` holds specs and plans. `reference/` is a kept-local design comp, not part of any build.
