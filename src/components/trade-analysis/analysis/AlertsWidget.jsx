import { BellRing, AlertTriangle, Info } from 'lucide-react'
import { getAlerts } from '../../../utils/tradeAnalytics'
import { Card, CardTitle } from './primitives'

const TONE_STYLE = {
  warn: { bg: 'color-mix(in srgb, var(--ta-surface) 85%, #b3503a 15%)', icon: AlertTriangle, color: '#9c4a34' },
  info: { bg: 'color-mix(in srgb, var(--ta-surface) 88%, var(--ta-accent) 12%)', icon: Info, color: 'var(--ta-accent)' },
}

// Step 14 — no alerts means no card at all, per the master prompt (don't
// show an empty "0 alerts" shell).
export default function AlertsWidget({ trades }) {
  const alerts = getAlerts(trades)
  if (alerts.length === 0) return null

  return (
    <Card delay={0.05}>
      <CardTitle icon={BellRing} title="Alerts" badge={alerts.length} />
      <div className="flex flex-col gap-1.5">
        {alerts.map((a) => {
          const tone = TONE_STYLE[a.tone] || TONE_STYLE.info
          const Icon = tone.icon
          return (
            <div key={a.id} className="flex items-start gap-2 rounded-xl px-2 py-1.5" style={{ backgroundColor: tone.bg }}>
              <Icon size={13} className="mt-0.5 shrink-0" style={{ color: tone.color }} />
              <div>
                <div className="text-[9.5px] font-bold" style={{ color: 'var(--ta-ink)' }}>{a.title}</div>
                <div className="text-[8.5px]" style={{ color: 'var(--ta-slate)' }}>{a.detail}</div>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
