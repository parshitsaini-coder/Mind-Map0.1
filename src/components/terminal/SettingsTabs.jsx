import { useState } from 'react'
import { useTerminalStore } from '../../store/terminalStore'
import { MAX_COMMISSION } from '../../lib/terminal/ledger'
import { CHART_TYPES, TIME_ZONES, THEMES, THEME_IDS, withTheme, cleanChartSettings } from '../../lib/terminal/chartSettings'
import { wakeLockSupported, SHORTCUTS } from './phase8Hooks'
import { useChartTheme } from './chartTheme'
import { Group, Row, Sw, SwitchRaw, Sel, Seg, Col, Rng, Txt } from './SettingsControls'
import { STYLE_OPTS, useCS } from './settingsHelpers'

const opt = (...ids) => ids.map(([id, label]) => ({ id, label }))

// Commits on blur / Enter; shows why a value was refused instead of silently ignoring it.
function NumField({ label, hint, value, onCommit, step = 'any', suffix }) {
  const [text, setText] = useState(String(value))
  const [err, setErr] = useState('')
  const commit = () => {
    const r = onCommit(text.trim())
    setErr(r && r.ok === false ? r.error : '')
  }
  return (
    <div>
      <Row label={label} hint={hint}>
        <input type="number" inputMode="decimal" step={step} value={text} aria-label={label} aria-invalid={!!err}
          onChange={(e) => { setText(e.target.value); setErr('') }} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
          className="h-8 w-24 rounded border bg-transparent px-2 text-right text-[12px] tabular-nums outline-none focus:border-sky-400" style={{ borderColor: err ? '#f87171' : 'var(--tm-border2)', color: 'var(--tm-text)' }} />
        {suffix && <span className="w-8 text-[10px]" style={{ color: 'var(--tm-muted)' }}>{suffix}</span>}
      </Row>
      {err && <div role="alert" className="pb-1 text-right text-[10px] text-red-400">{err}</div>}
    </div>
  )
}

// ── Symbol ──
export function SymbolTab() {
  const chartType = useTerminalStore((s) => s.chartType)
  const { cs } = useCS()
  const s = cs.symbol
  const ohlc = ['candles', 'hollow', 'heikin'].includes(chartType)
  const isLine = ['line', 'area', 'baseline'].includes(chartType)
  return (
    <>
      <Group title="Chart type">
        <div className="grid grid-cols-2 gap-1.5 py-1 sm:grid-cols-4" role="radiogroup" aria-label="Chart type">
          {CHART_TYPES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={chartType === t.id} onClick={() => useTerminalStore.getState().setChartType(t.id)}
              className="h-9 rounded px-1 text-[11px] font-semibold" style={{ backgroundColor: chartType === t.id ? '#2563eb' : 'var(--tm-panel2)', color: chartType === t.id ? '#fff' : 'var(--tm-muted)' }}>{t.label}</button>
          ))}
        </div>
      </Group>
      {(ohlc || chartType === 'bars') && (
        <Group title={chartType === 'bars' ? 'Bar colours' : 'Candle colours'}>
          {chartType !== 'bars' && <Sw path="symbol.bodyOn" label="Body" />}
          <Col path="symbol.up" label="Up colour" />
          <Col path="symbol.down" label="Down colour" />
          {chartType !== 'bars' && (
            <>
              <Sw path="symbol.borderOn" label="Border" />
              {s.borderOn && <><Col path="symbol.borderUp" label="Border up" /><Col path="symbol.borderDown" label="Border down" /></>}
              <Sw path="symbol.wickOn" label="Wick" />
              {s.wickOn && <><Col path="symbol.wickUp" label="Wick up" /><Col path="symbol.wickDown" label="Wick down" /></>}
            </>
          )}
          {chartType === 'bars' && <Sw path="symbol.thinBars" label="Thin bars" />}
          <Sw path="symbol.colorByPrev" label="Colour bars by previous close" hint="Up when the close is above the previous bar's close." />
        </Group>
      )}
      {isLine && (
        <Group title="Line options">
          <Sel path="symbol.lineSource" label="Price source" options={opt(['close', 'Close'], ['open', 'Open'], ['high', 'High'], ['low', 'Low'], ['hl2', '(High + Low) / 2'])} />
          {chartType !== 'baseline' && <Col path="symbol.lineColor" label="Line colour" />}
          <Rng path="symbol.lineWidth" label="Line width" min={1} max={6} unit=" px" />
          {chartType !== 'baseline' && <Sel path="symbol.lineType" label="Line type" options={opt(['simple', 'Simple'], ['steps', 'With steps'], ['curved', 'Curved'])} />}
          {chartType === 'area' && <><Col path="symbol.areaTop" label="Fill top" alpha /><Col path="symbol.areaBottom" label="Fill bottom" alpha /></>}
          {chartType === 'baseline' && <><Col path="symbol.baseColorUp" label="Above base" /><Col path="symbol.baseColorDown" label="Below base" /></>}
        </Group>
      )}
      <Group title="Data">
        <Sel path="symbol.precision" label="Price precision" hint="Decimals shown on the scale and labels." options={[{ id: 'auto', label: 'Auto' }, ...Array.from({ length: 9 }, (_, i) => ({ id: String(i), label: `${i} decimals` }))]} />
        <Sel path="symbol.tz" label="Time zone" hint="Changes axis labels, the crosshair and the status line only." options={TIME_ZONES.map((t) => ({ id: t.id, label: t.label }))} />
      </Group>
    </>
  )
}

