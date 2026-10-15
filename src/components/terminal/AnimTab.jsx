import { Group, Sw, Sel, Seg, Rng } from './SettingsControls'
import { useMotion } from './motionHooks'
import { useTerminalStore } from '../../store/terminalStore'

// Settings → Animations
export default function AnimTab() {
  const mo = useMotion()
  const adaptive = useTerminalStore((s) => s.adaptive)
  const sys = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  return (
    <>
      <Group title="Motion">
        <Seg path="anim.mode" label="Animations" options={[{ id: 'full', label: 'Full' }, { id: 'reduced', label: 'Reduced' }, { id: 'off', label: 'Off' }]} />
        <Sw path="anim.matchSystem" label="Match system reduced-motion" hint={sys ? 'Your system asks for reduced motion — Full is shown as Reduced.' : 'When your system asks for less motion, Full becomes Reduced (120 ms fades, no particles).'} />
        {adaptive && <p role="status" className="py-1 text-[11px]" style={{ color: '#fbbf24' }}>Motion was reduced automatically this session because the chart was running slowly.</p>}
        {mo.mode !== 'full' && <p className="py-1 text-[10px]" style={{ color: 'var(--tm-muted)' }}>Now showing: {mo.mode === 'off' ? 'no animation (plain toasts)' : 'reduced motion'}.</p>}
      </Group>
      <Group title="Order popup">
        <Sel path="anim.popup" label="Order popup" options={[{ id: 'full', label: 'Full popup' }, { id: 'toast', label: 'Toast only' }, { id: 'off', label: 'Off (errors still show)' }]} />
        <Rng path="anim.popupSeconds" label="Popup time" min={1} max={4} step={0.2} unit=" s" digits={1} />
        <Seg path="anim.popupPos" label="Position" options={[{ id: 'top', label: 'Top' }, { id: 'bottom', label: 'Bottom' }]} />
        <Sw path="anim.alsoToast" label="Also show the toast" hint="With the full popup. Errors always show a toast." />
      </Group>
      <Group title="Effects">
        <Sw path="anim.chartFx" label="Chart effects" hint="Rings, shockwaves, line glow when orders fill or SL / TP hit." />
        <Sw path="anim.particles" label="Particles" hint="Sparkles on wins and take-profit." />
        <Sw path="anim.shake" label="Shake" hint="Short shake on a stop loss, a stop-out or a rejected order." />
        <Sw path="anim.rows" label="List motion" hint="Rows slide in and out of Positions, Orders and History." />
      </Group>
    </>
  )
}
