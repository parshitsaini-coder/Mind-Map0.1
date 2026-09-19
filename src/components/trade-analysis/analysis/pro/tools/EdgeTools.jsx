import { useMemo, useState } from 'react'
import { Award, Move3d, Receipt, Ruler, Sigma } from 'lucide-react'
import {
  costImpact, sampleSizeNeeded, tradeGrader, trailingStop, winRateConfidence,
} from '../../../../../utils/tradeTools'
import { getPerformance, stockLabel } from '../../../../../utils/tradeAnalyticsPro'
import { useTradeAnalysisStore } from '../../../../../store/tradeAnalysisStore'
import {
  Bar, Card, CardHead, Empty, Field, Metric, SelectField, StatRow, TableScroll,
  ToolError, ToolResult, Verdict,
} from '../ui'
import { NEG, POS, fmtMoney, fmtNum, fmtPct, signColor } from '../format'
import { useScopedTrades } from '../useAnalysisData'

// Tools → Edge confidence. The statistics that decide whether any of the
// other numbers on this page can be trusted yet. These sit apart from the
// risk calculators because they answer a prior question: not "how much
// should I risk against this edge" but "is there an edge at all, or is
// this sample too small to say".

const DIRECTIONS = [
  { value: 'Buy', label: 'Buy' },
  { value: 'Sell', label: 'Sell' },
]

// ── TOOL 30 ──────────────────────────────────────────────────────────
export function EdgeConfidenceTool({ delay }) {
  const { trades } = useScopedTrades()
  const perf = useMemo(() => getPerformance(trades), [trades])

  const [wins, setWins] = useState('')
  const [losses, setLosses] = useState('')
  const [conf, setConf] = useState('95')

  // Default to the real record, but let it be overridden to test a
  // hypothetical: "how many more trades until this is convincing?"
  const w = wins === '' ? perf.winCount : wins
  const l = losses === '' ? perf.lossCount : losses

  const r = useMemo(() => winRateConfidence({ wins: w, losses: l, confidence: Number(conf) }), [w, l, conf])

  return (
    <Card delay={delay}>
      <CardHead
        icon={Sigma}
        title="Is the edge real?"
        sub={wins === '' && losses === '' ? 'from your log' : 'hypothetical'}
        hint="A Wilson score interval — the range the true win rate plausibly sits in, given how few trades any journal really has"
      />
      <div className="grid grid-cols-3" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Wins" value={wins} onChange={setWins} placeholder={String(perf.winCount)} />
        <Field label="Losses" value={losses} onChange={setLosses} placeholder={String(perf.lossCount)} />
        <SelectField
          label="Confidence"
          value={conf}
          onChange={setConf}
          options={[{ value: '90', label: '90%' }, { value: '95', label: '95%' }, { value: '99', label: '99%' }]}
        />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <>
            <ToolResult
              columns="grid-cols-2 sm:grid-cols-4"
              items={[
                { label: 'Observed', raw: r.observed, format: (v) => `${v.toFixed(1)}%`, big: true, color: 'var(--ta-accent)' },
                { label: 'Could be as low as', raw: r.low, format: (v) => `${v.toFixed(1)}%`, color: NEG },
                { label: 'Could be as high as', raw: r.high, format: (v) => `${v.toFixed(1)}%`, color: POS },
                { label: 'Range width', raw: r.width, format: (v) => `${v.toFixed(1)}pt`, hint: 'Narrower is more certain. This shrinks as the sample grows.' },
              ]}
            />

            {/* The interval drawn against the 50% break-even mark, which
                is the only comparison that actually decides anything. */}
            <div className="relative mt-1.5 h-5">
              <div className="absolute inset-x-0 top-2 h-1.5 rounded-full" style={{ backgroundColor: 'var(--ta-bg)', border: '1px solid var(--tad-border)' }} />
              <div
                className="absolute top-2 h-1.5 rounded-full"
                style={{
                  left: `${r.low}%`,
                  width: `${Math.max(1, r.width)}%`,
                  backgroundColor: r.beatsCoinFlip ? POS : r.worseThanCoinFlip ? NEG : 'var(--ta-accent)',
                }}
              />
              <div className="absolute top-0 h-5 w-px" style={{ left: '50%', backgroundColor: 'var(--ta-slate)' }} />
              <div
                className="absolute top-1 h-3 w-0.5 rounded"
                style={{ left: `${r.observed}%`, backgroundColor: 'var(--ta-ink)' }}
              />
            </div>
            <div className="flex justify-between" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
              <span>0%</span>
              <span>50% break-even</span>
              <span>100%</span>
            </div>

            <Verdict tone={r.beatsCoinFlip ? 'good' : r.worseThanCoinFlip ? 'bad' : 'warn'}>{r.note}</Verdict>
          </>
        )}
      </div>
    </Card>
  )
}