// ── Status line ──
export function StatusTab() {
  return (
    <>
      <Group title="Status line (top-left of the chart)">
        <Sw path="status.symbol" label="Symbol name" />
        <Sw path="status.desc" label="Symbol description" />
        <Sw path="status.marketDot" label="Market status" />
        <Sw path="status.ohlc" label="OHLC values" hint="Follows the crosshair; shows the latest bar when it is away." />
        <Sw path="status.change" label="Bar change" hint="Change vs the previous close, in price and %." />
        <Sw path="status.volume" label="Volume" />
        <Sw path="status.indTitles" label="Indicator titles" />
        <Sw path="status.indArgs" label="Indicator arguments" hint="e.g. SMA(20)." />
        <Sw path="status.indValues" label="Indicator values" hint="Live value of every indicator line at the crosshair (or the latest bar)." />
        <Sw path="status.positions" label="Positions summary" hint="Open positions on this symbol and their floating P/L." />
        <Rng path="status.opacity" label="Opacity" min={0.2} max={1} step={0.05} scale={100} unit="%" />
      </Group>
    </>
  )
}

// ── Scales and lines ──
export function ScalesTab() {
  const { cs } = useCS()
  const sc = cs.scales
  const lineGroup = (key, title) => (
    <>
      <Sw path={`scales.${key}`} label={title} />
      {sc[key] && (
        <>
          <Col path={`scales.${key}Color`} label={`${title} colour`} />
          <Seg path={`scales.${key}Style`} label="Style" options={STYLE_OPTS} />
          <Rng path={`scales.${key}Width`} label="Width" min={1} max={4} unit=" px" />
        </>
      )}
    </>
  )
  return (
    <>
      <Group title="Price scale">
        <Sel path="scales.mode" label="Scale type" options={opt(['normal', 'Normal'], ['log', 'Logarithmic'], ['percent', 'Percentage'], ['index100', 'Indexed to 100'])} />
        <Sw path="scales.autoScale" label="Auto scale" />
        <Sw path="scales.invert" label="Invert scale" />
        <Sw path="scales.lock" label="Lock scale" hint="Stops dragging the price axis from changing the scale." />
        <Seg path="scales.placement" label="Placement" options={opt(['left', 'Left'], ['right', 'Right'])} />
        <Sw path="scales.borderVisible" label="Scale borders" />
        <Sw path="scales.noOverlap" label="No overlapping labels" />
        <Rng path="scales.marginTop" label="Top margin" min={0} max={0.45} step={0.01} scale={100} unit="%" />
        <Rng path="scales.marginBottom" label="Bottom margin" min={0} max={0.45} step={0.01} scale={100} unit="%" />
      </Group>
      <Group title="Price labels and lines">
        <Sw path="scales.lastLabel" label="Last price label" />
        <Sw path="scales.lastLine" label="Last price line" />
        {sc.lastLine && <><Col path="scales.lastLineColor" label="Last line colour" /><Seg path="scales.lastLineStyle" label="Style" options={STYLE_OPTS} /><Rng path="scales.lastLineWidth" label="Width" min={1} max={4} unit=" px" /></>}
        {lineGroup('prevClose', 'Previous close line')}
        {lineGroup('bid', 'Bid line')}
        {lineGroup('ask', 'Ask line')}
        <Sw path="scales.hiLo" label="High / low of the visible range" />
        {sc.hiLo && <Col path="scales.hiLoColor" label="High / low colour" />}
        <Sw path="scales.countdown" label="Countdown to bar close" hint="Shown under the last price." />
      </Group>
      <Group title="Time scale">
        <Rng path="scales.barSpacing" label="Bar spacing" min={2} max={40} unit=" px" />
        <Rng path="scales.rightOffset" label="Right offset" min={0} max={100} unit=" bars" />
        <Sw path="scales.seconds" label="Show seconds" />
        <Seg path="scales.h24" label="Clock" options={[{ id: true, label: '24 h' }, { id: false, label: '12 h' }]} />
        <Sel path="scales.dateFormat" label="Date format" options={opt(['dd MMM yy', '12 Oct 26'], ['dd-MM-yyyy', '12-10-2026'], ['MM-dd-yyyy', '10-12-2026'], ['yyyy-MM-dd', '2026-10-12'])} />
        <Sw path="scales.lockLast" label="Keep the last bar in place" hint="Scrolling keeps the newest bar at the same distance from the edge." />
      </Group>
      <Group title="Crosshair">
        <Seg path="scales.crosshairMode" label="Mode" options={opt(['normal', 'Normal'], ['magnet', 'Magnet (OHLC)'])} />
        <Col path="scales.crosshairColor" label="Colour" />
        <Seg path="scales.crosshairStyle" label="Style" options={STYLE_OPTS} />
        <Rng path="scales.crosshairWidth" label="Width" min={1} max={4} unit=" px" />
        <Sw path="scales.crosshairLabels" label="Axis labels" />
      </Group>
    </>
  )
}

