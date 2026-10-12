import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { Trophy, TrendingDown, Target, BarChart3, PieChart, Activity, Layers } from 'lucide-react'
import { splitTradesByCurrency, symbolForType, CURRENCY_GROUP_LABEL } from '../../utils/currency'
import { getPerformance, getEquityCurve, hasPnl, pnlOf, outcomeOf } from '../../utils/tradeAnalyticsPro'
import { Donut, Gauge, EquityCurve, ColumnChart } from '../trade-analysis/analysis/pro/charts'
import { POS, NEG, NEUTRAL, fmtMoney } from '../trade-analysis/analysis/pro/format'

// Read-only "Analysis" view for a shared trade link — a lighter, storeless
// cousin of the editor's Pro Analytics tab (AnalysisTab.jsx). That tab
// reads everything from useTradeAnalysisStore, which is persisted to
// localStorage; wiring a visitor's page into that same store would risk
// writing the OWNER's shared trades into whatever browser opens the link
// (including the owner's own, if they ever open their own share link
// logged out). So this recomputes a smaller set of widgets directly from
// the `trades` prop already fetched by TradeShareView — same pattern the
// stats strip above already uses — using the pure chart primitives and
// pure analytics functions from the Pro tab (neither touches the store).

function WidgetCard({ title, icon: Icon, span, delay = 0, children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.32, ease: 'easeOut' }}
      className={`ta-pro-card flex flex-col gap-2 ${span === 2 ? 'sm:col-span-2' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        {Icon && <Icon size={12} style={{ color: 'var(--ta-accent)' }} />}
        <span className="font-bold uppercase tracking-wide" style={{ fontSize: 'var(--tad-label)', color: 'var(--ta-ink)' }}>
          {title}
        </span>
      </div>
      {children}
    </motion.div>
  )
}

function SectionLabel({ children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="col-span-full mt-1 flex items-center gap-1.5 first:mt-0"
    >
      <span className="h-[2px] w-4 rounded-full" style={{ backgroundColor: 'var(--ta-accent)' }} />
      <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: 'var(--ta-slate)' }}>
        {children}
      </span>
    </motion.div>
  )
}

/** Net P&L grouped by an arbitrary key — pairs and setups both need this,
 *  neither of which is a date key like utils/tradeAnalyticsPro's own
 *  groupPnlBy expects, so it's kept local rather than overloading that
 *  one. */
function groupPnlByLabel(trades, entries) {
  const map = new Map()
  entries(trades).forEach(({ key, label, pnl }) => {
    if (!map.has(key)) map.set(key, { key, label, value: 0, count: 0 })
    const row = map.get(key)
    row.value += pnl
    row.count += 1
  })
  return [...map.values()].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 7)
}

function CurrencyGroupWidgets({ label, trades, validationRules, symbol, delayBase }) {
  const perf = useMemo(() => getPerformance(trades), [trades])
  const equity = useMemo(() => getEquityCurve(trades), [trades])
  const byPair = useMemo(
    () =>
      groupPnlByLabel(trades, (ts) =>
        ts.filter(hasPnl).map((t) => ({ key: t.pair, label: t.pair, pnl: pnlOf(t) }))
      ),
    [trades]
  )
  const bySetup = useMemo(
    () =>
      groupPnlByLabel(trades, (ts) => {
        const rows = []
        ts.filter(hasPnl).forEach((t) => {
          ;(t.validationRuleIds || []).forEach((rid) => {
            const rule = validationRules.find((r) => r.id === rid)
            if (rule) rows.push({ key: rid, label: rule.label, pnl: pnlOf(t) })
          })
        })
        return rows
      }),
    [trades, validationRules]
  )
  const withPnl = useMemo(() => trades.filter(hasPnl), [trades])
  const best = useMemo(() => [...withPnl].sort((a, b) => pnlOf(b) - pnlOf(a)).slice(0, 3), [withPnl])
  const worst = useMemo(() => [...withPnl].sort((a, b) => pnlOf(a) - pnlOf(b)).slice(0, 3), [withPnl])

  return (
    <>
      <SectionLabel delay={delayBase}>{label}</SectionLabel>

      <WidgetCard title="Win rate" icon={Target} delay={delayBase + 0.03}>
        <div className="flex items-center justify-center py-1">
          <Gauge
            pct={perf.winRate ?? 0}
            centerTop={perf.winRate == null ? '—' : `${Math.round(perf.winRate)}%`}
            centerBottom={`${perf.winCount}W / ${perf.lossCount}L`}
            color={perf.winRate >= 50 ? POS : NEG}
          />
        </div>
        <div className="grid grid-cols-2 gap-1 text-center">
          <div>
            <p className="ta-num font-extrabold" style={{ fontSize: 'var(--tad-value)', color: POS }}>{fmtMoney(perf.avgWin, symbol, { compact: true })}</p>
            <p style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>Avg win</p>
          </div>
          <div>
            <p className="ta-num font-extrabold" style={{ fontSize: 'var(--tad-value)', color: NEG }}>{fmtMoney(perf.avgLoss ? -perf.avgLoss : null, symbol, { compact: true })}</p>
            <p style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>Avg loss</p>
          </div>
        </div>
      </WidgetCard>

      <WidgetCard title="Net P&L" icon={Activity} delay={delayBase + 0.06}>
        <p className="ta-num text-center font-extrabold" style={{ fontSize: 'var(--tad-hero)', color: perf.netPnl > 0 ? POS : perf.netPnl < 0 ? NEG : NEUTRAL }}>
          {fmtMoney(perf.netPnl, symbol, { signed: true, compact: true })}
        </p>
        <div className="grid grid-cols-2 gap-1 text-center">
          <div>
            <p className="ta-num font-bold" style={{ fontSize: 'var(--tad-body)', color: 'var(--ta-ink)' }}>{perf.profitFactor == null ? '—' : perf.profitFactor.toFixed(2)}</p>
            <p style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>Profit factor</p>
          </div>
          <div>
            <p className="ta-num font-bold" style={{ fontSize: 'var(--tad-body)', color: 'var(--ta-ink)' }}>{fmtMoney(perf.expectancy, symbol, { signed: true, compact: true })}</p>
            <p style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>Expectancy</p>
          </div>
        </div>
      </WidgetCard>

      <WidgetCard title="Equity curve" icon={BarChart3} span={2} delay={delayBase + 0.09}>
        <EquityCurve points={equity} symbol={symbol} />
      </WidgetCard>

      <WidgetCard title="P&L by pair" icon={Layers} delay={delayBase + 0.12}>
        <ColumnChart data={byPair} symbol={symbol} labelKey="label" valueKey="value" />
      </WidgetCard>

      <WidgetCard title="P&L by setup" icon={PieChart} delay={delayBase + 0.15}>
        {bySetup.length ? (
          <ColumnChart data={bySetup} symbol={symbol} labelKey="label" valueKey="value" />
        ) : (
          <div className="flex items-center justify-center italic" style={{ height: 'var(--tad-chart-h)', fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
            No validation tags logged on these trades.
          </div>
        )}
      </WidgetCard>

      <WidgetCard title="Best & worst" icon={Trophy} span={2} delay={delayBase + 0.18}>
        {withPnl.length === 0 ? (
          <p className="text-center italic" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>No P&amp;L logged on these trades.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1 font-bold" style={{ fontSize: 'var(--tad-micro)', color: POS }}>
                <Trophy size={9} /> TOP WINNERS
              </span>
              {best.length === 0 && <span style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>—</span>}
              {best.map((t) => (
                <div key={t.id} className="flex items-center justify-between" style={{ fontSize: 'var(--tad-body)' }}>
                  <span className="truncate" style={{ color: 'var(--ta-ink)' }}>{t.pair} · {t.date}</span>
                  <span className="ta-num shrink-0 font-bold" style={{ color: POS }}>{fmtMoney(pnlOf(t), symbol, { signed: true })}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <span className="flex items-center gap-1 font-bold" style={{ fontSize: 'var(--tad-micro)', color: NEG }}>
                <TrendingDown size={9} /> TOP LOSERS
              </span>
              {worst.length === 0 && <span style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>—</span>}
              {worst.map((t) => (
                <div key={t.id} className="flex items-center justify-between" style={{ fontSize: 'var(--tad-body)' }}>
                  <span className="truncate" style={{ color: 'var(--ta-ink)' }}>{t.pair} · {t.date}</span>
                  <span className="ta-num shrink-0 font-bold" style={{ color: NEG }}>{fmtMoney(pnlOf(t), symbol, { signed: true })}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </WidgetCard>
    </>
  )
}

export default function ShareAnalysisWidgets({ trades, validationRules }) {
  const { INR, USD } = useMemo(() => splitTradesByCurrency(trades), [trades])
  const groups = [
    { id: 'INR', trades: INR, label: CURRENCY_GROUP_LABEL.INR, symbol: symbolForType('Equity') },
    { id: 'USD', trades: USD, label: CURRENCY_GROUP_LABEL.USD, symbol: symbolForType('Forex') },
  ].filter((g) => g.trades.length > 0)

  const outcomeSegments = useMemo(() => {
    const counts = { win: 0, loss: 0, other: 0 }
    trades.forEach((t) => {
      const o = outcomeOf(t)
      if (o === 'win') counts.win += 1
      else if (o === 'loss') counts.loss += 1
      else counts.other += 1
    })
    return counts
  }, [trades])

  const buyCount = trades.filter((t) => t.direction === 'Buy').length
  const sellCount = trades.filter((t) => t.direction === 'Sell').length
  const decided = outcomeSegments.win + outcomeSegments.loss
  const winRate = decided ? Math.round((outcomeSegments.win / decided) * 100) : null

  return (
    <div
      data-ta-density="compact"
      className="mx-auto grid w-full max-w-[1400px] grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      <SectionLabel>Overview</SectionLabel>

      <WidgetCard title="Outcome" icon={Target} delay={0.03}>
        <div className="flex items-center justify-center gap-3 py-1">
          <Donut
            segments={[
              { label: 'Target Hit', value: outcomeSegments.win, color: POS },
              { label: 'SL Hit', value: outcomeSegments.loss, color: NEG },
              { label: 'Pending', value: outcomeSegments.other, color: NEUTRAL },
            ]}
            centerTop={winRate == null ? '—' : `${winRate}%`}
            centerBottom="win rate"
          />
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: POS }} /> Target Hit · {outcomeSegments.win}
            </span>
            <span className="flex items-center gap-1" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: NEG }} /> SL Hit · {outcomeSegments.loss}
            </span>
            <span className="flex items-center gap-1" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: NEUTRAL }} /> Pending · {outcomeSegments.other}
            </span>
          </div>
        </div>
      </WidgetCard>

      <WidgetCard title="Buy vs Sell" icon={PieChart} delay={0.06}>
        <div className="flex items-center justify-center gap-3 py-1">
          <Donut
            segments={[
              { label: 'Buy', value: buyCount, color: POS },
              { label: 'Sell', value: sellCount, color: NEG },
            ]}
            centerTop={trades.length}
            centerBottom="trades"
          />
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: POS }} /> Buy · {buyCount}
            </span>
            <span className="flex items-center gap-1" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: NEG }} /> Sell · {sellCount}
            </span>
          </div>
        </div>
      </WidgetCard>

      <WidgetCard title="Trades logged" icon={BarChart3} delay={0.09}>
        <p className="ta-num text-center font-extrabold" style={{ fontSize: 'var(--tad-hero)', color: 'var(--ta-accent)' }}>{trades.length}</p>
        <p className="text-center" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
          across {groups.length} currency group{groups.length === 1 ? '' : 's'}
        </p>
      </WidgetCard>

      {groups.map((g, i) => (
        <CurrencyGroupWidgets
          key={g.id}
          label={`${g.label} (${g.symbol})`}
          trades={g.trades}
          validationRules={validationRules}
          symbol={g.symbol}
          delayBase={0.14 + i * 0.05}
        />
      ))}
    </div>
  )
}