// ── TOOL 31 ──────────────────────────────────────────────────────────
export function SampleSizeTool({ delay }) {
  const { trades } = useScopedTrades()
  const perf = useMemo(() => getPerformance(trades), [trades])
  const [wr, setWr] = useState('')
  const [margin, setMargin] = useState('5')

  const effective = wr === '' ? (perf.winRate == null ? '' : perf.winRate.toFixed(1)) : wr
  const r = useMemo(() => sampleSizeNeeded({ winRatePct: effective, marginPct: margin }), [effective, margin])
  const resolved = perf.winCount + perf.lossCount

  return (
    <Card delay={delay}>
      <CardHead
        icon={Ruler}
        title="How many trades until you know"
        hint="The sample size a win rate needs before it can be stated with confidence"
      />
      <div className="grid grid-cols-2" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Win rate" value={wr} onChange={setWr} suffix="%" placeholder={perf.winRate == null ? '55' : perf.winRate.toFixed(0)} />
        <Field label="Accept ± margin" value={margin} onChange={setMargin} suffix="pt" hint="How precise the answer needs to be" />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <>
            <ToolResult
              columns="grid-cols-3"
              items={[
                { label: `Within ±${r.marginPct}pt`, raw: r.tradesNeeded, format: (v) => v.toLocaleString('en-IN'), big: true, color: 'var(--ta-accent)' },
                { label: 'To beat a coin flip', value: r.tradesToProveEdge == null ? '—' : r.tradesToProveEdge.toLocaleString('en-IN'), color: NEG },
                { label: 'You have', raw: resolved, format: (v) => v.toLocaleString('en-IN') },
              ]}
            />
            {r.tradesToProveEdge != null && (
              <div className="mt-1.5">
                <Bar pct={Math.min(100, (resolved / r.tradesToProveEdge) * 100)} color={resolved >= r.tradesToProveEdge ? POS : 'var(--ta-accent)'} height={7} />
                <div className="mt-0.5 flex justify-between" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
                  <span>{resolved} resolved so far</span>
                  <span>{Math.max(0, r.tradesToProveEdge - resolved).toLocaleString('en-IN')} to go</span>
                </div>
              </div>
            )}
            <Verdict tone="info">{r.note}</Verdict>
          </>
        )}
      </div>
    </Card>
  )
}