// ── Canvas ──
export function CanvasTab() {
  const { cs } = useCS()
  const { prefersDark } = useChartTheme()
  const c = cs.canvas
  const pick = (id) => useTerminalStore.getState().applyChartTheme(id, prefersDark)
  const resetCanvas = () => {
    const base = withTheme(cleanChartSettings(), cs.theme === 'system' ? (prefersDark ? 'dark' : 'light') : cs.theme, prefersDark)
    useTerminalStore.getState().setChartSettings({ canvas: base.canvas, scales: { crosshairColor: base.scales.crosshairColor } })
  }
  return (
    <>
      <Group title="Theme">
        <div className="grid grid-cols-2 gap-1.5 py-1 sm:grid-cols-4" role="radiogroup" aria-label="Theme preset">
          {[...THEME_IDS, 'system'].map((id) => {
            const t = THEMES[id]
            return (
              <button key={id} type="button" role="radio" aria-checked={cs.theme === id} onClick={() => pick(id)} className="flex h-12 flex-col items-stretch justify-between overflow-hidden rounded border text-left" style={{ borderColor: cs.theme === id ? '#38bdf8' : 'var(--tm-border2)' }}>
                <span className="h-5 w-full" style={{ background: id === 'system' ? 'linear-gradient(90deg,#0f1419 50%,#ffffff 50%)' : t.canvas.bg }} />
                <span className="px-1.5 pb-1 text-[10px] font-semibold" style={{ color: 'var(--tm-text)' }}>{id === 'system' ? 'Match system' : t.label}</span>
              </button>
            )
          })}
        </div>
      </Group>
      <Group title="Background">
        <Seg path="canvas.bgType" label="Type" options={opt(['solid', 'Solid'], ['gradient', 'Gradient'])} />
        <Col path="canvas.bg" label={c.bgType === 'gradient' ? 'Top colour' : 'Colour'} />
        {c.bgType === 'gradient' && <Col path="canvas.bg2" label="Bottom colour" />}
      </Group>
      <Group title="Grid lines">
        <Sw path="canvas.gridV" label="Vertical lines" />
        {c.gridV && <><Col path="canvas.gridVColor" label="Colour" /><Seg path="canvas.gridVStyle" label="Style" options={STYLE_OPTS} /></>}
        <Sw path="canvas.gridH" label="Horizontal lines" />
        {c.gridH && <><Col path="canvas.gridHColor" label="Colour" /><Seg path="canvas.gridHStyle" label="Style" options={STYLE_OPTS} /></>}
      </Group>
      <Group title="Text and borders">
        <Col path="canvas.textColor" label="Text colour" />
        <Rng path="canvas.fontSize" label="Font size" min={8} max={20} unit=" px" />
        <Col path="canvas.borderColor" label="Scale line colour" />
        <Col path="canvas.paneSep" label="Pane separator" />
      </Group>
      <Group title="Watermark">
        <Sel path="canvas.wmMode" label="Show" options={opt(['off', 'Off'], ['symbol', 'Symbol'], ['symbolTf', 'Symbol + timeframe'], ['custom', 'Custom text'])} />
        {c.wmMode === 'custom' && <Txt path="canvas.wmText" label="Text" placeholder="Your text" />}
        {c.wmMode !== 'off' && (
          <>
            <Col path="canvas.wmColor" label="Colour" />
            <Rng path="canvas.wmOpacity" label="Opacity" min={0.02} max={0.5} step={0.01} scale={100} unit="%" />
            <Rng path="canvas.wmSize" label="Size" min={16} max={140} unit=" px" />
            <Sel path="canvas.wmPos" label="Position" options={opt(['center', 'Centre'], ['tl', 'Top left'], ['tr', 'Top right'], ['bl', 'Bottom left'], ['br', 'Bottom right'])} />
          </>
        )}
      </Group>
      <Group>
        <Row label="Reset canvas" hint="Back to the colours of the chosen theme."><button type="button" onClick={resetCanvas} className="h-8 rounded px-3 text-[11px] font-semibold" style={{ backgroundColor: 'var(--tm-panel2)', color: 'var(--tm-text)', border: '1px solid var(--tm-border2)' }}>Reset</button></Row>
      </Group>
    </>
  )
}

