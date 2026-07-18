# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `marketing/` as a standalone Next app — the public site is now a separate deployable
  that never ships to a customer datacenter.
- Project `CLAUDE.md` and this `CHANGELOG.md`.
- Re-architecture spec: draw the service boundary on domain (knowledge vs auth), not
  language — `docs/superpowers/specs/2026-07-18-rearchitecture-domain-vs-delivery-design.md`.

### Changed
- Slimmed `web/` to the product only: new minimal root layout, product-scoped `globals.css`.
- Trimmed the root README to essentials.
- Renamed the design-reference folder `CompBrain Company Website/` → `reference/`.

### Removed
- Marketing code (routes, components, `lib/swarm`, `content`, hooks, SEO shell) from `web/`.
- Unused `web/` deps: `clsx`, `lenis`, `tailwind-merge`.
