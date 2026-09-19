import { useMemo, useState } from 'react'
import { ArrowLeftRight, Boxes, Grid3x3, Layers, Link2, PieChart, Target, TrendingUp } from 'lucide-react'
import {
  getConcentration, getDirectionMatrix, getDirectionStats, getEdgeMatrix, getInstrumentCorrelation, getInstrumentStats, getInstrumentTypeStats, getTimeframeStats, rankEdge,
} from '../../../../../utils/tradeAnalyticsEdge'
import {
  BarRow, Card, CardHead, Empty, Grid, Metric, SectionTitle, Segmented, StatRow, TableScroll,
  Verdict,
} from '../ui'
import { NEG, POS, fmtMoney, fmtNum, fmtPct, signColor } from '../format'
import { Donut, HeatGrid, StackedBar } from '../charts'
import { useCurrencyGroups, useScopedTrades } from '../useAnalysisData'

// Analysis → Edge. Where the money actually comes from: which instrument,
// which timeframe, which direction. Groups are ranked on expectancy and
// profit factor rather than raw frequency, and every ranking is damped by
// sample size so three lucky trades can't top the table.

const SORTS = [
  { id: 'edge', label: 'Edge' },
  { id: 'net', label: 'Net' },
  { id: 'count', label: 'Count' },
  { id: 'win', label: 'Win %' },
]

