import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronLeft, ChevronRight, Download, FileJson, Image as ImageIcon, Pause, Play, Search, Table2, Upload, X,
} from 'lucide-react'
import { buildReplay, csvToTrades, queryTrades, tradesToCsv } from '../../../../../utils/tradeTools'
import { hasPnl, parseDate, pnlOf, stockLabel } from '../../../../../utils/tradeAnalyticsPro'
import { symbolForType } from '../../../../../utils/currency'
import { useTradeAnalysisStore } from '../../../../../store/tradeAnalysisStore'
import { useUiStore } from '../../../../../store/uiStore'
import {
  Card, CardHead, Empty, Field, Metric, MiniButton, Pill, ScrollBox, SelectField, StatRow,
  TableScroll, ToolError, Verdict,
} from '../ui'
import { NEG, POS, fmtDate, fmtMoney, fmtPct, signColor } from '../format'
import { Sparkline } from '../charts'
import { useScopedTrades } from '../useAnalysisData'

// Tools → Data. Getting trades in, out, and back under the microscope.
// Everything operates on the real store, so an import genuinely adds rows
// and an export genuinely contains the journal.

const downloadBlob = (content, filename, type) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke on the next tick so the download has definitely started.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const stamp = () => new Date().toISOString().slice(0, 10)

