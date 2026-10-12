import { useMemo, useState } from 'react'
import { CalendarDays, CalendarRange, Clock, Globe2, Hourglass, Sun, Timer } from 'lucide-react'
import {
  getCadenceStats, getDayOfWeekStats, getHourOfDayStats, getMonthOfYearStats, getSessionStats, getTimeHeatmap,
} from '../../../../../utils/tradeAnalyticsTime'
import { getCalendarMonths } from '../../../../../utils/tradeAnalytics'
import { BarRow, Card, CardHead, Empty, Grid, Metric, Pill, SectionTitle, Segmented, StatRow, Verdict } from '../ui'
import { NEG, POS, fmtDate, fmtMoney, fmtNum, fmtPct } from '../format'
import { HeatGrid } from '../charts'
import { useCurrencyGroups, useScopedTrades } from '../useAnalysisData'

// Analysis → Timing. When the edge shows up. Hour-of-day and session
// figures read the `createdAt` timestamp, which is when the trade was
// logged — the closest honest proxy for entry time the form captures, and
// labelled as such wherever it appears.

const METRIC_OPTIONS = [
  { id: 'trades', label: 'Count' },
  { id: 'winRate', label: 'Win %' },
  { id: 'pnl', label: 'P&L' },
]

/** One reusable bucket list — weekday, month, hour all share this shape. */
function BucketCard({ title, icon, buckets, delay, symbol, sub, hint, labelWidth = 30, emptyText }) {
  const [metric, setMetric] = useState('trades')
  const rows = buckets.filter((b) => b.trades > 0)

  const maxCount = Math.max(...buckets.map((b) => b.trades), 1)
  const maxAbsPnl = Math.max(...buckets.map((b) => Math.abs(b.pnl || 0)), 1)

  const pctFor = (b) => {
    if (metric === 'trades') return (b.trades / maxCount) * 100
    if (metric === 'winRate') return b.winRate ?? 0
    return (Math.abs(b.pnl || 0) / maxAbsPnl) * 100
  }
  const valueFor = (b) => {
    if (metric === 'trades') return `${b.trades}`
    if (metric === 'winRate') return fmtPct(b.winRate, 0)
    return b.withPnl ? fmtMoney(b.pnl, symbol, { signed: true, compact: true }) : '—'
  }
  const colorFor = (b) => {
    if (metric === 'trades') return 'var(--ta-accent)'
    if (metric === 'winRate') return b.winRate == null ? 'var(--ta-slate)' : b.winRate >= 50 ? POS : NEG
    return b.pnl > 0 ? POS : b.pnl < 0 ? NEG : 'var(--ta-slate)'
  }

  return (
    <Card delay={delay}>
      <CardHead
        icon={icon}
        title={title}
        sub={sub}
        hint={hint}
        right={<Segmented size="xs" value={metric} onChange={setMetric} options={METRIC_OPTIONS} layoutId={`bucket-${title}`} />}
      />
      {!rows.length ? (
        <Empty>{emptyText || 'Nothing logged in this range.'}</Empty>
      ) : (
        <div className="flex flex-col gap-0.5">
          {rows.map((b, i) => (
            <BarRow
              key={b.label}
              label={b.label}
              pct={pctFor(b)}
              value={valueFor(b)}
              color={colorFor(b)}
              labelWidth={labelWidth}
              valueWidth={52}
              delay={i * 0.025}
              title={`${b.trades} trades · ${b.wins}W ${b.losses}L${b.withPnl ? ` · net ${fmtMoney(b.pnl, symbol, { signed: true })}` : ''}`}
            />
          ))}
        </div>
      )}
    </Card>
  )
}

// ── F54 sessions ─────────────────────────────────────────────────────
function SessionCard({ trades, delay }) {
  const sessions = useMemo(() => getSessionStats(trades), [trades])
  const max = Math.max(...sessions.map((s) => s.trades), 1)
  const ranked = [...sessions].filter((s) => s.wins + s.losses >= 3).sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0))

  return (
    <Card delay={delay}>
      <CardHead
        icon={Globe2}
        title="Trading sessions"
        hint="Session windows in IST, matched against the time each trade was logged"
      />
      {!sessions.length ? (
        <Empty>No timestamps available on these trades.</Empty>
      ) : (
        <>
          <div className="flex flex-col gap-0.5">
            {sessions.map((s, i) => (
              <BarRow
                key={s.id}
                label={s.label}
                pct={(s.trades / max) * 100}
                value={s.winRate == null ? `${s.trades}` : fmtPct(s.winRate, 0)}
                color={s.winRate == null ? 'var(--ta-slate)' : s.winRate >= 50 ? POS : NEG}
                labelWidth={54}
                valueWidth={40}
                delay={i * 0.03}
                title={`${s.trades} trades · ${s.wins}W ${s.losses}L`}
              />
            ))}
          </div>
          {ranked.length >= 2 && (
            <Verdict tone={ranked[0].winRate - ranked[ranked.length - 1].winRate >= 20 ? 'good' : 'info'}>
              Strongest window is {ranked[0].label} at {fmtPct(ranked[0].winRate, 0)}; weakest is{' '}
              {ranked[ranked.length - 1].label} at {fmtPct(ranked[ranked.length - 1].winRate, 0)}.
            </Verdict>
          )}
        </>
      )}
    </Card>
  )
}

