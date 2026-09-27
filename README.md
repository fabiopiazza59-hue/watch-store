# Atelier (working name)

**Design it. We'll build it by hand.**

A prototype website where customers design their own mechanical watch from modular parts built
around the Seiko NH35 movement family. An AI designer turns ideas ("a 38mm green field watch on
leather") into a concrete spec. A deterministic rules engine checks real part dimensions to decide
whether the watch can actually be assembled. Buildable designs become orders with a step-by-step
build sheet for the watchmaker (to start with, the founder, at the bench).

## Why it's built this way

- **The AI suggests, the rules decide.** Whether a watch can be built is a question of geometry:
  dial seat diameter, crown position, hand pinion sizes, crystal and bezel-insert seats, lug width.
  An LLM will sometimes say something fits when it doesn't, so the AI only *proposes* designs. The
  rules engine (`src/domain/rules/`) is the single source of truth, and the AI has to get a design
  past it before it can submit. See [`docs/feasibility-rules.md`](docs/feasibility-rules.md).
- **Honest rendering.** The preview is drawn as SVG from the parts' real dimensions, so what you
  see is what the parts library can actually produce. AI-generated images would happily show
  watches that can't exist.
- **The parts library is the moat.** Accurate dimensional data and supplier knowledge are what
  make the feasibility check trustworthy. See [`docs/parts-research.md`](docs/parts-research.md)
  for what's verified and what still needs confirming with suppliers.
- **Works without AI.** With no API key, a deterministic offline designer handles the chat, so the
  whole site runs for free locally.

## Running it

```bash
npm install
cp .env.example .env.local   # optional: add ANTHROPIC_API_KEY for the Claude-powered designer
npm run dev                  # http://localhost:3000
```

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm test` | Unit tests (rules engine, pricing, build sheet, orders, designer, preview) |
| `npm run typecheck` | TypeScript checks |
| `npm run lint` | ESLint |
| `npm run build` | Production build |

Environment variables (all optional):

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Enables the Claude-powered designer; without it the offline designer is used |
| `ANTHROPIC_MODEL` | `claude-opus-5` | Model used by the designer |
| `ANTHROPIC_EFFORT` | `medium` | Reasoning effort (`low` … `max`); lower is faster and cheaper |
| `ORDERS_DIR` | `./data/orders` | Where orders are stored as JSON files |

## Pages

- `/` is the configurator, with the AI designer chat, the live to-scale preview, part pickers
  showing which parts fit, the "Can we build it?" panel with one-click fixes, a price estimate
  and ordering.
- `/orders` is the workshop queue: every order, with its status.
- `/orders/[id]` shows an order and its printable build sheet (parts list, tools, assembly steps,
  QC checklist).
- `/how-it-works` explains the approach and the roadmap.

## Architecture

```
src/
  domain/            pure TypeScript, no framework code
    types.ts         shared types that every module builds against
    catalog/         parts library + templates
    rules/           feasibility rules engine (source of truth)
    pricing.ts       cost breakdown, suggested retail, lead time
    buildSheet.ts    assembly instructions + QC checks
    designer/        Claude tool-use loop + offline fallback (server-only)
    schemas.ts       zod schemas for API input validation
  server/orders.ts   JSON-file order store (server-only)
  app/               Next.js pages and api/ route handlers
  components/        UI; preview/WatchPreview.tsx renders the watch as SVG
```

Rules, pricing and the catalog run in the browser, so feedback is instant. Only the AI designer
and orders go through the server.

## Roadmap

1. **Learn and sell hand-built NH35 watches (now).** Assemble the first watches yourself, grow
   and verify the parts library with real suppliers, take the first 10–20 orders through this
   site.
2. **Open the atelier to other creators.** Let independent designers publish their own designs
   and dial artwork on the platform, and work with a partner watchmaker for capacity.
3. **Your own brand, then higher horology.** Use what customers actually design as market
   research for your own collection, then move up to Swiss/Japanese premium movements and
   custom-made cases.

## Status

This is a prototype. Prices and lead times are estimates. Some part dimensions are approximate and
flagged in the data (`dataNotes`). Orders are stored locally as JSON files, and there is no payment
or authentication yet.