function GroupTable({ groups, symbol, sort, title }) {
  const rows = useMemo(() => {
    const ranked = rankEdge(groups)
    const byKey = new Map(ranked.map((r) => [r.key, r]))
    const merged = groups.map((g) => ({ ...g, edgeScore: byKey.get(g.key)?.edgeScore ?? null, confidence: byKey.get(g.key)?.confidence ?? 0 }))
    const cmp = {
      edge: (a, b) => (b.edgeScore ?? -1) - (a.edgeScore ?? -1),
      net: (a, b) => b.netPnl - a.netPnl,
      count: (a, b) => b.count - a.count,
      win: (a, b) => (b.winRate ?? -1) - (a.winRate ?? -1),
    }[sort]
    return [...merged].sort(cmp)
  }, [groups, sort])

  if (!rows.length) return <Empty>Nothing to rank in this range.</Empty>

  return (
    <TableScroll maxHeight={260}>
      <table className="ta-table">
        <thead>
          <tr>
            <th>{title}</th>
            <th className="text-right">Trades</th>
            <th className="text-right">Win %</th>
            <th className="text-right">Net</th>
            <th className="text-right">Expect.</th>
            <th className="text-right">PF</th>
            <th className="text-right">Edge</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((g) => (
            <tr key={g.key}>
              <td className="truncate font-semibold" style={{ maxWidth: 150 }} title={g.key}>{g.key}</td>
              <td className="text-right">{g.count}</td>
              <td className="text-right" style={{ color: g.winRate == null ? 'var(--ta-slate)' : g.winRate >= 50 ? POS : NEG }}>
                {fmtPct(g.winRate, 0)}
              </td>
              <td className="text-right font-semibold" style={{ color: signColor(g.netPnl) }}>
                {g.withPnl ? fmtMoney(g.netPnl, symbol, { signed: true, compact: true }) : '—'}
              </td>
              <td className="text-right" style={{ color: signColor(g.expectancy) }}>
                {g.withPnl ? fmtMoney(g.expectancy, symbol, { signed: true, compact: true }) : '—'}
              </td>
              <td className="text-right">{fmtNum(g.profitFactor, 2)}</td>
              <td className="text-right">
                {g.edgeScore == null ? (
                  <span style={{ color: 'var(--ta-slate)' }}>—</span>
                ) : (
                  <span
                    className="ta-num font-bold"
                    title={`Confidence ${g.confidence}% — scores from small samples are pulled towards the middle`}
                    style={{ color: g.edgeScore >= 60 ? POS : g.edgeScore < 40 ? NEG : 'var(--ta-ink)', opacity: 0.45 + (g.confidence / 100) * 0.55 }}
                  >
                    {g.edgeScore}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableScroll>
  )
}

function InstrumentCard({ group, delay }) {
  const { trades, symbol, label } = group
  const [sort, setSort] = useState('edge')
  const groups = useMemo(() => getInstrumentStats(trades), [trades])

  return (
    <Card delay={delay}>
      <CardHead
        icon={Boxes}
        title={`${label} by instrument`}
        sub={`${groups.length} names`}
        hint="Edge score blends win rate, expectancy and profit factor, then damps the result by sample size"
        right={<Segmented size="xs" value={sort} onChange={setSort} options={SORTS} layoutId={`inst-sort-${group.id}`} />}
      />
      <GroupTable groups={groups} symbol={symbol} sort={sort} title="Instrument" />
    </Card>
  )
}

function TimeframeCard({ group, delay }) {
  const { trades, symbol, label } = group
  const [sort, setSort] = useState('edge')
  const groups = useMemo(() => getTimeframeStats(trades), [trades])

  return (
    <Card delay={delay}>
      <CardHead
        icon={Layers}
        title={`${label} by timeframe`}
        sub={`${groups.length} used`}
        right={<Segmented size="xs" value={sort} onChange={setSort} options={SORTS} layoutId={`tf-sort-${group.id}`} />}
      />
      <GroupTable groups={groups} symbol={symbol} sort={sort} title="Timeframe" />
    </Card>
  )
}

// ── F74 direction ────────────────────────────────────────────────────
function DirectionCard({ group, delay }) {
  const { trades, symbol, label } = group
  const dirs = useMemo(() => getDirectionStats(trades), [trades])
  const buy = dirs.find((d) => d.key === 'Buy') || { count: 0 }
  const sell = dirs.find((d) => d.key === 'Sell') || { count: 0 }

  return (
    <Card delay={delay}>
      <CardHead icon={ArrowLeftRight} title={`${label} long vs short`} />
      {!buy.count && !sell.count ? (
        <Empty>No trades in range.</Empty>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Donut
              size={60}
              stroke={9}
              segments={[
                { label: 'Buy', value: buy.count, color: POS },
                { label: 'Sell', value: sell.count, color: NEG },
              ]}
              centerTop={`${buy.count + sell.count}`}
              centerBottom="trades"
            />
            <div className="min-w-0 flex-1">
              <StatRow label={`Buy · ${buy.count}`} value={fmtPct(buy.winRate, 0)} color={POS} strong />
              <StatRow label={`Sell · ${sell.count}`} value={fmtPct(sell.winRate, 0)} color={NEG} strong />
              <StatRow label="Buy net" value={buy.withPnl ? fmtMoney(buy.netPnl, symbol, { signed: true, compact: true }) : '—'} color={signColor(buy.netPnl)} />
              <StatRow label="Sell net" value={sell.withPnl ? fmtMoney(sell.netPnl, symbol, { signed: true, compact: true }) : '—'} color={signColor(sell.netPnl)} />
            </div>
          </div>
          <Verdict tone="info">
            {buy.winRate != null && sell.winRate != null && Math.abs(buy.winRate - sell.winRate) >= 20
              ? `A ${Math.abs(buy.winRate - sell.winRate).toFixed(0)} point gap between sides — worth checking whether one direction is being forced.`
              : 'Both directions perform similarly.'}
          </Verdict>
        </>
      )}
    </Card>
  )
}

// ── F80 instrument × timeframe matrix ────────────────────────────────
function EdgeMatrixCard({ group, delay }) {
  const { trades, symbol, label } = group
  const [mode, setMode] = useState('pnl')
  const m = useMemo(() => getEdgeMatrix(trades), [trades])

  if (!m.instruments.length || !m.timeframes.length) {
    return (
      <Card delay={delay} span="lg:col-span-2">
        <CardHead icon={Grid3x3} title={`${label} instrument × timeframe`} />
        <Empty>Not enough variety yet to build a grid.</Empty>
      </Card>
    )
  }

  const cells = m.rows.map((r) => r.cells)

  return (
    <Card delay={delay} span="lg:col-span-2">
      <CardHead
        icon={Grid3x3}
        title={`${label} instrument × timeframe`}
        hint="Every combination you have actually traded. Blank cells are combinations you have never taken."
        right={
          <Segmented
            size="xs"
            value={mode}
            onChange={setMode}
            options={[{ id: 'pnl', label: 'P&L' }, { id: 'win', label: 'Win %' }, { id: 'count', label: 'Count' }]}
            layoutId={`matrix-${group.id}`}
          />
        }
      />
      <HeatGrid
        rows={m.instruments}
        columns={m.timeframes}
        cells={cells}
        title="Instrument"
        diverging={mode === 'pnl'}
        cellMin={mode === 'pnl' ? 44 : 30}
        valueOf={(c) => {
          if (!c.count) return null
          if (mode === 'pnl') return c.withPnl ? c.netPnl : null
          if (mode === 'win') return c.winRate
          return c.count
        }}
        render={(c, full) => {
          if (!c.count) return '·'
          if (full) {
            return `${c.count} trades · ${c.wins}W ${c.losses}L${c.withPnl ? ` · net ${fmtMoney(c.netPnl, symbol, { signed: true })}` : ''}`
          }
          if (mode === 'pnl') return c.withPnl ? fmtMoney(c.netPnl, '', { signed: true, compact: true }) : '·'
          if (mode === 'win') return c.winRate == null ? '·' : `${Math.round(c.winRate)}`
          return c.count
        }}
      />
    </Card>
  )
}

// ── F81 direction × timeframe ────────────────────────────────────────
function DirectionMatrixCard({ group, delay }) {
  const { trades, label } = group
  const rows = useMemo(() => getDirectionMatrix(trades), [trades])

  return (
    <Card delay={delay}>
      <CardHead icon={Target} title={`${label} side by timeframe`} />
      {!rows.length ? (
        <Empty>No trades in range.</Empty>
      ) : (
        <TableScroll maxHeight={220}>
          <table className="ta-table">
            <thead>
              <tr>
                <th>TF</th>
                <th className="text-right">Buy n</th>
                <th className="text-right">Buy %</th>
                <th className="text-right">Sell n</th>
                <th className="text-right">Sell %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.tf}>
                  <td className="font-semibold">{r.tf}</td>
                  <td className="text-right">{r.buy.count}</td>
                  <td className="text-right" style={{ color: r.buy.winRate == null ? 'var(--ta-slate)' : r.buy.winRate >= 50 ? POS : NEG }}>
                    {fmtPct(r.buy.winRate, 0)}
                  </td>
                  <td className="text-right">{r.sell.count}</td>
                  <td className="text-right" style={{ color: r.sell.winRate == null ? 'var(--ta-slate)' : r.sell.winRate >= 50 ? POS : NEG }}>
                    {fmtPct(r.sell.winRate, 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableScroll>
      )}
    </Card>
  )
}

// ── F73, F86 concentration ───────────────────────────────────────────
function ConcentrationCard({ trades, delay }) {
  const c = useMemo(() => getConcentration(trades), [trades])
  const types = useMemo(() => getInstrumentTypeStats(trades), [trades])

  return (
    <Card delay={delay}>
      <CardHead icon={PieChart} title="Concentration" hint="Herfindahl-Hirschman index — the same measure regulators use for market concentration" />
      {c.hhi == null ? (
        <Empty>No trades in range.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-3" style={{ gap: 'var(--tad-gap)' }}>
            <Metric label="Effective names" value={fmtNum(c.effectiveCount, 1)} big hint="Inverse HHI — how many instruments you genuinely spread across" />
            <Metric label="Unique traded" raw={c.uniqueCount} />
            <Metric label="Spread score" value={`${c.diversificationScore}`} color={c.diversificationScore > 60 ? POS : NEG} />
          </div>
          <div className="mt-1.5 border-t pt-1.5" style={{ borderColor: 'var(--tad-border)' }}>
            <StackedBar
              segments={types.map((t, i) => ({
                label: t.key,
                value: t.count,
                color: ['var(--ta-accent)', POS, '#7c3aed'][i % 3],
              }))}
            />
          </div>
          <div className="mt-1 flex flex-col gap-0.5">
            {c.top.map((t, i) => (
              <BarRow key={t.name} label={t.name} pct={t.sharePct} value={fmtPct(t.sharePct, 0)} labelWidth={82} valueWidth={34} delay={i * 0.03} />
            ))}
          </div>
          <Verdict tone={c.hhi > 0.35 ? 'warn' : 'good'}>{c.verdict}</Verdict>
        </>
      )}
    </Card>
  )
}

// ── F85 correlation ──────────────────────────────────────────────────
function CorrelationCard({ trades, delay }) {
  const c = useMemo(() => getInstrumentCorrelation(trades), [trades])

  if (!c.available) {
    return (
      <Card delay={delay}>
        <CardHead icon={Link2} title="Instrument correlation" />
        <Empty>Two or more instruments with three or more P&amp;L values each are needed.</Empty>
      </Card>
    )
  }

  return (
    <Card delay={delay}>
      <CardHead
        icon={Link2}
        title="Instrument correlation"
        hint="Daily P&L correlation on days where both were traded. Blank means too few shared days to say."
      />
      <HeatGrid
        rows={c.instruments}
        columns={c.instruments.map((i) => (i.length > 6 ? `${i.slice(0, 6)}…` : i))}
        cells={c.matrix}
        title=""
        diverging
        cellMin={34}
        valueOf={(cell) => (cell.r == null ? null : cell.r * 100)}
        render={(cell, full) => {
          if (cell.r == null) return '·'
          if (full) return `${cell.a} vs ${cell.b}: r = ${cell.r.toFixed(2)} over ${cell.overlap} shared days`
          return cell.r.toFixed(2)
        }}
      />
      <Verdict>
        Values near +1 move together, near -1 move opposite. Two strongly correlated positions are closer to one
        double-sized position than to two independent bets.
      </Verdict>
    </Card>
  )
}

export default function EdgeSection() {
  const { trades } = useScopedTrades()
  const groups = useCurrencyGroups()
  const dual = groups.length > 1

  return (
    <div className="flex flex-col" style={{ gap: 'var(--tad-gap)' }}>
      <SectionTitle icon={TrendingUp} title="Ranked edge" sub="scores damp small samples towards the middle" />
      <Grid cols={dual ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1 lg:grid-cols-2'}>
        {groups.map((g, i) => <InstrumentCard key={g.id} group={g} delay={i * 0.03} />)}
        {groups.map((g, i) => <TimeframeCard key={g.id} group={g} delay={0.06 + i * 0.03} />)}
      </Grid>

      <SectionTitle icon={ArrowLeftRight} title="Direction" />
      <Grid cols="grid-cols-1 lg:grid-cols-2">
        {groups.map((g, i) => <DirectionCard key={g.id} group={g} delay={i * 0.03} />)}
        {groups.map((g, i) => <DirectionMatrixCard key={g.id} group={g} delay={0.06 + i * 0.03} />)}
      </Grid>

      <SectionTitle icon={Grid3x3} title="Combination grid" />
      <Grid cols="grid-cols-1 lg:grid-cols-2">
        {groups.map((g, i) => <EdgeMatrixCard key={g.id} group={g} delay={i * 0.04} />)}
      </Grid>

      <SectionTitle icon={PieChart} title="Exposure" />
      <Grid cols="grid-cols-1 lg:grid-cols-2">
        <ConcentrationCard trades={trades} delay={0.02} />
        <CorrelationCard trades={trades} delay={0.05} />
      </Grid>
    </div>
  )
}