// ── F60, F61 cadence ─────────────────────────────────────────────────
function CadenceCard({ trades, delay }) {
  const c = useMemo(() => getCadenceStats(trades), [trades])

  return (
    <Card delay={delay}>
      <CardHead icon={Timer} title="Cadence" hint="How often you trade and how long the gaps run" />
      {c.tradesPerWeek == null ? (
        <Empty>Two or more trades are needed to measure cadence.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-4" style={{ gap: 'var(--tad-gap)' }}>
            <Metric label="Per week" value={fmtNum(c.tradesPerWeek, 1)} big />
            <Metric label="Avg gap" value={`${fmtNum(c.avgGapDays, 1)}d`} />
            <Metric label="Longest gap" value={`${c.maxGapDays}d`} color={c.maxGapDays > 30 ? NEG : undefined} />
            <Metric label="Active days" raw={c.activeDays} sub={`of ${c.spanDays}`} />
          </div>
          <div className="mt-1 border-t pt-1" style={{ borderColor: 'var(--tad-border)' }}>
            <StatRow label="First trade in range" value={fmtDate(c.firstDate)} />
            <StatRow label="Most recent" value={fmtDate(c.lastDate)} />
            {c.busiestDay && <StatRow label="Busiest day" value={`${fmtDate(c.busiestDay.date)} · ${c.busiestDay.trades} trades`} />}
          </div>
        </>
      )}
    </Card>
  )
}

// ── F53 day × hour heatmap ───────────────────────────────────────────
function TimeHeatmapCard({ trades, symbol, delay }) {
  const [mode, setMode] = useState('count')
  const hm = useMemo(() => getTimeHeatmap(trades), [trades])

  if (!hm.activeHours.length) {
    return (
      <Card delay={delay} span="lg:col-span-2">
        <CardHead icon={Clock} title="When you trade" />
        <Empty>No timestamps available on these trades.</Empty>
      </Card>
    )
  }

  const columns = hm.activeHours.map((h) => `${String(h).padStart(2, '0')}`)
  const cells = hm.grid.map((row) => hm.activeHours.map((h) => row.cells[h]))

  return (
    <Card delay={delay} span="lg:col-span-2">
      <CardHead
        icon={Clock}
        title="When you trade"
        sub="hour of day, local time"
        hint="Based on when each trade was logged in the app"
        right={
          <Segmented
            size="xs"
            value={mode}
            onChange={setMode}
            options={[{ id: 'count', label: 'Count' }, { id: 'pnl', label: 'P&L' }]}
            layoutId="heatmap-mode"
          />
        }
      />
      <HeatGrid
        rows={hm.grid.map((r) => r.label)}
        columns={columns}
        cells={cells}
        diverging={mode === 'pnl'}
        cellMin={24}
        valueOf={(c) => (mode === 'count' ? c.count || null : c.count ? c.pnl : null)}
        render={(c, full) => {
          if (!c.count) return '·'
          if (full) return `${c.count} trades · ${c.wins}W ${c.losses}L · net ${fmtMoney(c.pnl, symbol, { signed: true })}`
          return mode === 'count' ? c.count : c.pnl === 0 ? '·' : fmtMoney(c.pnl, '', { compact: true, signed: false })
        }}
      />
      <Verdict>Darker cells carry more {mode === 'count' ? 'trades' : 'profit or loss'}. Only hours with activity are shown.</Verdict>
    </Card>
  )
}

