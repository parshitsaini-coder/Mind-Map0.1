import { useSyncExternalStore } from 'react'
import { Group, Row, Sw, Rng, Seg } from './SettingsControls'
import { emitTerminalEvent } from '../../lib/terminal/effects'
import { getFx, subscribeFx } from '../../lib/terminal/fxState'
import { prefersReduced } from '../../lib/terminal/animSettings'
import { useAnimMode } from './useAnimMode'
import { sampleEvent } from './fxSamples'
import { retryFullMotion } from './fxGuard'

// Settings → Animations (Phase 13). Every control writes through chartSettings.anim.* (validated, live, Cancel reverts).
const MODES = [{ id: 'full', label: 'Full' }, { id: 'reduced', label: 'Reduced' }, { id: 'off', label: 'Off' }]
const TRY = [['order.buy.filled', 'Buy filled'], ['order.pending.triggered', 'Limit triggered'], ['position.tp.hit', 'Take profit'], ['position.sl.hit', 'Stop loss'], ['order.rejected', 'Rejected'], ['account.stopout', 'Stop-out']]

export default function AnimationsTab() {
  const mode = useAnimMode()
  const degraded = useSyncExternalStore(subscribeFx, () => getFx().degraded, () => false)
  return (
    <>
      <Group title="Motion">
        <Seg path="anim.mode" label="Animations" options={MODES} hint="Full: every effect. Reduced: short fades only, no particles or shaking. Off: plain toasts, nothing moves." />
        <Sw path="anim.matchSystem" label="Match system reduced-motion" hint={prefersReduced() ? 'Your device asks for less motion, so Reduced is in use.' : 'Switches to Reduced when your device asks for less motion.'} />
        <div className="py-1 text-[11px]" style={{ color: 'var(--tm-muted)' }} role="status" data-testid="anim-effective">Right now: <b style={{ color: 'var(--tm-text)' }}>{mode === 'full' ? 'Full' : mode === 'reduced' ? 'Reduced' : 'Off'}</b></div>
        {degraded && (
          <Row label="Motion was reduced automatically" hint="The chart was running slowly while animating.">
            <button type="button" onClick={retryFullMotion} className="tm-tap h-8 rounded border px-3 text-[11px] font-semibold" style={{ borderColor: 'var(--tm-border2)', color: 'var(--tm-text)' }}>Try full motion</button>
          </Row>
        )}
      </Group>
      <Group title="Order popup">
        <Seg path="anim.popup" label="When an order completes" options={[{ id: 'full', label: 'Popup card' }, { id: 'toast', label: 'Toast only' }]} />
        <Rng path="anim.seconds" label="Popup time" min={1} max={4} step={0.5} unit=" s" digits={1} />
        <Seg path="anim.position" label="Popup position" options={[{ id: 'top', label: 'Top' }, { id: 'bottom', label: 'Bottom' }]} />
        <Sw path="anim.alsoToast" label="Also show the toast" hint="Keep the toast next to the popup." />
        <Sw path="anim.confetti" label="Confetti for a new best trade" />
      </Group>
      <Group title="Chart effects">
        <Sw path="anim.fx.open" label="Position opens" hint="Entry line draws in, SL / TP slide in." />
        <Sw path="anim.fx.trigger" label="Limit / stop triggers" hint="Ring and a LIMIT FILLED / STOP TRIGGERED badge." />
        <Sw path="anim.fx.tp" label="Take profit hit" hint="Shockwave, rising particles, TARGET HIT badge." />
        <Sw path="anim.fx.sl" label="Stop loss hit" hint="Red flash, short shake, STOPPED OUT badge." />
        <Sw path="anim.fx.margin" label="Margin warning" hint="Chart border and account strip pulse." />
        <Sw path="anim.fx.stopout" label="Stop-out" hint="Red vignette, lines collapse." />
        <Sw path="anim.fx.alert" label="Price alert" hint="Rings around the alert level." />
        <Sw path="anim.fx.other" label="Other cues" hint="Modified, cancelled, closed, partial close, reversed." />
      </Group>
      <Group title="Interface">
        <Sw path="anim.rows" label="Animate rows" hint="Positions, Orders and History rows slide in, out and re-order." />
        <Sw path="anim.flash" label="Flash changing numbers" hint="Balance, equity and P/L flash green / red when they change." />
      </Group>
      <Group title="Try it">
        <div className="flex flex-wrap gap-2 py-1">
          {TRY.map(([id, label]) => (
            <button key={id} type="button" data-try={id} onClick={() => emitTerminalEvent(sampleEvent(id))} className="tm-tap h-9 rounded border px-3 text-[12px] font-semibold hover:bg-white/10" style={{ borderColor: 'var(--tm-border2)', color: 'var(--tm-text)' }}>{label}</button>
          ))}
        </div>
        <div className="pb-1 text-[10px]" style={{ color: 'var(--tm-muted)' }}>These play the real effect (and sound) with sample numbers. No order is placed.</div>
      </Group>
    </>
  )
}
