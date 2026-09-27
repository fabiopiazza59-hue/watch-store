<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project: watch configurator (working name "Atelier")

A website where customers design a mechanical watch from modular NH35-family parts, an AI designer
helps turn ideas into a spec, a deterministic rules engine decides whether it can actually be built,
and buildable designs become orders with a build sheet for the watchmaker (initially the founder,
assembling by hand).

## Architecture
- `src/domain/` — pure, framework-agnostic TypeScript. No React, no Node APIs (except `designer/`).
  - `types.ts` — the shared contract. Change only with care; everything depends on it.
  - `catalog/` — parts library with real dimensions (movements, cases, dials, hands, crystals, bezel inserts, straps).
  - `rules/` — compatibility/feasibility rules engine. **The single source of truth for "can this be built?"**
  - `pricing.ts`, `buildSheet.ts` — cost/lead time and assembly instructions.
  - `designer/` — AI designer (Claude API tool-use loop) + offline keyword fallback. Server-only.
- `src/server/` — server-only persistence (orders as JSON files).
- `src/app/` — Next.js App Router pages and `api/` route handlers.
- `src/components/` — React UI; `preview/WatchPreview.tsx` draws the watch as SVG from real dimensions.

## Principles
- The AI never decides feasibility. It proposes specs; `validateSpec` judges them.
- The preview is rendered from the spec's actual dimensions (honest rendering), not generated imagery.
- No brand names/logos of other watch companies in user-facing designs; "Swiss Made" is never allowed on these dials.
- The app must fully work without `ANTHROPIC_API_KEY` (offline designer mode).

## Commands
- `npm run dev` · `npm run build` · `npm run lint` · `npm run typecheck` · `npm test` (vitest)
- Playwright: launch Chromium with `executablePath: "/opt/pw-browsers/chromium"` (bundled browser revision differs).