// ── Trading ──
function commitTrading(key, txt, lo, hi, msg) {
  const v = Number(txt)
  if (txt === '' || !Number.isFinite(v) || v < lo || v > hi) return { ok: false, error: msg }
  useTerminalStore.getState().setChartSettings({ trading: { [key]: v } })
  return { ok: true }
}

// Default SL / TP distance: a number + its unit (pips / % of price / ATR multiple).
function DistField({ kind, label }) {
  const tr = useTerminalStore((s) => s.chartSettings.trading)
  const val = tr[`def${kind}Value`]
  return (
    <>
      <Sel path={`trading.def${kind}Unit`} label={`${label} — unit`} options={opt(['pips', 'Pips'], ['percent', '% of price'], ['atr', 'ATR(14) multiple'])} />
      <NumField key={`d${kind}-${val}`} label={`${label} — distance`} hint="Used by the quick bracket and the +SL / +TP buttons on the chart." value={val} step="any" onCommit={(t) => commitTrading(`def${kind}Value`, t, 0.1, 10000, 'Enter a distance between 0.1 and 10000')} suffix={tr[`def${kind}Unit`] === 'atr' ? '× ATR' : tr[`def${kind}Unit`] === 'percent' ? '%' : 'pips'} />
    </>
  )
}

export function TradingTab() {
  const marginWarn = useTerminalStore((s) => s.chartSettings.trading.marginWarn)
  const settings = useTerminalStore((s) => s.settings)
  const commission = useTerminalStore((s) => s.account.commission || 0)
  const set = useTerminalStore.getState().setSettings
  const setLots = (txt) => {
    const v = Number(txt)
    if (!Number.isFinite(v) || v < 0.01 || v > 100) return { ok: false, error: 'Default lots must be between 0.01 and 100' }
    set({ lots: Math.round(v * 100) / 100 })
    return { ok: true }
  }
  const setStopOut = (txt) => {
    const v = Number(txt)
    if (txt === '' || !Number.isFinite(v) || v < 0 || v > 100) return { ok: false, error: 'Stop-out level must be between 0 and 100 %' }
    set({ stopOutLevel: v })
    return { ok: true }
  }
  return (
    <>
      <Group title="Order entry">
        <SwitchRaw label="One-click trading" hint="BUY / SELL fill immediately, without a confirmation step." checked={settings.oneClick} onChange={(v) => set({ oneClick: v })} />
        <NumField key={`lots-${settings.lots}`} label="Default lots" hint="Starting lot size of the order ticket." value={settings.lots} step="0.01" onCommit={setLots} suffix="lots" />
        <NumField key={`so-${settings.stopOutLevel}`} label="Stop-out level" hint="When margin level falls below this, the worst position is closed." value={settings.stopOutLevel} step="1" onCommit={setStopOut} suffix="%" />
        <Sw path="trading.confirmClose" label="Confirm before closing a position" />
        <Sw path="trading.confirmCancel" label="Confirm before cancelling an order" />
      </Group>
      <Group title="Stops from the chart">
        <Sel path="trading.snap" label="Snap while dragging" hint="Shift = one tick, Ctrl = 10 pips. SL also clicks onto break-even near the entry." options={opt(['off', 'Off'], ['round', 'Round numbers (10 pips)'], ['bars', 'High / low of recent bars'])} />
        <DistField kind="Sl" label="Default stop loss" />
        <DistField kind="Tp" label="Default take profit" />
        <NumField key={`mw-${marginWarn}`} label="Margin warning below" hint="The account strip on the chart turns amber under this margin level." value={marginWarn} step="10" onCommit={(t) => commitTrading('marginWarn', t, 50, 1000, 'Margin warning must be between 50 and 1000 %')} suffix="%" />
      </Group>
      <Group title="Execution costs">
        <Row label="Simulated spread over live mid" hint={settings.spreadMode === 'variable' ? 'The live price has no spread, so one is added: it widens now and then (about 2× at times, 3–6× in rare spikes).' : 'The live price has no spread, so a fixed one is added around the live mid price.'}>
          <div className="flex overflow-hidden rounded border" role="radiogroup" aria-label="Spread mode" style={{ borderColor: 'var(--tm-border2)' }}>
            {[['fixed', 'Fixed'], ['variable', 'Variable']].map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={settings.spreadMode === id} onClick={() => set({ spreadMode: id })} className="h-8 px-3 text-[11px] font-semibold" style={{ backgroundColor: settings.spreadMode === id ? '#2563eb' : 'transparent', color: settings.spreadMode === id ? '#fff' : 'var(--tm-muted)' }}>{label}</button>
            ))}
          </div>
        </Row>
        <SwitchRaw label="Slippage" hint="Market orders fill up to 0.5 pip worse than the screen price — never better." checked={settings.slippage} onChange={(v) => set({ slippage: v })} />
        <NumField key={`co-${commission}`} label="Commission" hint={`Per lot, charged when a position is closed (round turn). Max ${MAX_COMMISSION} $/lot.`} value={commission} step="0.5" onCommit={(t) => useTerminalStore.getState().setCommission(t === '' ? NaN : t)} suffix="$/lot" />
      </Group>
      <Group title="Positions and orders on the chart">
        <Sw path="trading.showPositions" label="Show positions" />
        <Sw path="trading.showOrders" label="Show pending orders" />
        <Sw path="trading.showExecutions" label="Show executions" hint="Arrows where trades were opened, circles where they closed." />
        <Sel path="trading.plUnit" label="P/L unit on the chart" hint="Click the P/L chip on a position to cycle it." options={opt(['money', 'Money ($)'], ['pips', 'Pips'], ['points', 'Points'], ['percent', '% of balance'], ['r', 'R-multiple'])} />
        <Sw path="trading.showPlPill" label="Position pill with live P/L" hint="Entry pill with close, reverse and a menu. Off = only the plain price lines." />
        <Sw path="trading.reverseBtn" label="Reverse button on the pill" />
        <Sw path="trading.extendLines" label="Extend SL / TP lines across the chart" hint="Off: only the price-axis tag shows until you drag." />
        <Col path="trading.colorBuy" label="Buy colour" />
        <Col path="trading.colorSell" label="Sell colour" />
        <Col path="trading.colorSL" label="Stop loss colour" />
        <Col path="trading.colorTP" label="Take profit colour" />
        <Col path="trading.colorBuyPending" label="Buy order colour" />
        <Col path="trading.colorSellPending" label="Sell order colour" />
        <Seg path="trading.lineStyle" label="Line style" options={STYLE_OPTS} />
        <Rng path="trading.lineWidth" label="Line width" min={1} max={4} unit=" px" />
      </Group>
    </>
  )
}

