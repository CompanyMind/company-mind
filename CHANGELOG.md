# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Engine connection **pool** (`psycopg-pool`) replaces connect-per-call across ask, ingest, and the bot worker. `/health` now reports `embed_dim` and an `embed_dim_ok` drift check (the DB's `vector(N)` column is the source of truth for embedding width).
- Brand logo — the "layered vault" mark (nested walls + violet `#684BFF` core).
  `public/logo.svg` (exact mark) in both apps, plus a theme-adaptive `app/icon.svg`
  favicon whose walls flip to paper on dark browser chrome so the mark never disappears.
  A teal `#0f8a7e` variant lives at `web/public/logo-teal.svg`.
- `marketing/` as a standalone Next app — the public site is now a separate deployable
  that never ships to a customer datacenter.
- Project `CLAUDE.md` and this `CHANGELOG.md`.
- Re-architecture spec: draw the service boundary on domain (knowledge vs auth), not
  language — `docs/superpowers/specs/2026-07-18-rearchitecture-domain-vs-delivery-design.md`.

### Changed
- **Web is now a BFF** (Step 2). `web/lib/{documents,groups,source,telegram}.ts` and the knowledge API routes call engine endpoints instead of Drizzle; the engine owns all knowledge-table access (new `engine/app/library/*`, `access.py`, and /documents, /source, /groups, /telegram endpoints). One Postgres kept by decision (no physical DB split); web keeps the auth tables + chat transcript and still defines the schema.
- **One ask path** for every surface. New engine `ask/service.py::answer_query` does retrieval → answer → audit-log; the web `/ask` endpoint and the Telegram handler both call it. The engine now owns the `query_log` write (web passes the principal `user_id` and no longer logs it itself); Telegram stops re-implementing the pipeline.
- Brand accent switched from teal to **electric violet**. `--brain` → `#684bff`,
  `--brain-text` → `#5636d6` (WCAG-recomputed: 4.49–4.90 UI, 5.57+ AA text). Propagated
  across both apps' `tokens.css`, the OG image, and the swarm palette fallback; Tailwind
  `brain` classes and the runtime swarm pick it up from the token automatically.
- Retrieval is now a **hybrid pipeline**: dense (pgvector) + Postgres full-text (GIN), fused
  with **reciprocal rank fusion**, per-document capped, **reranked** (LLM by default, or a
  self-hosted cross-encoder via `RERANK_BASE_URL`), then **neighbor-expanded** (adjacent
  chunks added to the answer context; citations still resolve to the matched span). Chunks are
  embedded with a **contextual header** (`CONTEXTUAL_MODE`). Both retrievers share one
  permission predicate. Adapted from Cerebras's knowledge-base architecture — Postgres-only,
  no Qdrant.
- Chunking is now **300 words per chunk with 50 words of overlap** (was 120/20). Params
  renamed to `target_words` / `overlap_words` since they count whitespace words, not tokens.
- Default model provider is now **OpenAI's API** — LLM `gpt-5.4-nano-2026-03-17`,
  embeddings `text-embedding-3-small` at 1024 dims (via the `dimensions` param). Added an
  `OPENAI_API_KEY` (Bearer) setting. The deterministic fake providers now gate on
  credentials, so tests and offline dev still fall back to them. On-prem deployments
  override `MODELS_BASE_URL` with a self-hosted endpoint so nothing leaves their network.
- Slimmed `web/` to the product only: new minimal root layout, product-scoped `globals.css`.
- Trimmed the root README to essentials.
- Renamed the design-reference folder `CompBrain Company Website/` → `reference/`.

### Removed
- Marketing code (routes, components, `lib/swarm`, `content`, hooks, SEO shell) from `web/`.
- Unused `web/` deps: `clsx`, `lenis`, `tailwind-merge`.
- Marketing's dynamic `app/icon.tsx` (replaced by the static `icon.svg`).
