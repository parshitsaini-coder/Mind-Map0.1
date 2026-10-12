import { motion } from 'framer-motion'
import { CalendarClock, Hourglass, Target } from 'lucide-react'
import { getWeeklyDayPattern, getTradeAgeBuckets, getValidationScoreDistribution } from '../../../utils/tradeAnalytics'
import { Card, Grid, HBar, SectionHeader, CardTitle, EmptyHint, CountUp } from './primitives'

const AGE_COLORS = { fresh: '#5f8a52', mid: '#eb5e28', old: '#b3503a' }

export default function VisualAnalytics({ trades }) {
  const weekly = getWeeklyDayPattern(trades)
  const weeklyMax = Math.max(1, ...weekly.map((d) => d.count))
  const age = getTradeAgeBuckets(trades)
  const scoreDist = getValidationScoreDistribution(trades)
  const scoreMax = Math.max(1, scoreDist.low, scoreDist.mid, scoreDist.high)

  return (
    <div>
      <SectionHeader title="Visual Analytics" />
      <Grid cols="grid-cols-1 lg:grid-cols-3">
        <Card delay={0.05}>
          <CardTitle icon={CalendarClock} title="Weekly Day Pattern" subtitle="Mon–Sun activity" />
          {trades.length === 0 ? (
            <EmptyHint>See which weekdays you trade most.</EmptyHint>
          ) : (
            <div className="flex flex-col gap-1.5">
              {weekly.map((d) => (
                <HBar key={d.label} label={d.label} pct={(d.count / weeklyMax) * 100} value={d.count} />
              ))}
            </div>
          )}
        </Card>

        <Card delay={0.08}>
          <CardTitle icon={Hourglass} title="Trade Age" subtitle="pending freshness" />
          {age.total === 0 ? (
            <EmptyHint>No pending trades right now.</EmptyHint>
          ) : (
            <div className="flex flex-col gap-2">
              <motion.div
                className="flex h-3 overflow-hidden rounded-full"
                style={{ backgroundColor: 'var(--ta-bg)' }}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: false, amount: 0.6 }}
                variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.08 } } }}
              >
                {age.fresh > 0 && (
                  <motion.div
                    variants={{ hidden: { width: 0 }, visible: { width: `${(age.fresh / age.total) * 100}%` } }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    style={{ backgroundColor: AGE_COLORS.fresh }}
                  />
                )}
                {age.mid > 0 && (
                  <motion.div
                    variants={{ hidden: { width: 0 }, visible: { width: `${(age.mid / age.total) * 100}%` } }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    style={{ backgroundColor: AGE_COLORS.mid }}
                  />
                )}
                {age.old > 0 && (
                  <motion.div
                    variants={{ hidden: { width: 0 }, visible: { width: `${(age.old / age.total) * 100}%` } }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    style={{ backgroundColor: AGE_COLORS.old }}
                  />
                )}
              </motion.div>
              <div className="flex justify-between text-[8px]" style={{ color: 'var(--ta-slate)' }}>
                <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: AGE_COLORS.fresh, display: 'inline-block' }} />0–7d (<CountUp value={age.fresh} />)</span>
                <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: AGE_COLORS.mid, display: 'inline-block' }} />7–30d (<CountUp value={age.mid} />)</span>
                <span className="flex items-center gap-1"><i className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: AGE_COLORS.old, display: 'inline-block' }} />30+d (<CountUp value={age.old} />)</span>
              </div>
            </div>
          )}
        </Card>

        <Card delay={0.11}>
          <CardTitle icon={Target} title="Validation Score Distribution" subtitle="validity % breakdown" />
          {scoreDist.low + scoreDist.mid + scoreDist.high === 0 ? (
            <EmptyHint>Score trades against your validation rules to see this.</EmptyHint>
          ) : (
            <div className="flex flex-col gap-1.5">
              <HBar label="0–30%" pct={(scoreDist.low / scoreMax) * 100} value={scoreDist.low} color="#b3503a" />
              <HBar label="30–60%" pct={(scoreDist.mid / scoreMax) * 100} value={scoreDist.mid} color="#eb5e28" />
              <HBar label="60–100%" pct={(scoreDist.high / scoreMax) * 100} value={scoreDist.high} color="#5f8a52" />
            </div>
          )}
        </Card>
      </Grid>
    </div>
  )
}