// ── TOOL 20 — Query console ──────────────────────────────────────────
export function QueryConsoleTool({ delay }) {
  const { trades } = useScopedTrades()
  const [text, setText] = useState('')
  const [sortBy, setSortBy] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [minPnl, setMinPnl] = useState('')
  const [minScore, setMinScore] = useState('')
  const [outcome, setOutcome] = useState('')
  const [tf, setTf] = useState('')

  const timeframes = useMemo(() => [...new Set(trades.map((t) => t.timeframe).filter(Boolean))], [trades])

  const result = useMemo(
    () =>
      queryTrades(trades, {
        text,
        sortBy,
        sortDir,
        minPnl: minPnl === '' ? null : Number(minPnl),
        minScore: minScore === '' ? null : Number(minScore),
        outcomes: outcome ? [outcome] : [],
        timeframes: tf ? [tf] : [],
      }),
    [trades, text, sortBy, sortDir, minPnl, minScore, outcome, tf]
  )

  const exportResult = () => {
    if (!result.rows.length) return
    downloadBlob(tradesToCsv(result.rows), `trade-query-${stamp()}.csv`, 'text/csv;charset=utf-8')
    useUiStore.getState().showToast(`Exported ${result.rows.length} matching trades`)
  }

  return (
    <Card delay={delay} span="lg:col-span-2">
      <CardHead
        icon={Search}
        title="Query console"
        sub={`${result.count} of ${result.totalCount}`}
        right={<MiniButton icon={Download} onClick={exportResult} disabled={!result.rows.length}>Export matches</MiniButton>}
      />
      <div className="grid grid-cols-2 sm:grid-cols-6" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Search" value={text} onChange={setText} type="text" placeholder="name, notes, pair…" />
        <Field label="Min P&L" value={minPnl} onChange={setMinPnl} placeholder="any" />
        <Field label="Min score" value={minScore} onChange={setMinScore} suffix="%" placeholder="any" />
        <SelectField
          label="Outcome"
          value={outcome}
          onChange={setOutcome}
          options={[{ value: '', label: 'Any' }, { value: 'win', label: 'Wins' }, { value: 'loss', label: 'Losses' }, { value: 'open', label: 'Open' }]}
        />
        <SelectField
          label="Timeframe"
          value={tf}
          onChange={setTf}
          options={[{ value: '', label: 'Any' }, ...timeframes.map((t) => ({ value: t, label: t }))]}
        />
        <SelectField
          label="Sort"
          value={`${sortBy}:${sortDir}`}
          onChange={(v) => {
            const [a, b] = v.split(':')
            setSortBy(a)
            setSortDir(b)
          }}
          options={[
            { value: 'date:desc', label: 'Newest' },
            { value: 'date:asc', label: 'Oldest' },
            { value: 'pnl:desc', label: 'Best P&L' },
            { value: 'pnl:asc', label: 'Worst P&L' },
            { value: 'score:desc', label: 'Top score' },
            { value: 'name:asc', label: 'Name A–Z' },
          ]}
        />
      </div>

      <div className="mt-1.5 grid grid-cols-4" style={{ gap: 'var(--tad-gap)' }}>
        <Metric label="Matches" raw={result.count} />
        <Metric label="Win rate" value={fmtPct(result.winRate, 0)} color={result.winRate >= 50 ? POS : NEG} />
        <Metric label="W / L" value={`${result.wins} / ${result.losses}`} />
        <Metric
          label="Net P&L"
          value={result.withPnl ? fmtMoney(result.netPnl, '', { signed: true, compact: true }) : '—'}
          color={signColor(result.netPnl)}
          hint="Mixed currency when both Equity and Forex trades match — read it as a direction, not a total"
        />
      </div>

      <div className="mt-1.5">
        {!result.rows.length ? (
          <Empty>Nothing matches these filters.</Empty>
        ) : (
          <TableScroll maxHeight={260}>
            <table className="ta-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Instrument</th>
                  <th>TF</th>
                  <th>Side</th>
                  <th className="text-right">Score</th>
                  <th className="text-right">P&L</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 200).map((t) => {
                  const s = t.validationScore
                  const sym = symbolForType(t.instrumentType)
                  return (
                    <tr key={t.id}>
                      <td>{fmtDate(parseDate(t))}</td>
                      <td className="truncate font-semibold" style={{ maxWidth: 140 }} title={stockLabel(t)}>{stockLabel(t)}</td>
                      <td>{t.timeframe}</td>
                      <td style={{ color: t.direction === 'Sell' ? NEG : POS }}>{t.direction}</td>
                      <td className="text-right">{s?.total ? `${Math.round((s.checked / s.total) * 100)}%` : '—'}</td>
                      <td className="text-right font-semibold" style={{ color: hasPnl(t) ? signColor(pnlOf(t)) : 'var(--ta-slate)' }}>
                        {hasPnl(t) ? fmtMoney(pnlOf(t), sym, { signed: true, compact: true }) : '—'}
                      </td>
                      <td>
                        <Pill color={t.status === 'Target Hit' ? POS : t.status === 'SL Hit' ? NEG : 'var(--ta-accent)'}>
                          {t.status || 'Pending'}
                        </Pill>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </div>
      {result.rows.length > 200 && <Verdict>Showing the first 200 matches. Narrow the filters or export to see everything.</Verdict>}
    </Card>
  )
}

// ── TOOL 21 & 22 — CSV export / import ───────────────────────────────
export function CsvTool({ delay }) {
  const allTrades = useTradeAnalysisStore((s) => s.trades)
  const importTrades = useTradeAnalysisStore((s) => s.importTrades)
  const { trades: scopedTrades } = useScopedTrades()
  const fileRef = useRef(null)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')

  const exportAll = () => {
    if (!allTrades.length) return
    downloadBlob(tradesToCsv(allTrades), `trades-${stamp()}.csv`, 'text/csv;charset=utf-8')
    useUiStore.getState().showToast(`Exported ${allTrades.length} trades to CSV`)
  }

  const exportScoped = () => {
    if (!scopedTrades.length) return
    downloadBlob(tradesToCsv(scopedTrades), `trades-in-range-${stamp()}.csv`, 'text/csv;charset=utf-8')
    useUiStore.getState().showToast(`Exported ${scopedTrades.length} trades in the current range`)
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setPreview(null)
    try {
      const text = await file.text()
      const parsed = csvToTrades(text)
      if (!parsed.ok) {
        setError(parsed.error)
        return
      }
      setPreview(parsed)
    } catch (err) {
      setError(`Could not read that file: ${err.message}`)
    }
  }

  const confirmImport = () => {
    if (!preview) return
    const n = importTrades(preview.trades)
    setPreview(null)
    useUiStore.getState().showToast(`Imported ${n} trade${n === 1 ? '' : 's'}`)
  }

  return (
    <Card delay={delay}>
      <CardHead icon={Table2} title="CSV export & import" hint="Round-trips through a spreadsheet without losing anything the app stores" />
      <div className="flex flex-wrap items-center gap-1">
        <MiniButton icon={Download} onClick={exportAll} disabled={!allTrades.length}>
          All {allTrades.length}
        </MiniButton>
        <MiniButton icon={Download} onClick={exportScoped} disabled={!scopedTrades.length}>
          In range {scopedTrades.length}
        </MiniButton>
        <MiniButton icon={Upload} onClick={() => fileRef.current?.click()}>Import CSV</MiniButton>
        <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
      </div>

      {error && <div className="mt-1.5"><ToolError>{error}</ToolError></div>}

      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-1.5 overflow-hidden"
          >
            <div
              className="rounded-lg p-1.5"
              style={{ border: '1px solid var(--tad-border)', backgroundColor: 'color-mix(in srgb, var(--ta-accent) 6%, transparent)' }}
            >
              <div className="flex items-center gap-1.5">
                <span className="font-bold" style={{ fontSize: 'var(--tad-body)', color: 'var(--ta-ink)' }}>
                  {preview.imported} trade{preview.imported === 1 ? '' : 's'} ready to add
                </span>
                {preview.skipped > 0 && <Pill color={NEG}>{preview.skipped} skipped</Pill>}
                <span className="ml-auto flex gap-1">
                  <MiniButton onClick={confirmImport} active>Add them</MiniButton>
                  <MiniButton icon={X} onClick={() => setPreview(null)} tone="danger">Cancel</MiniButton>
                </span>
              </div>
              {preview.errors.length > 0 && (
                <ScrollBox maxHeight={70} className="mt-1">
                  {preview.errors.slice(0, 20).map((e, i) => (
                    <div key={i} style={{ fontSize: 'var(--tad-micro)', color: NEG }}>{e}</div>
                  ))}
                </ScrollBox>
              )}
              <TableScroll maxHeight={120}>
                <table className="ta-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Instrument</th>
                      <th>TF</th>
                      <th className="text-right">P&L</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.trades.slice(0, 30).map((t, i) => (
                      <tr key={i}>
                        <td>{t.date}</td>
                        <td className="truncate" style={{ maxWidth: 130 }}>{t.instrumentName}</td>
                        <td>{t.timeframe}</td>
                        <td className="text-right">{t.pnl == null ? '—' : t.pnl}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Verdict>
        Exported columns match what the importer expects, so a file taken out of here goes straight back in.
        Cells starting with =, + or - are prefixed with an apostrophe so a spreadsheet treats them as text.
      </Verdict>
    </Card>
  )
}

// ── TOOL 23 — JSON backup / restore ──────────────────────────────────
export function BackupTool({ delay }) {
  const trades = useTradeAnalysisStore((s) => s.trades)
  const validationRules = useTradeAnalysisStore((s) => s.validationRules)
  const validationCategories = useTradeAnalysisStore((s) => s.validationCategories)
  const importTrades = useTradeAnalysisStore((s) => s.importTrades)
  const fileRef = useRef(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const exportBackup = () => {
    const payload = {
      format: 'mindmap-trade-analysis',
      version: 1,
      exportedAt: new Date().toISOString(),
      trades,
      validationRules,
      validationCategories,
    }
    downloadBlob(JSON.stringify(payload, null, 2), `trade-backup-${stamp()}.json`, 'application/json')
    useUiStore.getState().showToast('Backup downloaded')
  }

  const onFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    setInfo('')
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      if (!data || !Array.isArray(data.trades)) {
        setError('That file has no "trades" array — it may not be a backup from this app.')
        return
      }
      // Restore is additive: existing trades are never overwritten, and
      // ids are re-stamped so a backup restored twice does not collide.
      // Ids are dropped so the store re-stamps them; restoring the same
      // backup twice then cannot collide with what is already there.
      const incoming = data.trades.map((t) => {
        const copy = { ...t }
        delete copy.id
        return copy
      })
      const n = importTrades(incoming)
      setInfo(`Added ${n} trade${n === 1 ? '' : 's'} from the backup. Existing trades were left untouched.`)
      useUiStore.getState().showToast(`Restored ${n} trades`)
    } catch (err) {
      setError(`Could not read that backup: ${err.message}`)
    }
  }

  return (
    <Card delay={delay}>
      <CardHead icon={FileJson} title="Full backup" hint="Trades, rules and categories in one JSON file" />
      <div className="flex flex-wrap items-center gap-1">
        <MiniButton icon={Download} onClick={exportBackup} disabled={!trades.length}>Download backup</MiniButton>
        <MiniButton icon={Upload} onClick={() => fileRef.current?.click()}>Restore</MiniButton>
        <input ref={fileRef} type="file" accept=".json,application/json" onChange={onFile} className="hidden" />
      </div>
      <div className="mt-1.5">
        <StatRow label="Trades" value={trades.length} />
        <StatRow label="Validation rules" value={validationRules.length} />
        <StatRow label="Categories" value={validationCategories.length} />
      </div>
      {error && <div className="mt-1.5"><ToolError>{error}</ToolError></div>}
      {info && <Verdict tone="good">{info}</Verdict>}
      <Verdict tone="warn">
        Restoring adds to what is already here rather than replacing it, so nothing can be wiped by accident.
        Clear the trades you do not want afterwards from the Table tab.
      </Verdict>
    </Card>
  )
}

// ── TOOL 24 — Trade replay ───────────────────────────────────────────
export function ReplayTool({ delay }) {
  const { trades } = useScopedTrades()
  const replay = useMemo(() => buildReplay(trades), [trades])
  const [idx, setIdx] = useState(0)
  const [playing, setPlaying] = useState(false)

  const total = replay.frames.length
  const safeIdx = Math.min(idx, Math.max(0, total - 1))
  const frame = replay.frames[safeIdx]

  useEffect(() => {
    if (!playing || !total) return undefined
    const id = setInterval(() => {
      setIdx((i) => {
        if (i >= total - 1) {
          setPlaying(false)
          return i
        }
        return i + 1
      })
    }, 320)
    return () => clearInterval(id)
  }, [playing, total])

  // When the date scope changes the list length changes, and a scrubber
  // left at position 40 would point past the end of a shorter list. React's
  // documented way to reset state on a changed input is to adjust it during
  // render rather than in an effect — no second render pass, no flash of
  // the wrong frame.
  const [seenTotal, setSeenTotal] = useState(total)
  if (seenTotal !== total) {
    setSeenTotal(total)
    setIdx(0)
    setPlaying(false)
  }

  if (!replay.available) {
    return (
      <Card delay={delay}>
        <CardHead icon={Play} title="Trade replay" />
        <Empty>Log a P&amp;L on some trades to walk through the account trade by trade.</Empty>
      </Card>
    )
  }

  const sym = symbolForType(frame.trade.instrumentType)
  const equitySoFar = replay.frames.slice(0, safeIdx + 1).map((f) => f.equity)

  return (
    <Card delay={delay}>
      <CardHead
        icon={Play}
        title="Trade replay"
        sub={`${safeIdx + 1} of ${total}`}
        right={
          <div className="flex items-center gap-1">
            <MiniButton icon={ChevronLeft} onClick={() => { setPlaying(false); setIdx((i) => Math.max(0, i - 1)) }} disabled={safeIdx === 0} title="Previous trade" />
            <MiniButton icon={playing ? Pause : Play} onClick={() => setPlaying((p) => !p)} active={playing} title={playing ? 'Pause' : 'Play through'} />
            <MiniButton icon={ChevronRight} onClick={() => { setPlaying(false); setIdx((i) => Math.min(total - 1, i + 1)) }} disabled={safeIdx >= total - 1} title="Next trade" />
          </div>
        }
      />
      <Sparkline values={equitySoFar.length > 1 ? equitySoFar : [0, 0]} height={40} baseline={0} />
      <input
        type="range"
        min={0}
        max={Math.max(0, total - 1)}
        value={safeIdx}
        onChange={(e) => { setPlaying(false); setIdx(Number(e.target.value)) }}
        className="styled-range mt-1 w-full"
        aria-label="Scrub through trades"
      />
      <div className="mt-1 grid grid-cols-2 sm:grid-cols-4" style={{ gap: 'var(--tad-gap)' }}>
        <Metric label="Trade" value={frame.name} sub={fmtDate(frame.date)} />
        <Metric label="Result" value={fmtMoney(frame.pnl, sym, { signed: true, compact: true })} color={signColor(frame.pnl)} big />
        <Metric label="Balance" value={fmtMoney(frame.equity, sym, { signed: true, compact: true })} color={signColor(frame.equity)} />
        <Metric label="Win rate then" value={fmtPct(frame.winRate, 0)} sub={`${frame.wins}W ${frame.losses}L`} />
      </div>
      {frame.drawdown < 0 && (
        <Verdict tone="warn">
          At this point the account was {fmtMoney(frame.drawdown, sym, { compact: true })} below its high-water mark.
        </Verdict>
      )}
    </Card>
  )
}

// ── TOOL 25 — Screenshot gallery ─────────────────────────────────────
export function ScreenshotTool({ delay }) {
  const { trades } = useScopedTrades()
  const [lightbox, setLightbox] = useState(null)

  const shots = useMemo(
    () =>
      trades
        .filter((t) => t.screenshotUrl || t.resultImageUrl)
        .sort((a, b) => parseDate(b) - parseDate(a))
        .map((t) => ({
          id: t.id,
          name: stockLabel(t),
          date: parseDate(t),
          setup: t.screenshotUrl,
          result: t.resultImageUrl,
          status: t.status,
          pnl: hasPnl(t) ? pnlOf(t) : null,
          symbol: symbolForType(t.instrumentType),
        })),
    [trades]
  )

  return (
    <Card delay={delay} span="lg:col-span-2">
      <CardHead icon={ImageIcon} title="Chart gallery" sub={`${shots.length} with images`} hint="Every setup and result screenshot in range, newest first" />
      {!shots.length ? (
        <Empty>Attach screenshots when logging trades and they will collect here for side-by-side review.</Empty>
      ) : (
        <ScrollBox maxHeight={300}>
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4" style={{ gap: 'var(--tad-gap)' }}>
            {shots.map((s) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, scale: 0.94 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: false, amount: 0.2 }}
                whileHover={{ y: -2 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden rounded-lg"
                style={{ border: '1px solid var(--tad-border)', backgroundColor: 'var(--ta-bg)' }}
              >
                <div className="flex gap-px">
                  {['setup', 'result'].map((kind) =>
                    s[kind] ? (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => setLightbox({ url: s[kind], label: `${s.name} — ${kind}` })}
                        className="min-w-0 flex-1 cursor-zoom-in"
                        title={`View ${kind} chart`}
                      >
                        <img src={s[kind]} alt={`${s.name} ${kind}`} className="h-16 w-full object-cover" loading="lazy" />
                      </button>
                    ) : null
                  )}
                </div>
                <div className="flex items-center gap-1 px-1 py-0.5">
                  <span className="min-w-0 flex-1 truncate font-semibold" style={{ fontSize: 'var(--tad-micro)', color: 'var(--ta-ink)' }}>
                    {s.name}
                  </span>
                  {s.pnl != null && (
                    <span className="ta-num shrink-0 font-bold" style={{ fontSize: 'var(--tad-micro)', color: signColor(s.pnl) }}>
                      {fmtMoney(s.pnl, s.symbol, { signed: true, compact: true })}
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollBox>
      )}

      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightbox(null)}
            className="fixed inset-0 z-[90] flex cursor-zoom-out items-center justify-center p-6"
            style={{ backgroundColor: 'rgba(0,0,0,0.82)' }}
          >
            <motion.img
              initial={{ scale: 0.92 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.92 }}
              src={lightbox.url}
              alt={lightbox.label}
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  )
}
