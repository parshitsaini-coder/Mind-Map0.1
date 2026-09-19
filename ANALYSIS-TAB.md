# Trade Analysis — Analysis tab

What was added, where it lives, and how to verify it.

Everything here computes from the trades in your own journal. There is no
sample data, no placeholder, and no hard-coded example anywhere in the
tab — if a widget has nothing to show it says so and explains what it
needs, rather than filling the space.

---

## Layout

The Analysis tab is eight sections behind a sticky nav instead of one long
scroll. Each is a separate lazy-loaded chunk, so opening Overview does not
download the calculators.

| Section | Shortcut | What it answers |
|---|---|---|
| Overview | `Alt+1` | How am I doing, in five seconds |
| Performance | `Alt+2` | Is the edge real, and how big |
| Risk | `Alt+3` | What could this cost me |
| Edge | `Alt+4` | Where does the money actually come from |
| Behaviour | `Alt+5` | What am I doing to myself |
| Timing | `Alt+6` | When does the edge show up |
| Findings | `Alt+7` | What stands out without me looking |
| Tools | `Alt+8` | 34 calculators |

**Toolbar controls** apply to every widget at once:

- **Date scope** — All time / 7d / 30d / 90d / 6m / 1y / custom range. A chip
  shows "42 of 180" when a filter is active and clears it in one click.
- **Density** — Cozy / Compact / Dense. Drives ten CSS custom properties, so
  every gap, font size, row height and chart height re-flows. Dense fits
  roughly twice the content of Cozy without dropping below ~6.5px, where
  digits stop being readable.

---

## Currency handling

Equity settles in ₹, Forex and Commodity in $. **Money is never summed
across the two.** Every monetary widget renders once per currency group
and labels which it is showing. Counts and win rates, which are
currency-free, cover everything.

A trader with only equity trades never sees an empty "Forex & Commodity"
card — groups with no trades are omitted, and a single group renders
full-width.

---

## Analytics — 96 metrics across 47 widgets

**Core performance** — net P&L, expectancy (currency and R), profit factor,
payoff ratio, gross profit/loss, average and largest win/loss, median
result, SQN, win/loss/break-even counts.

**Distribution** — histogram with adjustable bins, box plot with Tukey
fences, quartiles and IQR, percentile ladder (CDF), R-multiple buckets,
skew, excess kurtosis, outlier table with the trimmed result.

**Drawdown** — underwater curve, max drawdown in currency and percent
(tracked as independent maxima, because they peak at different trades),
current drawdown, longest run under water, Ulcer index, recovery factor,
new-high count, whether the account has recovered.

**Risk-adjusted** — Sharpe, Sortino, Calmar, Omega, gain-to-pain, tail
ratio, standard and downside deviation, VaR 95%, CVaR 95%. Computed per
trade rather than annualised: a discretionary journal has no fixed period,
and annualising it would invent precision.

**Survival** — Kelly and half-Kelly, risk of ruin at 10/20/50 risk units,
Monte Carlo over 500–3000 reshuffles of your own logged results (every
simulated trade is one you really took; only the order changes), median and
95th-percentile drawdown, probability of finishing profitable.

**Streaks** — current run, best and worst run, average run lengths, a ribbon
of every run in order, and a Wald-Wolfowitz runs test that says whether the
streaks are distinguishable from chance at all.

**Consistency** — score, profitable months/weeks/days, the best month's
share of total profit, best and worst day/week/month.

**Edge ranking** — per instrument, timeframe, direction and instrument type.
Ranked on a composite edge score that is **damped by sample size**, so three
lucky trades cannot top the table. Confidence is shown as opacity.

**Matrices** — instrument × timeframe, direction × timeframe, day × hour
heatmap, instrument correlation on shared trading days.

**Concentration** — Herfindahl-Hirschman index, effective instrument count,
diversification score, top holdings by share.

