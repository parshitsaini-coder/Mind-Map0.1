# QA — Phase 14, slice 1 (decision gate + server side)

Status: **PARTIAL / IN PROGRESS.** Slice 1 of 2. Nothing the person sees changed: the app still runs on the simulator.

## Evidence

| Item | Result | How |
| --- | --- | --- |
| Provider research with current docs; transport recommendation; decision recorded | DONE | see chat; Twelve Data: 8 credits / min, 800 / day, free plan is "internal, non-display"; Finnhub free = personal use |
| Symbol routing + allow-list (incl. `__proto__`, arrays, NIFTY50 refused) | PASS | `terminal-phase14.test.mjs` |
| Twelve Data adapter: URL builders (key in header, never in URL), candles, quotes (single + batch + per-symbol errors), typed errors (rate limit vs daily quota vs key vs plan) | PASS against **hand-written** fixtures | unit |
| Finnhub adapter: crypto candles, H4 built from H1, last price from newest 1m bar, premium / key / rate-limit errors | PASS against **hand-written** fixtures | unit |
| Candle math (merge, aggregate, tick into forming bar, late ticks, gap ranges with closed hours) | PASS | unit |
| Market hours: forex NY week incl. summer / winter UTC shift, gold daily break, crypto, NIFTY IST + injected holidays, exact next open, "Market closed — opens in 5h 12m" | PASS (a mutation of the Friday close time was caught) | unit |
| Feed health: live / delayed / offline / closed, thresholds scale with poll interval, backoff + jitter, poll pacing from the credit budget, tick order / de-dupe | PASS | unit |
| Proxy guard rails: query clamping + injection-ish input, per-IP limiter (bounded memory), credit budget (minute + day), cache policy, CORS, 405, OPTIONS | PASS | unit with fake fetch |
| Proxy: key only in header, never in URL or response; errors never cached; 404 before any upstream call; batched Twelve call; own budget stops calls before the vendor does | PASS | unit with fake fetch |
| `bash tests/all.sh` | PASS (all green, 311 renders, build, lint) | |
| **Real responses from Twelve Data / Finnhub match the adapters** | **NOT VERIFIED** | sandbox has no network. Run `node tools/probe-providers.mjs` with your keys |
| `vercel dev` / a deployed `/api/*` call | **NOT VERIFIED** | not run |
| Twelve Data WebSocket trial gives free forex ticks | **NOT VERIFIED** | the probe now tests it (Node 22+) |

## Still open (slice 2)

Browser feed + quote hub on the proxy; ChartView / TerminalScreen on the async API; real market status in the status line and "market closed" order rejection; engine catch-up on real candles ("SL first" rule); one-time migration dialog for old demo accounts; delete `simulatedFeed.js` (+ mock feed for tests, import check); connection badge / footer / error state; `public/sw.js` never caching `/api/*`; add BTCUSD / ETHUSD instrument specs; remove NIFTY50; secret scan of `dist/`; README / SUPABASE_SETUP docs. NSE holiday list is not bundled (not verified).

## Honest limits to expect

On the free Twelve Data plan 5 forex / gold symbols refresh about once a minute (credit budget), and the free terms are for internal, non-display use: fine for a private test, not for a public launch.


# Slice 2 — browser side (run in a sandbox with NO npm registry access)

Status: **PARTIAL.** Everything below was checked with plain Node only. `vite build`, `oxlint`, the render smoke test, Playwright and every real-browser or real-API check were NOT run.

| Item | Result | How |
| --- | --- | --- |
| Browser client: same-origin `/api` only, no key, typed errors, bad / empty body, unknown timeframe | PASS | `terminal-phase14b` (fake fetch) |
| Polling hub: batched call, ref-count, credit-budget pacing (5 symbols, 8/min -> ~1 min), pause while hidden, resume now, backoff, quota >= 5 min, retryAfter, older tick dropped, unchanged price still Live, closed market, one failing symbol | PASS | `terminal-phase14b` (fake clock + timers). A real bug was found and fixed here: the first poll computed its interval before more symbols were watched |
| Spread over live mid; real bid / ask win; crossed real quotes rejected | PASS | unit |
| Migration (keep history / fresh / idempotent / balance untouched / hidden by default) | PASS | unit + real store |
| Real store: closed market rejects market + pending orders, ignores stale price for SL, open market still triggers SL | PASS | `terminal-phase14-store` — found and fixed a bug (rejection text was empty when the clock said "open") |
| Real store: async catch-up on faked `/api` candles, candle touching SL and TP -> SL first; no data -> ledger untouched + message | PASS | `terminal-phase14-store` |
| Service worker never caches `/api/*` | FIXED in code, NOT VERIFIED in a browser (the old worker cached same-origin GETs cache-first, which would have frozen prices) | read-through |
| Simulator removed from `src/`; nothing in `src/` references it or the fixtures; secret scan | PASS | `check-imports.mjs` (mutation-checked), `secret-scan.mjs` on src / public / tests (dist NOT scanned: no build) |
| All src files parse (JSX syntax) | PASS | esbuild syntax pass |
| Phase 7, 9, 10, 11, 12, 13 store tests still pass | PASS **with a hand-written zustand / supabase stub** (real packages could not be installed). Phase 8 store test needs React and was NOT run |
| `bash tests/all.sh` (build, lint, render smoke test) | **NOT RUN** | no registry |
| Chart loading / error / Retry, badge, migration dialog, popup, footer | **NOT VERIFIED** | never rendered |
| `/api/quote` after the slice 1 fix + `FEED_PROVIDER_CRYPTO=twelvedata`; BTCUSD price | **NOT VERIFIED** | waiting for the user's redeploy result |

## Still open
Live USD conversion rates, IndexedDB candle cache + scroll-left history, WebSocket ticks, NSE holidays, `connection.*` events, queue-as-pending when closed, spread label wording in Settings, Lighthouse / soak / cross-browser (Phase 15).

## Manual test list (5 minutes, after `npm install && npm run dev` / deploy)
1. Open the terminal: badge says Live (or Market closed on a weekend for gold / forex); chart shows candles, not a spinner.
2. Block the network (DevTools offline) and reload the chart: a clear error with Retry; Retry works when back online.
3. Old account with trades: the migration dialog appears once; choose Keep history; open trades closed flat, balance unchanged; History hides simulated trades until the checkbox is ticked.
4. Place a BUY with SL 5 pips away; watch it follow the real price; close it. On a weekend: gold orders say "Market closed — opens in …".
5. Close the tab for 10 min with an open trade and tight SL, reopen: "While you were away" notice if the real price hit it.
6. DevTools -> Application -> Service Workers: `/api/*` requests are never served from cache.

## Fix after the first real run (14 Oct 2026, user screenshot): top bar Bid / Ask blank, no live candle
Cause: the slice-1 zip I was given did NOT contain the `interval=1min` fix, so `/api/quote` still returned the daily bar's timestamp (hours old). The chart treated every tick as older than its newest candle and dropped it, and the top bar only listened to the chart. Fixed: `interval=1min` is now really in `twelveData.quoteUrl`; a quote's time is the moment it was received (provider timestamp kept as `providerTs`); the top bar reads the shared quote directly. Tests added. NOT re-verified in a browser — redeploy needed (the `/api` change is server side).
