# QA — Phase 14 (live XAUUSD data, simulator removed)

Date: 2026-10-17. Scope: XAUUSD only, Twelve Data via `/api/*`, market hours, real-candle catch-up, migration.

## What was verified (automated)
| Area | How | Result |
| --- | --- | --- |
| Whole suite (`tests/all.sh`): all older suites + Phase 14, 240 renders, build, secret scan, lint | `bash tests/all.sh` | ALL GREEN |
| Adapter normalisation, symbol mapping, error mapping | `terminal-phase14.test.mjs` with **hand-made** payloads in `tests/fixtures/twelvedata/` | pass |
| API handlers: allow-list, validation, cache, single-flight, CORS, rate limit, quota, daily budget, no key leak, no key = 503 | same file, fake fetch | pass |
| Candle merge / gap fill / H1→H4 aggregation / tick folding | same | pass |
| Market-hours calendar (Fri 21:00, Sat, Sun 22:00, daily break, countdown text) | same | pass |
| Stale state machine live→delayed→offline→closed, backoff + jitter, quota backoff | same | pass |
| Live feed (fake fetch + fake timers): one loop per symbol, pause when hidden, backoff, recovery, weekend = closed, only same-origin `/api/*` | same | pass |
| Catch-up with real candles: gap open fills at the gapped price, SL first when one candle touches SL and TP (`bothHit`), partial coverage, 7 days on 5-min candles | same + store test | pass |
| Migration: derived from data, idempotent, balance untouched, old items tagged `simulated`, stats filter | `terminal-phase14.test.mjs`, `terminal-phase14-store.test.mjs` | pass |
| Closed market refuses market orders / closes, accepts pending orders | store test | pass |
| Nothing in `src/` imports the simulator or test fixtures; UI has no "simulated prices" / "24/7" | `check-imports.mjs`, phase 14 test | pass |
| Secret scan over `src public tests dist api` after the build | `tests/secret-scan.mjs` | clean |
| Real browser (Playwright, headless Chromium, **mock** `/api`) at 1440 px and 360 px | `tests/e2e-phase14/p14.mjs` | 22/22; only same-origin `/api/*` requests |

Screenshots: `14-live-desktop.png`, `14-live-4charts.png`, `14-closed.png`, `14-error.png`, `14-migration.png`, `14-live-mobile.png`.

## NOT verified — needs you
1. **The real Twelve Data API.** The build sandbox has no network and no key. Payload shapes come from the public docs, not from a recording. After deploy: open `/api/health` (must say `keyConfigured: true`), then open the terminal and check the badge says **Live** and the last candle matches a gold chart. If a field differs, only `src/lib/terminal/feed/adapters/twelveData.js` (and the fixtures in `tests/fixtures/twelvedata/`) needs a fix.
2. Whether **XAU/USD is included in your plan's free tier**, and what real timestamps / market-open flags look like on weekends.
3. The **free quota** (8/min, 800/day): the functions stop at 700/day, polling is 30 s while visible and open — roughly 6½ hours of continuous viewing a day. Not measured against the real provider.
4. **Terms**: Twelve Data Basic is for internal / non-display use — fine for personal practice, check before sharing the app publicly.
5. Real phone / Safari, slow networks, and a real Supabase round trip of the migration choice (the logic is derived from the data, so a second device sees the result; tested only with Phase 7's fake remote).

## Decisions made
- Pending orders are always accepted while the market is closed (they wait); market orders and market closes are refused with "Market closed — opens in …". There is no "queue market order" setting.
- Daily and weekly candles come from the provider natively; H4 is built from H1 (UTC aligned).
- Bid/ask = live mid ± a simulated spread (Settings → Trading → "Simulated spread over live mid").
- The market-hours calendar is the default; the provider's `is_market_open` flag overrides it when present.
- Old simulated P/L stays inside the balance; only the trade list and stats are filtered (the equity curve of an old account is not reconstructed).

## Known gaps
- Older history is not lazy-loaded while panning (the API supports `to=`; the chart loads the latest 1500 candles).
- `FEED_RELAY_URL` is only a placeholder in `.env.example`.
- Volume on spot gold may be 0 from the provider; Volume / VWAP then show little.
- Pre-existing lint warnings (react-hooks) unchanged.
