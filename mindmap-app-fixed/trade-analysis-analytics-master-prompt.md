# Trade Analysis — Analytics Tab — Master Prompt (v1)

**Status: all 17 steps built (v1 shipped).** If you're picking this up
fresh, there's nothing left to build from this document — it's kept as the
build record. Anything you want changed is a revision, not a resume; open a
new chat, attach the latest zip, and describe the change against the
relevant step below.

Paste this whole file into a new chat, with the current mind-map-app project
zip attached, to build this feature. Same resume convention as
`trade-analysis-master-prompt.md`: do the steps in order, mark each `[x]`
when it is fully done, and if a session runs out of room, the next session
(even on a different account) picks up from the first `[ ]` step. Do not
skip ahead.

**Depends on:** `trade-analysis-master-prompt.md` (v2) already being fully
built — Steps 0–10 there are all `[x]`, so the Trade Analysis overlay,
store, and table already exist. This prompt only ADDS a second view inside
that same feature.

**Assumption locked in (change Step 1 if this is wrong):** "Analysis" is a
second tab inside the *existing* Trade Analysis overlay, not a new
top-toolbar icon or a separate page. A **Table / Analysis** segmented
toggle sits in the overlay's top bar, in the empty space between the title
area and the Filters button. **Filters** and **Add Validation Rule** stay
visible only in Table view (they act on rows, which Analysis doesn't show).

---

## Progress tracker
- [x] Step 0 — Setup: derived-stats module, tab state
- [x] Step 1 — Top bar: Table / Analysis tab switch
- [x] Step 2 — Analysis layout shell (scrollable section grid)
- [x] Step 3 — KPI strip + Top Stocks / Timeframe Usage
- [x] Step 4 — Monthly Activity, Activity Heatmap, Direction & Status Distribution
- [x] Step 5 — Win Rate widgets (Buy vs Sell, by Timeframe) + Setup Strength leaderboard
- [x] Step 6 — Quick Stats row
- [x] Step 7 — Visual Analytics: Weekly Day Pattern, Trade Age spread, Validation Score Distribution
- [x] Step 8 — Buy vs Sell Trend + Timeframe Breakdown chips
- [x] Step 9 — Leaderboards: Top Scoring Trades, Best TF Win Rate, Stock Win Rate
- [x] Step 10 — Activity Calendar (multi-month, markers, legend)
- [x] Step 11 — Pro Analytics: Market Bias gauge, Health score, Streak
- [x] Step 12 — Confidence + Risk/Reward widgets
- [x] Step 13 — Trade Funnel, Trade Age list, TF x Direction Matrix
- [x] Step 14 — Alerts widget
- [x] Step 15 — Stock Intensity Heatmap
- [x] Step 16 — Empty states, responsive check, full animation/polish pass

---

## Design tokens (no exceptions)
Reuse the **exact same** `--ta-*` variables from the Table view — do **not**
introduce the blue/purple/navy colors seen in the reference screenshots
(those come from a different app/module). Every widget below gets rebuilt
in this palette so Analysis reads as the same feature, not a bolted-on
dashboard:

```css
--ta-bg: #ccc5b9;      /* page background */
--ta-surface: #fffcf2; /* every card background */
--ta-ink: #252422;     /* primary text, headings, numbers */
--ta-slate: #403d39;   /* secondary text, icons, borders, chart tracks */
--ta-accent: #eb5e28;  /* bars, progress fills, active states, focus rings */
```
Exceptions (same rule as Step 10 of the Table master prompt):
- **Buy = green, Sell = red** wherever direction is shown (bias gauge,
  Buy vs Sell trend, Buy vs Sell win-rate cards).
- **Target Hit = green-ish, SL Hit = red-ish, Pending = amber-ish** — tints
  *derived from* `--ta-accent` and the dark tones, never new random hex
  values (this matches the existing Status badge treatment in the table).
- Everything else — every bar, ring, chip, heatmap cell, gauge track,
  calendar header — uses `--ta-accent` at full or reduced opacity for
  intensity scales (e.g. a heatmap just varies `--ta-accent`'s opacity
  instead of introducing a green→red scale).

## Stack (match the existing app — no new dependencies)
React (Vite) + Tailwind + Zustand + Framer Motion (`motion/react`) +
lucide-react icons — same as the Table view. **No chart library** is in
`package.json` and none should be added: every bar, ring/gauge, funnel,
calendar, and heatmap below is hand-built with plain `<div>`/SVG + Tailwind,
the same way the rest of this app builds its UI. Read from the existing
`tradeAnalysisStore.js` (`trades`, `validationRules`) — add a new
`src/utils/tradeAnalytics.js` with pure functions that derive every number
below from `trades`/`validationRules` (no new persisted state needed; all
of this is computed on read).

---

## Terminology mapping (reference screenshots → this app)
The reference dashboard is from a different module (zones/DZ-SZ). Map its
concepts onto Trade Analysis's actual fields — do not carry over "zone"
language into the UI:

| Reference term | This app's equivalent |
|---|---|
| Zone / Zones | Trade / Trades |
| DZ (Demand) / SZ (Supply) | Buy / Sell (direction) |
| Target Hit / Stop Loss / Pending | Status: Target Hit / SL Hit / Pending (already exists) |
| Score / Validity % | Validation score (checked rules ÷ active rules, already exists) |
| Stock | Stock/Forex pair (the instrument field) |
| Zone found / resolved | Trade added / Trade closed (Target Hit or SL Hit) |

---

## Step 0 — Setup
- Create `src/utils/tradeAnalytics.js`: pure functions taking
  `(trades, validationRules)` and returning the derived numbers each widget
  below needs (counts, percentages, groupings by date/stock/timeframe/
  direction). Keep each stat a small, separately-testable function
  (`getWinRate`, `getTopStocks`, `getMonthlyActivity`, etc.) rather than one
  giant object — later steps each call the function(s) they need.
- Add `activeView: 'table' | 'analysis'` to `tradeAnalysisStore.js`
  (default `'table'`), persisted like the rest of the store.
- No new CSS tokens needed — reusing `--ta-*` from Step 0 of the Table
  master prompt.

## Step 1 — Top bar: Table / Analysis tab switch
- Segmented control (two pill buttons, `--ta-accent` fill on the active
  one, spring transition) reading/writing `activeView`, placed in the
  overlay top bar between the Back button and the Filters/Add Validation
  Rule buttons.
- **Filters** and **Add Validation Rule** buttons: only rendered when
  `activeView === 'table'`. When `activeView === 'analysis'`, that space is
  empty (or optionally shows a date-range filter later — not required for
  v1).
- Switching tabs animates content with a fade/slide (Framer Motion,
  `AnimatePresence`), matching the app's existing panel-transition feel.

## Step 2 — Analysis layout shell
- A vertically scrollable container (same `--ta-bg` background as the
  Table view's overlay) that holds every section below, top to bottom, in
  the order given in this document.
- Each section title uses a small icon (lucide-react) + uppercase label +
  optional right-aligned subtitle (e.g. "by frequency", "last 6 months"),
  matching the reference screenshots' section-header style, but in
  `--ta-ink`/`--ta-slate`.
- Cards: `--ta-surface` background, subtle border/shadow, rounded corners
  consistent with the rest of the app's card style (match `Whiteboard.jsx`
  or the Table view's own cards for the exact radius/shadow values already
  in use).
- Empty-data guard for the whole tab: if `trades.length === 0`, show one
  friendly empty state ("Add your first trade to see analytics") instead of
  fifteen empty widgets — real widgets only render once there's at least
  one trade.

## Step 3 — KPI strip + Top Stocks / Timeframe Usage
Top row, 5 KPI cards (equal width, wrap on narrow screens):
1. **Total Trades**
2. **Pending** (count, with a `--ta-accent` progress underline like the
   reference's orange underline)
3. **Target Hit** (count)
4. **SL Hit** (count)
5. **Win Rate** (Target Hit ÷ (Target Hit + SL Hit), `—` if no resolved
   trades yet — highlighted card, e.g. slightly tinted `--ta-accent`
   background)

Below that, two side-by-side cards:
- **Top Stocks** — horizontal bar list, stock/pair ranked by frequency,
  bar length relative to the top entry, count on the right.
- **Timeframe Usage** — same horizontal-bar treatment, grouped by the
  Time Frame field, distribution %/count on the right.

## Step 4 — Monthly Activity, Activity Heatmap, Direction & Status Distribution
Three cards side by side (stack on narrow screens):
- **Monthly Activity** — one horizontal bar per month (last 6 months),
  trade count per month.
- **Activity Heatmap** — GitHub-style day grid (Mon–Sun rows, last ~3
  months of weeks as columns), cell opacity = `--ta-accent` scaled by that
  day's trade count, hover shows date + count as a tooltip. Legend: "Less →
  More" swatches.
- **Direction & Status Distribution** — three small ring/count blocks:
  **Buy** / **Sell** counts (colored per the Buy=green/Sell=red exception),
  plus a mini bar breakdown below of **Target Hit / SL Hit / Pending**
  counts (green/red/amber tints).

## Step 5 — Win Rate widgets + Setup Strength leaderboard
- **Win Rate: Buy vs Sell** — two side-by-side cards (green-tinted for Buy,
  red-tinted for Sell... actually keep card backgrounds neutral
  `--ta-surface`, just badge/icon in green/red), each showing win % and a
  small "W/L" record line (e.g. "2W / 1L").
- **Win Rate by Timeframe** — one row per timeframe used, win % and W/L
  record, `--ta-accent` bar showing relative win rate.
- **Setup Strength** — ranked list of stocks/pairs by average validation
  score across their trades, each with a `--ta-accent` bar and a %.

## Step 6 — Quick Stats row
Five compact cards in a row:
1. **Avg Score** — average validation score across all trades, "per trade"
   subtitle.
2. **Most Active** — the most-traded stock/pair + its trade count.
3. **Today's Trades** — count of trades dated today.
4. **This Week** — count of trades in the current week.
5. **Oldest Pending** — age in days of the longest-open Pending trade +
   which stock/pair it is.

## Step 7 — Visual Analytics section
Section header "Visual Analytics", three cards:
- **Weekly Day Pattern** — Mon–Sun horizontal bars, trade count per weekday
  (which days the user trades most).
- **Trade Age** — a single stacked/segmented bar showing the split of
  currently-Pending trades into age buckets (0–7 / 7–30 / 30+ days), with a
  color-tinted legend underneath (reuse the green/amber/red status tint
  logic — fresh=green-ish, mid=amber-ish, stale=red-ish).
- **Validation Score Distribution** — three horizontal bars for score
  buckets (0–30% / 30–60% / 60–100%), count of trades in each.

## Step 8 — Buy vs Sell Trend + Timeframe Breakdown
Two cards side by side:
- **Buy vs Sell Trend** — month-wise comparison, two stacked/grouped
  horizontal bars per month (or a simple two-bar-per-month layout if
  multi-month gets tight) showing Buy count vs Sell count.
- **Timeframe Breakdown** — chip/pill per timeframe actually used, each
  chip showing the timeframe label + trade count badge.

## Step 9 — Leaderboards section
Section header "Leaderboards", three cards:
- **Top Scoring Trades** — trades ranked by validation score, top few
  shown (stock, score). Empty state: "Score trades to see them here."
- **Best TF Win Rate** — timeframe(s) ranked by win rate, with W/L record.
- **Stock Win Rate** — stock/pair ranked by win rate, with W/L record.

## Step 10 — Activity Calendar
- Multi-month calendar grid (prev/next month-range navigation arrows, a
  label like "Jun 2026 — Sep 2026"), each month as its own mini calendar
  (S M T W T F S header row, date cells).
- Per-day markers (small icons, reuse lucide icons): a dot/icon if a trade
  was **added** that day, a target icon if a **Target Hit** happened, a
  stop icon if an **SL Hit** happened, a pending marker if trades are still
  open from that day. Today's cell gets an outline ring.
- Legend row under the calendar: Profit day / Loss day / Pending only /
  Today — colored per the status tint rules above.
- This can reasonably be its own component
  (`src/components/TradeAnalysis/ActivityCalendar.jsx`) since it's the
  most complex widget in this feature.

## Step 11 — Pro Analytics section
Section header "Pro Analytics" (small badge next to it is optional —
skip the reference's "v2" badge, or use "v1" if a badge is wanted at all).
Three cards:
- **Market Bias** — semicircle gauge (hand-built SVG arc, `--ta-slate`
  track + a gradient or solid arc from Sell-red to Buy-green), needle/dot
  position reflecting Buy% vs Sell% of trades, "BEAR ◀ ▶ BULL" labels at
  the ends (relabel as **Sell / Buy** to match this app's language), with
  Buy/Sell totals underneath.
- **Health** — radial progress ring (SVG) showing a 0–100 composite score
  (blend Win Rate + Avg Validation Score + instrument diversity — define a
  simple weighted formula in `tradeAnalytics.js`), a letter grade (A–D)
  in the center, three sub-bars (Win Rate / Avg Score / Diversity) beside
  it.
- **Streak** — current streak of consecutive Target-Hit trades (star icon
  + count), "No resolved trades yet" when there's no closed trade.

## Step 12 — Confidence + Risk/Reward
Two cards side by side:
- **Confidence** — a single wide progress bar ("prediction strength",
  `—` fill when no data) with four numbers underneath: Win Rate, Avg
  Score, Resolved (count), Total (count).
- **Risk/Reward** — three horizontal bars: Wins %, Losses %, Pending %,
  plus an "Avg R:R Ratio" figure at the left (compute from stored price
  data if a target/stop price exists on the trade; otherwise show `—` and
  note this is a stretch input for a later version — do not block the rest
  of the widget on this).

## Step 13 — Trade Funnel, Trade Age list, TF x Direction Matrix
Two cards side by side, plus one below:
- **Trade Funnel** — conversion funnel: All Trades (100%) → Resolved (%)
  → Target Hit (%), each stage a horizontal bar shrinking down, with
  counts on the right and Win Rate / Loss Rate / Pending counts as a
  footer row.
- **Trade Age** (list form, distinct from Step 7's histogram) — three
  summary numbers (Fresh ≤7D / Avg Days / Old >30D) plus a short list of
  the oldest still-Pending trades (stock, timeframe chip, days-open,
  right-aligned).
- **TF x Direction Matrix** — grid with Timeframe rows and Buy/Sell
  columns (+ a Total column), each cell showing win rate and trade count
  for that timeframe+direction combo — win-rate-shaded cell background
  using `--ta-accent` opacity.

## Step 14 — Alerts
- A card listing auto-generated alerts, e.g. "N Stale Pending Trades
  (>14d)" (names the stocks) and "N Trades Without a Validation Score"
  (nudges the user to score them) — same red/blue-tinted alert-row style
  as the reference but recolored into `--ta-accent`/status tints. A small
  badge on the section header shows the alert count. No alerts → hide the
  card entirely (don't show an empty "0 alerts" card).

## Step 15 — Stock Intensity Heatmap
- Grid: stocks/pairs as rows, timeframes as columns, cell = trade count
  for that combo with background opacity scaled by win rate (a "Low →
  High Win Rate" legend bar under the grid, using `--ta-accent` opacity
  ramp rather than a red-to-green scale).

## Step 16 — Empty states, responsive, polish pass
Do this last, once every widget above renders real numbers:
- Every individual widget needs its own graceful empty/`—` state when
  there isn't enough data yet (don't let any card show `NaN`, `Infinity`,
  or a blank hole).
- Every widget mounts with the same staggered fade/slide-in Framer Motion
  treatment as the Table view's rows — Analysis shouldn't feel like a
  static dump next to the animated Table tab.
- Responsive pass: multi-column sections collapse to a single column on
  narrow viewports; the Activity Calendar shows fewer months at once (or
  scrolls horizontally) rather than squeezing.
- Confirm every widget in this tab uses only `--ta-*` tokens plus the
  documented Buy/Sell and status-tint exceptions — no leftover blue/
  purple/navy from the reference screenshots.
- Re-check `Table / Analysis` tab switch keeps `activeView` correct after
  closing/reopening the Trade Analysis overlay.

---

## Open questions — resolved with the documented defaults
- **Risk/Reward's Avg R:R ratio** (Step 12) ships as `—` — the trade form
  has no target/stop price field yet. Add one to `TradeForm.jsx` +
  `tradeAnalysisStore.js`'s trade shape first, then wire real R:R math into
  `getRiskReward()` in `tradeAnalytics.js`.
- **Health score formula** (Step 11) shipped as `Win Rate×0.5 + Avg Score×
  0.35 + Diversity×0.15` in `getHealthScore()` — tune the weights there if
  it should count differently.
- **Table/Analysis entry point**: shipped as the top-bar segmented toggle,
  `activeView` persists via the existing store so reopening the overlay
  remembers the last tab.