// ── TOOL 32 ──────────────────────────────────────────────────────────
export function TradeGraderTool({ delay }) {
  const { trades } = useScopedTrades()

  const instruments = useMemo(() => [...new Set(trades.map(stockLabel).filter(Boolean))].sort(), [trades])
  const timeframes = useMemo(() => [...new Set(trades.map((t) => t.timeframe).filter(Boolean))].sort(), [trades])

  const [instrument, setInstrument] = useState('')
  const [timeframe, setTimeframe] = useState('')
  const [direction, setDirection] = useState('Buy')

  const r = useMemo(
    () => tradeGrader(trades, { instrument, timeframe, direction }),
    [trades, instrument, timeframe, direction]
  )

  const gradeColor = (g) => (g === 'A' || g === 'B' ? POS : g === 'C' ? 'var(--ta-accent)' : NEG)

  return (
    <Card delay={delay}>
      <CardHead
        icon={Award}
        title="Grade a planned trade"
        hint="Scores a setup against how you have actually performed on that instrument, timeframe and direction — your own history, not a generic model"
      />
      <div className="grid grid-cols-3" style={{ gap: 'var(--tad-gap)' }}>
        <SelectField
          label="Instrument"
          value={instrument}
          onChange={setInstrument}
          options={[{ value: '', label: 'Any' }, ...instruments.map((i) => ({ value: i, label: i }))]}
        />
        <SelectField
          label="Timeframe"
          value={timeframe}
          onChange={setTimeframe}
          options={[{ value: '', label: 'Any' }, ...timeframes.map((t) => ({ value: t, label: t }))]}
        />
        <SelectField label="Direction" value={direction} onChange={setDirection} options={DIRECTIONS} />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : !r.graded ? (
          <Verdict tone="info">{r.note}</Verdict>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-extrabold"
                style={{
                  fontSize: 26,
                  color: gradeColor(r.grade),
                  backgroundColor: `color-mix(in srgb, ${gradeColor(r.grade)} 14%, transparent)`,
                  border: `2px solid ${gradeColor(r.grade)}`,
                }}
              >
                {r.grade}
              </div>
              <div className="min-w-0 flex-1">
                <StatRow label="Your baseline win rate" value={fmtPct(r.baseline, 1)} />
                <StatRow label="Expected on these choices" value={fmtPct(r.expectedWinRate, 1)} color={r.lift > 0 ? POS : NEG} strong />
                <StatRow label="Difference" value={`${r.lift > 0 ? '+' : ''}${r.lift.toFixed(1)}pt`} color={r.lift > 0 ? POS : NEG} />
              </div>
            </div>
            <div className="mt-1.5">
              <TableScroll maxHeight={110}>
                <table className="ta-table">
                  <thead>
                    <tr>
                      <th>Based on</th>
                      <th className="text-right">Trades</th>
                      <th className="text-right">Win %</th>
                      <th className="text-right">vs base</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.facets.map((f) => (
                      <tr key={f.label} style={f.reliable ? undefined : { opacity: 0.5 }}>
                        <td className="font-semibold">
                          {f.label}
                          {!f.reliable && f.count > 0 && (
                            <span style={{ color: 'var(--ta-slate)', fontSize: 'var(--tad-micro)' }}> · too few</span>
                          )}
                        </td>
                        <td className="text-right">{f.count}</td>
                        <td className="text-right">{fmtPct(f.winRate, 0)}</td>
                        <td className="text-right font-semibold" style={{ color: f.lift == null ? 'var(--ta-slate)' : f.lift > 0 ? POS : NEG }}>
                          {f.lift == null ? '—' : `${f.lift > 0 ? '+' : ''}${f.lift.toFixed(0)}pt`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            </div>
            <Verdict tone={r.lift >= 4 ? 'good' : r.lift <= -4 ? 'bad' : 'info'}>
              {r.note} Rows with fewer than five trades are greyed out and excluded from the grade.
            </Verdict>
          </>
        )}
      </div>
    </Card>
  )
}

// ── TOOL 33 ──────────────────────────────────────────────────────────
export function TrailingStopTool({ delay }) {
  const [entry, setEntry] = useState('')
  const [current, setCurrent] = useState('')
  const [atr, setAtr] = useState('')
  const [mult, setMult] = useState('3')
  const [pct, setPct] = useState('')
  const [dir, setDir] = useState('Long')

  const r = useMemo(
    () => trailingStop({ entry, currentPrice: current, atr, multiplier: mult, direction: dir, trailPct: pct }),
    [entry, current, atr, mult, dir, pct]
  )

  return (
    <Card delay={delay}>
      <CardHead icon={Move3d} title="Trailing stop" hint="Where to move a stop on a position that is already onside" />
      <div className="grid grid-cols-2 sm:grid-cols-6" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Entry" value={entry} onChange={setEntry} placeholder="4400" />
        <Field label="Now" value={current} onChange={setCurrent} placeholder="4460" />
        <Field label="ATR" value={atr} onChange={setAtr} placeholder="12" />
        <Field label="× ATR" value={mult} onChange={setMult} step="0.5" />
        <Field label="% trail" value={pct} onChange={setPct} suffix="%" placeholder="opt" />
        <SelectField label="Side" value={dir} onChange={setDir} options={[{ value: 'Long', label: 'Long' }, { value: 'Short', label: 'Short' }]} />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <>
            <div className="grid grid-cols-3" style={{ gap: 'var(--tad-gap)' }}>
              <Metric label="Open profit" raw={r.openProfit} format={(v) => fmtNum(v, 2)} color={signColor(r.openProfit)} big />
              <Metric label="As %" raw={r.openProfitPct} format={(v) => `${v.toFixed(2)}%`} color={signColor(r.openProfitPct)} />
              <Metric label="Tightest sensible" value={r.tightest ? fmtNum(r.tightest.price, 2) : '—'} color="var(--ta-accent)" />
            </div>
            <div className="mt-1.5">
              <TableScroll maxHeight={140}>
                <table className="ta-table">
                  <thead>
                    <tr>
                      <th>Level</th>
                      <th className="text-right">Price</th>
                      <th className="text-right">Locks in</th>
                    </tr>
                  </thead>
                  <tbody>
                    {r.levels.map((l) => (
                      <tr key={l.id} title={l.note}>
                        <td className="font-semibold">{l.label}</td>
                        <td className="text-right">{fmtNum(l.price, 2)}</td>
                        <td className="text-right font-semibold" style={{ color: signColor(l.locked) }}>
                          {l.locked === 0 ? '—' : fmtNum(l.locked, 2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            </div>
            <Verdict tone={r.inProfit ? 'good' : 'warn'}>{r.note}</Verdict>
          </>
        )}
      </div>
    </Card>
  )
}

// ── TOOL 34 ──────────────────────────────────────────────────────────
export function CostImpactTool({ delay, group }) {
  const toolInputs = useTradeAnalysisStore((s) => s.toolInputs)
  const setToolInput = useTradeAnalysisStore((s) => s.setToolInput)
  const { trades, symbol, label } = group

  const r = useMemo(
    () => costImpact(trades, { costPerTrade: toolInputs.costPerTrade, taxPct: toolInputs.taxPct }),
    [trades, toolInputs.costPerTrade, toolInputs.taxPct]
  )

  return (
    <Card delay={delay}>
      <CardHead
        icon={Receipt}
        title={`${label} cost drag`}
        hint="Applies your cost structure to every trade you actually logged, rather than to a hypothetical one"
      />
      <div className="grid grid-cols-2" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Round-trip cost" value={toolInputs.costPerTrade} onChange={(v) => setToolInput('costPerTrade', v)} placeholder="40" />
        <Field label="Turnover tax" value={toolInputs.taxPct} onChange={(v) => setToolInput('taxPct', v)} suffix="%" step="0.001" />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <>
            <ToolResult
              columns="grid-cols-2 sm:grid-cols-4"
              items={[
                { label: 'Gross P&L', raw: r.grossNet, format: (v) => fmtMoney(v, symbol, { signed: true, compact: true }), color: signColor(r.grossNet) },
                { label: 'Total drag', raw: r.totalDrag, format: (v) => fmtMoney(v, symbol, { compact: true }), color: NEG, big: true },
                { label: 'Net after costs', raw: r.netAfter, format: (v) => fmtMoney(v, symbol, { signed: true, compact: true }), color: signColor(r.netAfter), big: true },
                { label: 'Per trade', raw: r.perTradeDrag, format: (v) => fmtMoney(v, symbol), color: NEG },
              ]}
            />
            <div className="mt-1 border-t pt-1" style={{ borderColor: 'var(--tad-border)' }}>
              <StatRow label="Brokerage across all trades" value={fmtMoney(r.costTotal, symbol, { compact: true })} />
              {r.taxTotal > 0 && (
                <StatRow
                  label="Turnover tax"
                  value={fmtMoney(r.taxTotal, symbol, { compact: true })}
                  hint="Estimated from the price field, which is the only notional the trade form records"
                />
              )}
              <StatRow label="Drag as share of gross" value={fmtPct(r.dragPctOfGross, 1)} color={r.dragPctOfGross > 30 ? NEG : undefined} />
              <StatRow label="Winners costs would erase" value={`${r.flippedWinners} of ${r.winCount}`} color={r.flippedWinners ? NEG : POS} />
            </div>
            <Verdict tone={r.turnsProfitIntoLoss ? 'bad' : r.flippedWinners > 0 ? 'warn' : 'good'}>{r.note}</Verdict>
          </>
        )}
      </div>
    </Card>
  )
}