// ── Alerts & device ──
export function AlertsTab() {
  const [taps, setTaps] = useState(0)
  const density = useTerminalStore((s) => s.uiDensity)
  const tradePanel = useTerminalStore((s) => s.tradePanelOpen)
  const settings = useTerminalStore((s) => s.settings)
  const set = useTerminalStore.getState().setSettings
  return (
    <>
      <Group title="Alerts">
        <Row label="Sounds" hint="Master switch, volume, packs and per-event sounds moved to the Sounds tab."><span className="text-[11px] font-bold" style={{ color: settings.sound ? '#38bdf8' : 'var(--tm-muted)' }}>{settings.sound ? 'ON' : 'OFF'}</span></Row>
        <Rng path="alerts.toastSeconds" label="Notification time" min={1} max={15} step={0.5} unit=" s" digits={1} />
      </Group>
      <Group title="About">
        <Row label="Terminal version" hint={taps > 0 && taps < 5 ? `${5 - taps} more…` : undefined}>
          <button type="button" data-testid="about-version" onClick={() => { const n = taps + 1; setTaps(n >= 5 ? 0 : n); if (n >= 5) { useTerminalStore.getState().setLabOpen(true) } }} className="rounded px-2 py-1 text-[11px] font-bold" style={{ color: 'var(--tm-muted)' }}>Phase 12</button>
        </Row>
      </Group>
      <Group title="This device">
        <Row label="Interface size" hint="Compact makes the top bars and buttons small so the chart gets the room.">
          <div className="flex overflow-hidden rounded border" role="radiogroup" aria-label="Interface size" style={{ borderColor: 'var(--tm-border2)' }}>
            {[['compact', 'Compact'], ['normal', 'Normal']].map(([id, text]) => (
              <button key={id} type="button" role="radio" aria-checked={density === id} data-testid={`density-${id}`} onClick={() => useTerminalStore.getState().setUiDensity(id)} className="h-8 px-2.5 text-[11px] font-semibold" style={{ backgroundColor: density === id ? '#2563eb' : 'transparent', color: density === id ? '#fff' : 'var(--tm-muted)' }}>{text}</button>
            ))}
          </div>
        </Row>
        <SwitchRaw label="Trade panel (desktop)" hint="The Buy / Sell ticket on the right. Also the Trade button in the top-right corner." checked={tradePanel} onChange={(v) => useTerminalStore.getState().setTradePanelOpen(v)} />
        <SwitchRaw label="Keep screen on" hint={wakeLockSupported() ? 'Stops the phone from sleeping while the terminal is open (this device only).' : 'Not supported by this browser.'}
          checked={settings.wakeLock && wakeLockSupported()} disabled={!wakeLockSupported()} onChange={(v) => set({ wakeLock: v })} />
      </Group>
    </>
  )
}

export function ShortcutsTab() {
  return (
    <Group title="Keyboard shortcuts">
      <dl className="py-1">
        {[...SHORTCUTS, ['Alt + ,', 'Open these settings']].map(([k, d]) => (
          <div key={k} className="flex gap-3 py-1 text-[11px]">
            <dt className="w-20 shrink-0 font-mono font-bold text-sky-400">{k}</dt>
            <dd style={{ color: 'var(--tm-muted)' }}>{d}</dd>
          </div>
        ))}
      </dl>
    </Group>
  )
}
