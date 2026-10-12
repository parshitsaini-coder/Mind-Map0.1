import { CalendarDays, Flame, PieChart } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  getMonthlyActivity,
  getActivityHeatmap,
  getDirectionCounts,
  getStatusCounts,
} from '../../../utils/tradeAnalytics'
import { Card, Grid, HBar, CardTitle, EmptyHint, DIRECTION_COLOR, STATUS_COLOR, CountUp } from './primitives'

export default function ActivitySection({ trades }) {
  const monthly = getMonthlyActivity(trades)
  const monthlyMax = Math.max(1, ...monthly.map((m) => m.count))
  const heatmap = getActivityHeatmap(trades)
  const { buy, sell } = getDirectionCounts(trades)
  const { pending, targetHit, slHit } = getStatusCounts(trades)
  const statusMax = Math.max(1, pending, targetHit, slHit)
  const [hoverCell, setHoverCell] = useState(null)

  return (
    <Grid cols="grid-cols-1 lg:grid-cols-3">
      <Card delay={0.05}>
        <CardTitle icon={CalendarDays} title="Monthly Activity" subtitle="last 6 months" />
        {trades.length === 0 ? (
          <EmptyHint>Trades per month will chart here.</EmptyHint>
        ) : (
          <div className="flex flex-col gap-1.5">
            {monthly.map((m) => (
              <HBar key={m.key} label={m.label} pct={(m.count / monthlyMax) * 100} value={m.count} />
            ))}
          </div>
        )}
      </Card>

      <Card delay={0.08}>
        <CardTitle icon={Flame} title="Activity Heatmap" subtitle="last 13 weeks • hover for details" />
        {trades.length === 0 ? (
          <EmptyHint>A day-by-day heatmap appears once you start logging.</EmptyHint>
        ) : (
          <div className="relative">
            <motion.div
              className="flex gap-[3px] overflow-x-auto pb-1"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, amount: 0.4 }}
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.012 } } }}
            >
              {heatmap.columns.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-[3px]">
                  {col.map((cell, ri) => {
                    const opacity = cell.count === null ? 0 : cell.count === 0 ? 0.12 : Math.min(1, 0.25 + (cell.count / heatmap.max) * 0.75)
                    return (
                      <motion.div
                        key={ri}
                        onMouseEnter={() => cell.count !== null && setHoverCell(cell)}
                        onMouseLeave={() => setHoverCell(null)}
                        className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                        variants={{ hidden: { opacity: 0, scale: 0.3 }, visible: { opacity: cell.count === null ? 0 : opacity, scale: 1 } }}
                        whileHover={cell.count ? { scale: 1.35 } : undefined}
                        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                          backgroundColor: cell.count === null ? 'transparent' : 'var(--ta-accent)',
                          border: cell.count === null ? 'none' : '1px solid var(--ta-bg)',
                        }}
                      />
                    )
                  })}
                </div>
              ))}
            </motion.div>
            <div className="mt-1.5 flex items-center gap-1 text-[8px]" style={{ color: 'var(--ta-slate)' }}>
              <span>{hoverCell ? `${hoverCell.date.toDateString()}: ${hoverCell.count} trade${hoverCell.count === 1 ? '' : 's'}` : 'Less'}</span>
              {!hoverCell && (
                <>
                  {[0.12, 0.4, 0.65, 1].map((o) => (
                    <span key={o} className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: 'var(--ta-accent)', opacity: o }} />
                  ))}
                  <span>More</span>
                </>
              )}
            </div>
          </div>
        )}
      </Card>

      <Card delay={0.11}>
        <CardTitle icon={PieChart} title="Direction & Status" subtitle="by category" />
        {trades.length === 0 ? (
          <EmptyHint>Buy/Sell and outcome split shows up here.</EmptyHint>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <div className="flex-1 rounded-xl px-2 py-1.5 text-center" style={{ backgroundColor: 'color-mix(in srgb, var(--ta-surface) 85%, #16a34a 15%)' }}>
                <div className="text-[15px] font-extrabold" style={{ color: DIRECTION_COLOR.Buy }}><CountUp value={buy} /></div>
                <div className="text-[8px] font-semibold uppercase" style={{ color: 'var(--ta-slate)' }}>Buy</div>
              </div>
              <div className="flex-1 rounded-xl px-2 py-1.5 text-center" style={{ backgroundColor: 'color-mix(in srgb, var(--ta-surface) 85%, #dc2626 15%)' }}>
                <div className="text-[15px] font-extrabold" style={{ color: DIRECTION_COLOR.Sell }}><CountUp value={sell} /></div>
                <div className="text-[8px] font-semibold uppercase" style={{ color: 'var(--ta-slate)' }}>Sell</div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 border-t pt-2" style={{ borderColor: 'var(--ta-bg)' }}>
              <HBar label="Target Hit" pct={(targetHit / statusMax) * 100} value={targetHit} color={STATUS_COLOR['Target Hit'].solid} />
              <HBar label="SL Hit" pct={(slHit / statusMax) * 100} value={slHit} color={STATUS_COLOR['SL Hit'].solid} />
              <HBar label="Pending" pct={(pending / statusMax) * 100} value={pending} color={STATUS_COLOR.Pending.solid} />
            </div>
          </div>
        )}
      </Card>
    </Grid>
  )
}
