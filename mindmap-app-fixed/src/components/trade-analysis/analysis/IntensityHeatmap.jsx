import { Thermometer } from 'lucide-react'
import { getStockIntensity } from '../../../utils/tradeAnalytics'
import { Card, CardTitle, EmptyHint } from './primitives'

export default function IntensityHeatmap({ trades }) {
  const { stocks, timeframes, cells } = getStockIntensity(trades)

  return (
    <Card delay={0.05}>
      <CardTitle icon={Thermometer} title="Stock Intensity Heatmap" subtitle="stock × TF performance" />
      {stocks.length === 0 || timeframes.length === 0 ? (
        <EmptyHint>A stock-by-timeframe win-rate map appears here.</EmptyHint>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-[9px]">
              <thead>
                <tr>
                  <th className="pb-1 text-left font-semibold" style={{ color: 'var(--ta-slate)' }}>Stock</th>
                  {timeframes.map((tf) => (
                    <th key={tf} className="pb-1 text-center font-semibold" style={{ color: 'var(--ta-slate)' }}>{tf}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cells.map((row) => (
                  <tr key={row.stock} className="border-t" style={{ borderColor: 'var(--ta-bg)' }}>
                    <td className="py-1 pr-2 font-medium" style={{ color: 'var(--ta-ink)' }}>{row.stock}</td>
                    {row.row.map((cell) => {
                      const opacity = cell.count === 0 ? 0 : Math.max(0.15, (cell.winRatePct ?? 30) / 100)
                      return (
                        <td key={cell.tf} className="py-1 text-center">
                          {cell.count === 0 ? (
                            <span style={{ color: 'var(--ta-slate)', opacity: 0.4 }}>—</span>
                          ) : (
                            <span
                              className="inline-block min-w-[26px] rounded px-1"
                              style={{ backgroundColor: `color-mix(in srgb, var(--ta-accent) ${opacity * 100}%, var(--ta-surface))`, color: opacity > 0.55 ? '#fffcf2' : 'var(--ta-ink)' }}
                            >
                              {cell.count}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[8px]" style={{ color: 'var(--ta-slate)' }}>
            <span>Low</span>
            <div className="h-1.5 w-24 rounded-full" style={{ background: 'linear-gradient(90deg, color-mix(in srgb, var(--ta-accent) 15%, var(--ta-surface)), var(--ta-accent))' }} />
            <span>High Win Rate</span>
          </div>
        </>
      )}
    </Card>
  )
}
