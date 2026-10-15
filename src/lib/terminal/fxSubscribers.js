// Connects the bus to the real outputs. Called once by the store, which passes in what the subscribers need.
import { subscribeChannel } from './effects.js'
import { onSoundEvent } from './soundEngine.js'
import { hapticFor } from './soundSettings.js'
import { EVENT_BY_ID } from './eventCatalog.js'
import { osNotify } from './alerts.js'
import { effectiveMode, toastWanted, prefersReduced } from './animSettings.js'
import { popupFor, bannerFor, popupMs } from './popupModel.js'
import { getFx, showPopup, showBanner } from './fxState.js'

export const currentMode = (cs) => effectiveMode(cs && cs.anim, { systemReduced: prefersReduced(), degraded: getFx().degraded })

export function wireEffects({ notify, getCs }) {
  const offs = [
    subscribeChannel('toast', (e) => {
      if (!e.text) return
      const cs = getCs()
      const mode = currentMode(cs)
      if (toastWanted(cs.anim, mode, !!popupFor(e, 'full'))) notify(e.text, e.kind, e.action || null, { ev: e.id })
    }),
    subscribeChannel('popup', (e) => {
      const cs = getCs()
      const mode = currentMode(cs)
      if (e.id === 'account.stopout') { const b = bannerFor(e); if (b) showBanner(b) } // stays until dismissed, whatever the mode
      if (mode === 'off' || cs.anim.popup !== 'full') return
      const m = popupFor(e, mode)
      if (m) showPopup({ ...m, confetti: m.confetti && cs.anim.confetti }, popupMs(cs.anim.seconds))
    }),
    subscribeChannel('sound', (e) => onSoundEvent(e.id, getCs)),
    subscribeChannel('haptic', (e) => {
      const p = hapticFor(getCs(), e.id)
      if (p && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && !(typeof document !== "undefined" && document.hidden)) navigator.vibrate(p)
    }),
    subscribeChannel('os', (e) => { if (e.text && EVENT_BY_ID[e.id]?.loud) osNotify(e.text) }),
  ]
  return () => offs.forEach((f) => f())
}
