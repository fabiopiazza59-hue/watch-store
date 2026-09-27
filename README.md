# Atelier (working name)

**Design it. We'll build it by hand.**

A prototype website where customers design their own mechanical watch from modular parts built
around the Seiko NH35 movement family. An AI designer turns ideas ("a 38mm green field watch on
leather") into a concrete spec. A deterministic rules engine checks real part dimensions to decide
whether the watch can actually be assembled. Buildable designs become orders with a step-by-step
build sheet for the watchmaker (to start with, the founder, at the bench).

**Live demo:** https://fabiopiazza59-hue.github.io/watch-store/, a static build on GitHub Pages
(`npm run build:pages`, deployed by `.github/workflows/pages.yml` on every push). Everything that runs
in the browser works there: the configurator, rules, prices, extras, share links and the quick
designer. Ordering and the Claude designer need the server, so the demo shows the build sheet an
order would get instead.

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
| `npm run test:e2e` | Browser checks (share link and Back, a late designer answer and Undo). Starts `next dev` on port 3310, or set `E2E_BASE_URL` to test a running server |
| `npm run typecheck` | TypeScript checks |
| `npm run lint` | ESLint |
| `npm run build` | Production build |

Environment variables (all optional):

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | Enables the Claude-powered designer; without it the offline designer is used |
| `ANTHROPIC_MODEL` | `claude-opus-5` | Model used by the designer |
| `ANTHROPIC_EFFORT` | `medium` | Reasoning effort (`low` … `max`); lower is faster and cheaper |
| `DESIGN_DAILY_LIMIT` | — | Claude conversations per UTC day; past it the offline designer answers (a spend cap) |
| `ORDERS_DIR` | `./data/orders` | Where orders are stored as JSON files |
| `ORDERS_DAILY_LIMIT` | `200` | New orders accepted per UTC day, counted from the order files |
| `WORKSHOP_TOKEN` | — | Locks the workshop. The pages `/orders` and `/orders/[id]` ask for it as the workshop key (signing in sets the http-only `atelier_workshop` cookie; Sign out is on the queue), and the order API needs it to list, read or update orders, as `Authorization: Bearer <token>` or that cookie. Placing an order stays open. Unset, the workshop is open to anyone, as in local development |
| `ORDER_LINK_SECRET` | `WORKSHOP_TOKEN` | Signs the token in a customer's order confirmation link |
| `PUBLIC_ORIGIN` | — | The site's public address, e.g. `https://atelier.example`. API writes from any other `Origin` are refused, and an `https://` value adds HSTS (read at build time) |
| `TRUST_PROXY` | — | Set when a reverse proxy appends the client address to `X-Forwarded-For`, so per-client limits use it |

### Limits and protections

- API bodies must be `application/json` and are capped in size per route (see `REQUEST_BODY_LIMITS`
  in `src/domain/schemas.ts`); browsers' cross-site requests (`Sec-Fetch-Site: cross-site`) are refused.
- With an API key, each client may send the designer 20 messages per 10 minutes, at most 4
  Claude conversations run at once, and each conversation has a 90-second and 40k-output-token
  budget before the best answer so far is returned. The offline designer has no such limits.
- Each client may place 5 orders an hour (failed attempts don't count).
- `GET /api/orders` returns one page of order summaries, newest first: `{ orders, nextBefore }`,
  with `?before=<nextBefore>` for older ones and `?limit=` up to 100.
- Every response carries a same-origin Content-Security-Policy and the usual hardening headers
  (`next.config.ts`).
- `src/proxy.ts` refuses any `/api/orders` request without the workshop token except placing an
  order, a second lock behind the route handlers' own checks.
- Per-client limits are kept in memory, per server process, and keyed on `X-Forwarded-For`. A
  client can write that header itself, so in production run the app behind a reverse proxy that
  appends the client address, and set `TRUST_PROXY`.

## Pages

- `/` is the configurator, with the AI designer chat, the live to-scale preview, part pickers
  showing which parts fit, the "Can we build it?" panel with one-click fixes, a price estimate
  and ordering.
- `/order-placed/[id]` is the customer's confirmation, where placing an order lands: the watch, its
  price and what happens next, without any of the workshop's details. When `ORDER_LINK_SECRET` or
  `WORKSHOP_TOKEN` is set, its link carries a signed `?t=` token and the page is not found without it.
- `/orders` is the workshop queue: open, shipped or cancelled orders with their status and due date.
  It isn't linked from the site's navigation, so bookmark it. With `WORKSHOP_TOKEN` set it asks for
  the workshop key first.
- `/orders/[id]` shows an order and its printable build sheet (parts list, tools, assembly steps,
  QC checklist), with the parts as they were when it was ordered.
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
    dialTextFit.ts   dial print layout shared by the preview and the dial-text rule
    designer/        Claude tool-use loop + offline fallback (server-only)
    schemas.ts       zod schemas for API input validation
  server/orders.ts   JSON-file order store (server-only)
  proxy.ts           second lock on the workshop's order API
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
flagged in the data (`dataNotes`). Orders are stored locally as JSON files, there is no payment yet,
and the only access control is the optional `WORKSHOP_TOKEN`.