**Behaviour** — after-win vs after-loss win rate, quick re-entries after a
loss, busy-day detection measured against your own average, holding period
for winners vs losers (disposition effect), position size drift after wins
and losses, recurring words in your notes ranked by outcome.

**Discipline** — checklist score correlation against results, scatter of
score vs P&L, the optimal minimum-score cut-off, and per-rule lift: win rate
with each rule ticked against without it.

**Timing** — day of week, month of year, hour logged, IST session windows,
cadence, gaps, trading calendar with per-day outcome colouring.

**Stress tests** — edge decay (first half vs second half), what-if with the
top and bottom 1/3/5 trades removed, equal-weight sizing replay that
isolates how much position sizing added or cost.

**Findings** — ~25 plain-English observations generated from the above, with
severity, filterable. Each has a minimum sample size and stays silent below
it.

---

## Tools — 34 calculators

**Trade setup (11)** — position size, risk/reward with break-even win rate,
ATR stop and target, trailing stop (chandelier / percentage / break-even /
lock-half), break-even after costs, pivot points (classic, Fibonacci,
Camarilla, Woodie), Fibonacci retracements and extensions, pip value,
margin and leverage, currency converter, lot converter.

**Risk & sizing (9)** — Kelly, expectancy projector, risk of ruin,
consecutive-loss table, forward Monte Carlo, streak odds, drawdown recovery,
compounding projector, reward-ratio table measured against your actual win
rate.

**Edge & proof (5)** — Wilson score confidence interval on your win rate,
sample size needed to prove an edge, trade grader (scores a planned setup
against your own record on that instrument/timeframe/direction), cost drag
applied to every trade you actually logged.

**Planning (5)** — live portfolio heat across open positions, goal tracker
with pace projection from realised expectancy, custom watchlist rules
evaluated live, session clock, period-over-period comparison.

**Data (5)** — query console with export, CSV export/import (round-trips
cleanly, with spreadsheet formula-injection guarded), full JSON backup and
restore, trade replay with scrubber and playback, chart gallery with
lightbox.

Calculators default from your own journal where a sensible default exists —
the "Use my stats" button fills win rate, average win/loss and payoff from
real trades.

---

## Honest limitations

These are stated in the UI, not hidden:

- **R-unit is estimated** as the average absolute loss, because the trade
  form has no stop-price field. Labelled as an estimate everywhere it appears.
- **Hour-of-day and session figures** read `createdAt` — when the trade was
  logged, not when it was entered. The closest honest proxy available.
- **The currency converter uses a rate you supply.** There is no live feed,
  on purpose: a stale hard-coded rate would be worse than a number you endorse.
- **Turnover tax** is estimated from the `price` field, the only notional the
  form records.
- **Monte Carlo reshuffles real trades.** It does not model returns it has
  never seen, so it cannot tell you about market regimes absent from your log.

---

## Verification

```bash
./tests/all.sh
```

| Suite | Result |
|---|---|
| Import graph | all local named imports resolve |
| Stats primitives | verified against scipy/NumPy reference values |
| Analytics engine | 23,957 checks, 0 failures |
| Tools engine | 303 checks, 0 failures |
| Edge tools | 60 checks, 0 failures |
| Density & CSS | 39 checks, 0 failures |
| Render smoke test | 154 renders, 0 failures |
| Production build | passes |
| Lint | 0 errors, 0 warnings in new code |

The render smoke test is the one that matters most: it mounts all eight
sections and all 34 tools against twelve deliberately awkward datasets —
empty log, one trade, two trades, all-pending, no P&L anywhere, no
validation scores, a single instrument, equity-only, forex-only, and a
400-trade load — then every density × scope combination. A build only
proves the modules link; this proves they survive real edge cases.

Statistical results are asserted against published values rather than
against the implementation, so a regression in a formula fails the test.
The Wilson interval for 10 wins / 10 losses must come out [29.9%, 70.1%];
for 60/100 it must be [50.2%, 69.1%].
