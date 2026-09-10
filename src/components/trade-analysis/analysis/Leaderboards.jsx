import { Star, Award, BarChart2 } from 'lucide-react'
import { getTopScoringTrades, getBestTfWinRate, getStockWinRate } from '../../../utils/tradeAnalytics'
import { motion } from 'framer-motion'
import { Card, Grid, SectionHeader, CardTitle, EmptyHint, fmtPct, CountUp } from './primitives'

export default function Leaderboards({ trades }) {
  const topScoring = getTopScoringTrades(trades)
  const bestTf = getBestTfWinRate(trades)
  const stockWinRate = getStockWinRate(trades)

  return (
    <div>
      <SectionHeader title="Leaderboards" />
      <Grid cols="grid-cols-1 lg:grid-cols-3">
        <Card delay={0.05}>
          <CardTitle icon={Star} title="Top Scoring Trades" subtitle="highest validation %" />
          {topScoring.length === 0 ? (
            <EmptyHint>Score trades to see them here.</EmptyHint>
          ) : (
            <motion.ul
              className="flex flex-col gap-1.5"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, amount: 0.4 }}
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
            >
              {topScoring.map((t) => (
                <motion.li
                  key={t.id}
                  className="flex items-center justify-between text-[9.5px]"
                  variants={{ hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0 } }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="truncate font-medium" style={{ color: 'var(--ta-ink)' }}>{t.name}</span>
                  <span className="font-bold" style={{ color: 'var(--ta-accent)' }}><CountUp value={fmtPct(t.pct)} /></span>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </Card>

        <Card delay={0.08}>
          <CardTitle icon={Award} title="Best TF Win Rate" subtitle="which TF performs best" />
          {bestTf.length === 0 ? (
            <EmptyHint>Resolve a few trades to rank timeframes.</EmptyHint>
          ) : (
            <motion.ul
              className="flex flex-col gap-1.5"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, amount: 0.4 }}
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
            >
              {bestTf.map((tf) => (
                <motion.li
                  key={tf.tf}
                  className="flex items-center justify-between text-[9.5px]"
                  variants={{ hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0 } }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="font-medium" style={{ color: 'var(--ta-ink)' }}>{tf.tf}</span>
                  <span style={{ color: 'var(--ta-slate)' }}><CountUp value={tf.won} />W-<CountUp value={tf.lost} />L</span>
                  <span className="font-bold" style={{ color: 'var(--ta-accent)' }}><CountUp value={fmtPct(tf.winRatePct)} /></span>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </Card>

        <Card delay={0.11}>
          <CardTitle icon={BarChart2} title="Stock Win Rate" subtitle="stock-wise record" />
          {stockWinRate.length === 0 ? (
            <EmptyHint>Win rate per stock/pair shows up here.</EmptyHint>
          ) : (
            <motion.ul
              className="flex flex-col gap-1.5"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: false, amount: 0.4 }}
              variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
            >
              {stockWinRate.map((s) => (
                <motion.li
                  key={s.name}
                  className="flex items-center justify-between text-[9.5px]"
                  variants={{ hidden: { opacity: 0, x: -12 }, visible: { opacity: 1, x: 0 } }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="truncate font-medium" style={{ color: 'var(--ta-ink)' }}>{s.name}</span>
                  <span style={{ color: 'var(--ta-slate)' }}><CountUp value={s.won} />W-<CountUp value={s.lost} />L</span>
                  <span className="font-bold" style={{ color: 'var(--ta-accent)' }}><CountUp value={fmtPct(s.winRatePct)} /></span>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </Card>
      </Grid>
    </div>
  )
}
