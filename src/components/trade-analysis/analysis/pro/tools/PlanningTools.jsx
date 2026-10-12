import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bell, Flag, Globe, Layers, Plus, Target, Trash2 } from 'lucide-react'
import { ALERT_METRICS, evaluateAlertRule, goalProjection, portfolioHeat, sessionClock } from '../../../../../utils/tradeTools'
import { comparePeriods } from '../../../../../utils/tradeAnalyticsTime'
import { getPerformance } from '../../../../../utils/tradeAnalyticsPro'
import { useTradeAnalysisStore } from '../../../../../store/tradeAnalysisStore'
import {
  Bar, Card, CardHead, Empty, Field, Metric, MiniButton, Pill, SelectField, TableScroll,
  ToolError, Verdict,
} from '../ui'
import { NEG, POS, fmtDate, fmtMoney, fmtNum, fmtPct, signColor } from '../format'
import { useCurrencyGroups, useScopedTrades } from '../useAnalysisData'

// Tools → Planning. Forward-looking utilities that read the real journal:
// what is at risk right now, whether a target is reachable at the current
// expectancy, and custom thresholds evaluated live against real stats.

// ── TOOL 26 — Portfolio heat ─────────────────────────────────────────
export function PortfolioHeatTool({ delay, symbol }) {
  const { trades } = useScopedTrades()
  const toolInputs = useTradeAnalysisStore((s) => s.toolInputs)
  const setToolInput = useTradeAnalysisStore((s) => s.setToolInput)

  const r = useMemo(
    () => portfolioHeat(trades, { accountSize: toolInputs.accountSize, defaultRiskPct: toolInputs.riskPercent }),
    [trades, toolInputs.accountSize, toolInputs.riskPercent]
  )

  return (
    <Card delay={delay}>
      <CardHead
        icon={Target}
        title="Live risk"
        hint="If every open stop got hit today, what would that cost? The question that separates a controlled book from an accidental one."
      />
      <div className="grid grid-cols-2" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Account" value={toolInputs.accountSize} onChange={(v) => setToolInput('accountSize', v)} placeholder="100000" />
        <Field label="Risk / trade" value={toolInputs.riskPercent} onChange={(v) => setToolInput('riskPercent', v)} suffix="%" step="0.1" />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : r.openCount === 0 ? (
          <Empty>No open positions — nothing at risk right now.</Empty>
        ) : (
          <>
            <div className="grid grid-cols-3" style={{ gap: 'var(--tad-gap)' }}>
              <Metric label="Open positions" raw={r.openCount} big />
              <Metric label="Total heat" raw={r.heatPct} format={(v) => `${v.toFixed(1)}%`} color={r.overExposed ? NEG : POS} big />
              <Metric label="At risk" raw={r.heatAmount} format={(v) => fmtMoney(v, symbol, { compact: true })} color={NEG} />
            </div>
            <div className="mt-1">
              <Bar pct={Math.min(100, (r.heatPct / 12) * 100)} color={r.overExposed ? NEG : POS} height={7} />
            </div>
            <div className="mt-1.5">
              <TableScroll maxHeight={140}>
                <table className="ta-table">
                  <thead>
                    <tr>
                      <th>Position</th>
                      <th>Side</th>
                      <th className="text-right">Open</th>
                      <th className="text-right">Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.positions.map((p) => (
                      <tr key={p.id}>
                        <td className="truncate font-semibold" style={{ maxWidth: 130 }} title={`${p.name} · ${fmtDate(p.date)}`}>{p.name}</td>
                        <td style={{ color: p.direction === 'Sell' ? NEG : POS }}>{p.direction}</td>
                        <td className="text-right" style={{ color: p.daysOpen > 21 ? NEG : undefined }}>{p.daysOpen}d</td>
                        <td className="text-right">{fmtMoney(p.riskAmount, symbol, { compact: true })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            </div>
            <Verdict tone={r.overExposed ? 'bad' : 'good'}>
              {r.overExposed
                ? `Total heat of ${r.heatPct.toFixed(1)}% is above the 6% ceiling most risk plans use. A correlated move across these positions would hurt more than any single stop suggests.`
                : `Total heat of ${r.heatPct.toFixed(1)}% is within the usual 6% ceiling. Each position is assumed to risk ${r.assumedRiskPct}%.`}
            </Verdict>
          </>
        )}
      </div>
    </Card>
  )
}

// ── TOOL 27 — Goal tracker ───────────────────────────────────────────
export function GoalTool({ delay, group }) {
  const goals = useTradeAnalysisStore((s) => s.goals)
  const addGoal = useTradeAnalysisStore((s) => s.addGoal)
  const updateGoal = useTradeAnalysisStore((s) => s.updateGoal)
  const deleteGoal = useTradeAnalysisStore((s) => s.deleteGoal)

  const { trades, symbol } = group
  const perf = useMemo(() => getPerformance(trades), [trades])

  const scoped = goals.filter((g) => g.currency === group.id)

  return (
    <Card delay={delay}>
      <CardHead
        icon={Flag}
        title={`${group.label} goals (${symbol})`}
        right={
          <MiniButton
            icon={Plus}
            onClick={() => addGoal({ label: 'Profit target', target: 10000, currency: group.id })}
          >
            Add
          </MiniButton>
        }
      />
      {!scoped.length ? (
        <Empty>Set a profit target and progress is tracked against what you have actually made.</Empty>
      ) : (
        <div className="flex flex-col" style={{ gap: 'var(--tad-gap)' }}>
          <AnimatePresence mode="popLayout">
            {scoped.map((g) => {
              const proj = goalProjection(trades, { targetAmount: g.target, currentAmount: Math.max(0, perf.netPnl) })
              const pct = g.target > 0 ? Math.min(100, (Math.max(0, perf.netPnl) / g.target) * 100) : 0
              return (
                <motion.div
                  key={g.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="rounded-lg p-1.5"
                  style={{ border: '1px solid var(--tad-border)', backgroundColor: 'var(--ta-bg)' }}
                >
                  <div className="flex items-center gap-1">
                    <input
                      value={g.label}
                      onChange={(e) => updateGoal(g.id, { label: e.target.value })}
                      className="ta-tool-input min-w-0 flex-1"
                      style={{ fontWeight: 700 }}
                      aria-label="Goal name"
                    />
                    <input
                      type="number"
                      value={g.target}
                      onChange={(e) => updateGoal(g.id, { target: Number(e.target.value) })}
                      className="ta-tool-input"
                      style={{ width: 84 }}
                      aria-label="Goal target"
                    />
                    <MiniButton icon={Trash2} tone="danger" onClick={() => deleteGoal(g.id)} title="Remove goal" />
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <div className="min-w-0 flex-1">
                      <Bar pct={pct} color={pct >= 100 ? POS : 'var(--ta-accent)'} height={7} />
                    </div>
                    <span className="ta-num shrink-0 font-bold" style={{ fontSize: 'var(--tad-body)', color: pct >= 100 ? POS : 'var(--ta-ink)' }}>
                      {pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1">
                    <Pill color={signColor(perf.netPnl)}>{fmtMoney(perf.netPnl, symbol, { signed: true, compact: true })} so far</Pill>
                    {proj.ok && proj.reachable && (
                      <>
                        <Pill color="var(--ta-slate)">{proj.tradesNeeded} more trades</Pill>
                        {proj.weeksNeeded != null && <Pill color="var(--ta-slate)">≈{fmtNum(proj.weeksNeeded, 1)} weeks</Pill>}
                      </>
                    )}
                    {proj.ok && !proj.reachable && <Pill color={NEG}>Expectancy is negative</Pill>}
                    {!proj.ok && <Pill color="var(--ta-slate)">Needs 5+ trades with P&amp;L</Pill>}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
      <Verdict>
        Projections extrapolate your realised expectancy of{' '}
        {perf.expectancy == null ? '—' : fmtMoney(perf.expectancy, symbol, { signed: true })} per trade. They are a
        pace check, not a promise.
      </Verdict>
    </Card>
  )
}

// ── TOOL 28 — Alert rules ────────────────────────────────────────────
export function AlertRulesTool({ delay }) {
  const { trades } = useScopedTrades()
  const groups = useCurrencyGroups()
  const alertRules = useTradeAnalysisStore((s) => s.alertRules)
  const addAlertRule = useTradeAnalysisStore((s) => s.addAlertRule)
  const updateAlertRule = useTradeAnalysisStore((s) => s.updateAlertRule)
  const deleteAlertRule = useTradeAnalysisStore((s) => s.deleteAlertRule)

  const primary = groups[0]

  const evaluated = useMemo(
    () =>
      alertRules.map((r) =>
        evaluateAlertRule(r, {
          trades,
          groupTrades: primary ? primary.trades : [],
          symbol: primary ? primary.symbol : '',
        })
      ),
    [alertRules, trades, primary]
  )

  const firing = evaluated.filter((r) => r.enabled !== false && r.triggered)

  return (
    <Card delay={delay} span="lg:col-span-2">
      <CardHead
        icon={Bell}
        title="Watchlist rules"
        badge={firing.length || undefined}
        badgeColor={firing.length ? NEG : undefined}
        hint="Thresholds you define, evaluated live against the real statistics on this page"
        right={<MiniButton icon={Plus} onClick={() => addAlertRule({})}>Add rule</MiniButton>}
      />
      {!alertRules.length ? (
        <Empty>
          Add a rule like "win rate below 45%" or "loss streak above 3" and it will be checked against the live
          numbers every time this page recalculates.
        </Empty>
      ) : (
        <div className="flex flex-col" style={{ gap: 'calc(var(--tad-gap) * 0.7)' }}>
          <AnimatePresence mode="popLayout">
            {evaluated.map((r) => {
              const live = r.enabled !== false && r.triggered
              return (
                <motion.div
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className={`flex flex-wrap items-center gap-1 rounded-lg p-1.5 ${live ? 'ta-alert-live' : ''}`}
                  style={{
                    border: `1px solid ${live ? 'rgba(220,38,38,0.4)' : 'var(--tad-border)'}`,
                    backgroundColor: live ? undefined : 'var(--ta-bg)',
                    opacity: r.enabled === false ? 0.5 : 1,
                  }}
                >
                  <select
                    value={r.metric}
                    onChange={(e) => {
                      const m = ALERT_METRICS.find((x) => x.id === e.target.value)
                      updateAlertRule(r.id, { metric: e.target.value, scope: m?.scope || 'all' })
                    }}
                    className="ta-tool-input"
                    style={{ width: 150, cursor: 'pointer' }}
                    aria-label="Metric to watch"
                  >
                    {ALERT_METRICS.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    value={r.comparator}
                    onChange={(e) => updateAlertRule(r.id, { comparator: e.target.value })}
                    className="ta-tool-input"
                    style={{ width: 66, cursor: 'pointer' }}
                    aria-label="Comparison"
                  >
                    <option value="below">below</option>
                    <option value="above">above</option>
                  </select>
                  <input
                    type="number"
                    value={r.threshold}
                    onChange={(e) => updateAlertRule(r.id, { threshold: Number(e.target.value) })}
                    className="ta-tool-input"
                    style={{ width: 70 }}
                    aria-label="Threshold"
                  />
                  <span className="ml-auto flex items-center gap-1">
                    {r.reason ? (
                      <Pill color="var(--ta-slate)">{r.reason}</Pill>
                    ) : (
                      <>
                        <span className="ta-num font-bold" style={{ fontSize: 'var(--tad-body)', color: live ? NEG : 'var(--ta-ink)' }}>
                          {r.display}
                        </span>
                        {live && <Pill color={NEG}>Breached</Pill>}
                        {!live && r.enabled !== false && <Pill color={POS}>OK</Pill>}
                      </>
                    )}
                    <MiniButton
                      onClick={() => updateAlertRule(r.id, { enabled: r.enabled === false })}
                      title={r.enabled === false ? 'Enable this rule' : 'Mute this rule'}
                    >
                      {r.enabled === false ? 'Off' : 'On'}
                    </MiniButton>
                    <MiniButton icon={Trash2} tone="danger" onClick={() => deleteAlertRule(r.id)} title="Delete rule" />
                  </span>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
      {primary && (
        <Verdict>
          Currency-scoped metrics read the {primary.label} ({primary.symbol}) group. Nothing is sent anywhere —
          rules are checked here, in this page, as the numbers change.
        </Verdict>
      )}
    </Card>
  )
}

// ── TOOL 29 — Session clock ──────────────────────────────────────────
export function SessionClockTool({ delay }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const r = useMemo(() => sessionClock(now), [now])

  return (
    <Card delay={delay}>
      <CardHead icon={Globe} title="Session clock" sub={`${r.localTime} local · ${r.utcTime} UTC`} />
      {r.weekend ? (
        <Empty>Markets are closed for the weekend.</Empty>
      ) : (
        <div className="flex flex-col gap-0.5">
          {r.sessions.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.open ? 'ta-pulse' : ''}`}
                style={{ backgroundColor: s.open ? POS : 'var(--ta-slate)', opacity: s.open ? 1 : 0.35 }}
              />
              <span className="w-16 shrink-0 font-semibold" style={{ fontSize: 'var(--tad-body)', color: 'var(--ta-ink)' }}>
                {s.label}
              </span>
              <span className="min-w-0 flex-1 truncate" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
                {s.localOpenLabel} – {s.localCloseLabel}
              </span>
              <Pill color={s.open ? POS : 'var(--ta-slate)'}>
                {s.open ? `closes in ${Math.floor(s.hoursToClose)}h` : `opens in ${Math.floor(s.hoursToOpen)}h`}
              </Pill>
            </div>
          ))}
        </div>
      )}
      {r.overlap && <Verdict tone="good">London and New York are both open — the deepest liquidity window of the day.</Verdict>}
    </Card>
  )
}

// ── TOOL 30 — Period comparison ──────────────────────────────────────
const PERIOD_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '180', label: 'Last 6 months' },
]

export function PeriodCompareTool({ delay, symbol }) {
  const allTrades = useTradeAnalysisStore((s) => s.trades)
  const [days, setDays] = useState('30')

  const result = useMemo(() => {
    const n = Number(days)
    const to = new Date()
    to.setHours(23, 59, 59, 999)
    const from = new Date()
    from.setDate(from.getDate() - n + 1)
    from.setHours(0, 0, 0, 0)

    const prevTo = new Date(from.getTime() - 1)
    const prevFrom = new Date(from.getTime() - n * 86400000)

    return {
      cmp: comparePeriods(allTrades, { from: prevFrom, to: prevTo }, { from, to }),
      from, to, prevFrom, prevTo,
    }
  }, [allTrades, days])

  const { cmp } = result
  const delta = (v, fmt) => (v == null ? '—' : `${v > 0 ? '+' : ''}${fmt(v)}`)

  return (
    <Card delay={delay}>
      <CardHead
        icon={Layers}
        title="This period vs last"
        right={<SelectField label="" value={days} onChange={setDays} options={PERIOD_OPTIONS} />}
      />
      <TableScroll maxHeight={160}>
        <table className="ta-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th className="text-right">Previous</th>
              <th className="text-right">Current</th>
              <th className="text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="font-semibold">Trades</td>
              <td className="text-right">{cmp.a.count}</td>
              <td className="text-right">{cmp.b.count}</td>
              <td className="text-right font-semibold" style={{ color: signColor(cmp.deltaCount) }}>
                {delta(cmp.deltaCount, (v) => `${v}`)}
              </td>
            </tr>
            <tr>
              <td className="font-semibold">Win rate</td>
              <td className="text-right">{fmtPct(cmp.a.winRate, 0)}</td>
              <td className="text-right">{fmtPct(cmp.b.winRate, 0)}</td>
              <td className="text-right font-semibold" style={{ color: signColor(cmp.deltaWinRate) }}>
                {delta(cmp.deltaWinRate, (v) => `${v.toFixed(0)}pt`)}
              </td>
            </tr>
            <tr>
              <td className="font-semibold">Net P&L</td>
              <td className="text-right">{cmp.a.withPnl ? fmtMoney(cmp.a.netPnl, symbol, { signed: true, compact: true }) : '—'}</td>
              <td className="text-right">{cmp.b.withPnl ? fmtMoney(cmp.b.netPnl, symbol, { signed: true, compact: true }) : '—'}</td>
              <td className="text-right font-semibold" style={{ color: signColor(cmp.deltaNetPnl) }}>
                {delta(cmp.deltaNetPnl, (v) => fmtMoney(v, symbol, { compact: true }))}
              </td>
            </tr>
            <tr>
              <td className="font-semibold">Avg / trade</td>
              <td className="text-right">{cmp.a.withPnl ? fmtMoney(cmp.a.avgPnl, symbol, { signed: true, compact: true }) : '—'}</td>
              <td className="text-right">{cmp.b.withPnl ? fmtMoney(cmp.b.avgPnl, symbol, { signed: true, compact: true }) : '—'}</td>
              <td className="text-right font-semibold" style={{ color: signColor(cmp.deltaAvgPnl) }}>
                {delta(cmp.deltaAvgPnl, (v) => fmtMoney(v, symbol, { compact: true }))}
              </td>
            </tr>
          </tbody>
        </table>
      </TableScroll>
      <Verdict>
        Comparing {fmtDate(result.from)} – {fmtDate(result.to)} against {fmtDate(result.prevFrom)} – {fmtDate(result.prevTo)}.
        This tool reads the whole journal, not the date range set in the toolbar.
      </Verdict>
    </Card>
  )
}
