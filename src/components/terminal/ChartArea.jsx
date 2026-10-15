import { useTerminalStore } from '../../store/terminalStore'
import { useChartToolsStore } from '../../store/chartToolsStore'
import { SYMBOLS, TIMEFRAMES } from '../../lib/terminal/instruments'
import ChartView from './ChartView'
import useMedia from './useMedia'

const sel = 'rounded border bg-transparent px-1 py-0.5 text-[10px] font-bold outline-none'

// 1, 2 or 4 charts. Chart #1 is the main chart (follows the top bar's symbol and timeframe);
// the others keep their own symbol/timeframe. Phones always show a single chart.
export default function ChartArea({ onOpenIndicators }) {
  const symbol = useTerminalStore((s) => s.symbol)
  const timeframe = useTerminalStore((s) => s.timeframe)
  const chartType = useTerminalStore((s) => s.chartType)
  const layout = useChartToolsStore((s) => s.layout)
  const cells = useChartToolsStore((s) => s.cells)
  const setCell = useChartToolsStore((s) => s.setCell)
  const desktop = useMedia('(min-width: 768px)')
  const n = desktop ? layout : 1

  if (n === 1) return <ChartView symbol={symbol} timeframe={timeframe} chartType={chartType} onOpenIndicators={onOpenIndicators} />

  const all = [{ symbol, timeframe, main: true }, ...cells.slice(0, n - 1).map((c, i) => ({ ...c, slot: i }))]
  const makeMain = (c) => {
    const st = useTerminalStore.getState()
    setCell(c.slot, { symbol: st.symbol, timeframe: st.timeframe })
    st.setSymbol(c.symbol)
    st.setTimeframe(c.timeframe)
  }

  return (
    <div className={`grid h-full w-full gap-px ${n === 2 ? 'grid-cols-2' : 'grid-cols-2 grid-rows-2'}`} style={{ backgroundColor: '#27313d' }}>
      {all.map((c) => (
        <div key={c.main ? 'main' : `s${c.slot}`} className="flex min-h-0 min-w-0 flex-col" style={{ backgroundColor: '#0f1419' }}>
          <div className="flex h-6 shrink-0 items-center gap-1 px-1.5" style={{ backgroundColor: '#131a22' }}>
            {c.main ? (
              <span className="text-[10px] font-bold text-sky-400">MAIN · {c.symbol} · {TIMEFRAMES.find((t) => t.id === c.timeframe)?.label}</span>
            ) : (
              <>
                <select aria-label="Symbol" value={c.symbol} onChange={(e) => setCell(c.slot, { symbol: e.target.value })} className={sel} style={{ borderColor: '#334155', color: '#e5e7eb' }}>
                  {SYMBOLS.map((s) => <option key={s} value={s} style={{ backgroundColor: '#131a22' }}>{s}</option>)}
                </select>
                <select aria-label="Timeframe" value={c.timeframe} onChange={(e) => setCell(c.slot, { timeframe: e.target.value })} className={sel} style={{ borderColor: '#334155', color: '#e5e7eb' }}>
                  {TIMEFRAMES.map((t) => <option key={t.id} value={t.id} style={{ backgroundColor: '#131a22' }}>{t.label}</option>)}
                </select>
                <button type="button" onClick={() => makeMain(c)} className="ml-auto rounded px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white" title="Swap with the main chart (order ticket follows the main chart)">Make main</button>
              </>
            )}
          </div>
          <div className="relative min-h-0 flex-1">
            <ChartView symbol={c.symbol} timeframe={c.timeframe} chartType={chartType} onOpenIndicators={onOpenIndicators} />
          </div>
        </div>
      ))}
    </div>
  )
}