// ── Calendar with per-day outcome markers ────────────────────────────
function CalendarCard({ trades, delay }) {
  const [months, setMonths] = useState(2)
  const data = useMemo(() => getCalendarMonths(trades, months), [trades, months])
  const dows = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

  return (
    <Card delay={delay} span="lg:col-span-2">
      <CardHead
        icon={CalendarDays}
        title="Trading calendar"
        right={
          <Segmented
            size="xs"
            value={String(months)}
            onChange={(v) => setMonths(Number(v))}
            options={[{ id: '1', label: '1m' }, { id: '2', label: '2m' }, { id: '4', label: '4m' }]}
            layoutId="cal-months"
          />
        }
      />
      <div className="ta-scroll ta-scroll-x">
        <div className="flex gap-2" style={{ minWidth: months * 160 }}>
          {data.map((m) => (
            <div key={m.label} className="min-w-[150px] flex-1">
              <div className="mb-0.5 text-center font-bold" style={{ fontSize: 'var(--tad-label)', color: 'var(--ta-ink)' }}>
                {m.label}
              </div>
              <div className="grid grid-cols-7 gap-px">
                {dows.map((d, i) => (
                  <div key={i} className="text-center font-semibold" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)' }}>
                    {d}
                  </div>
                ))}
                {m.cells.map((cell, i) =>
                  cell === null ? (
                    <div key={`b${i}`} />
                  ) : (
                    <div
                      key={cell.day}
                      title={
                        cell.added
                          ? `${fmtDate(cell.date)} — ${cell.added} trade${cell.added > 1 ? 's' : ''}: ${cell.targetHit}W ${cell.slHit}L ${cell.pending} open`
                          : fmtDate(cell.date)
                      }
                      className="flex aspect-square items-center justify-center rounded-[3px] font-semibold transition-transform hover:scale-125"
                      style={{
                        fontSize: 'var(--tad-micro)',
                        border: '1px solid var(--tad-border)',
                        backgroundColor: !cell.added
                          ? 'transparent'
                          : cell.targetHit > cell.slHit
                            ? 'rgba(22,163,74,0.28)'
                            : cell.slHit > cell.targetHit
                              ? 'rgba(220,38,38,0.28)'
                              : 'color-mix(in srgb, var(--ta-accent) 22%, transparent)',
                        color: cell.added ? 'var(--ta-ink)' : 'var(--ta-slate)',
                        opacity: cell.added ? 1 : 0.4,
                      }}
                    >
                      {cell.day}
                    </div>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1 flex flex-wrap gap-2">
        <Pill color={POS}>Mostly wins</Pill>
        <Pill color={NEG}>Mostly losses</Pill>
        <Pill color="var(--ta-accent)">Mixed / open</Pill>
      </div>
    </Card>
  )
}

export default function TimeSection() {
  const { trades } = useScopedTrades()
  const groups = useCurrencyGroups()
  const symbol = groups.length === 1 ? groups[0].symbol : ''

  const dow = useMemo(() => getDayOfWeekStats(trades), [trades])
  const moy = useMemo(() => getMonthOfYearStats(trades), [trades])
  const hod = useMemo(() => getHourOfDayStats(trades), [trades])

  return (
    <div className="flex flex-col" style={{ gap: 'var(--tad-gap)' }}>
      {groups.length > 1 && (
        <div
          className="rounded-lg px-2 py-1"
          style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-slate)', backgroundColor: 'var(--ta-bg)', border: '1px solid var(--tad-border)' }}
        >
          You trade in two settlement currencies. Counts and win rates below cover everything; P&amp;L
          figures mix ₹ and $ and are only meaningful as a direction, not a total — the Performance tab keeps them separate.
        </div>
      )}

      <SectionTitle icon={Sun} title="Rhythm" />
      <Grid cols="grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        <BucketCard title="Day of week" icon={CalendarDays} buckets={dow} delay={0.02} symbol={symbol} labelWidth={28} />
        <BucketCard title="Month of year" icon={CalendarRange} buckets={moy} delay={0.05} symbol={symbol} labelWidth={26} emptyText="No months with activity in this range." />
        <BucketCard
          title="Hour logged"
          icon={Clock}
          buckets={hod}
          delay={0.08}
          symbol={symbol}
          labelWidth={34}
          hint="Based on when the trade was logged in the app"
          emptyText="No timestamps available."
        />
      </Grid>

      <SectionTitle icon={Globe2} title="Sessions & cadence" />
      <Grid cols="grid-cols-1 lg:grid-cols-2">
        <SessionCard trades={trades} delay={0.02} />
        <CadenceCard trades={trades} delay={0.05} />
      </Grid>

      <SectionTitle icon={Hourglass} title="Activity map" />
      <Grid cols="grid-cols-1 lg:grid-cols-2">
        <TimeHeatmapCard trades={trades} symbol={symbol} delay={0.02} />
        <CalendarCard trades={trades} delay={0.05} />
      </Grid>
    </div>
  )
}
