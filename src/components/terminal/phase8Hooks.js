import { useEffect, useSyncExternalStore } from 'react'
import { useTerminalStore } from '../../store/terminalStore'
import { TIMEFRAMES } from '../../lib/terminal/instruments'

// Browser online/offline, as a hook.
export const useOnline = () =>
  useSyncExternalStore(
    (cb) => { window.addEventListener('online', cb); window.addEventListener('offline', cb); return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb) } },
    () => navigator.onLine !== false,
    () => true,
  )

export const wakeLockSupported = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator

// Keeps the screen on while `active`. The browser drops the lock whenever the tab is hidden, so it
// is requested again when the tab comes back. Silent no-op where unsupported or refused (battery saver…).
export function useWakeLock(active) {
  useEffect(() => {
    if (!active || !wakeLockSupported()) return undefined
    let sentinel = null
    let cancelled = false
    const acquire = async () => {
      try {
        const s = await navigator.wakeLock.request('screen')
        if (cancelled) { s.release().catch(() => {}); return }
        sentinel = s
      } catch { /* refused — nothing to do */ }
    }
    const onVisible = () => { if (!document.hidden && (!sentinel || sentinel.released)) acquire() }
    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      sentinel?.release().catch(() => {})
    }
  }, [active])
}

// True when the key press is meant for a text field (or has a modifier), so shortcuts stay out of the way.
export function isTypingTarget(e) {
  const t = e.target
  if (e.ctrlKey || e.metaKey || e.altKey) return true
  if (!t || !t.tagName) return false
  return t.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)
}

export const SHORTCUTS = [
  ['B / S', 'Buy / Sell (same as pressing the button — respects one-click)'],
  ['Enter', 'Confirm the pending Buy / Sell'],
  ['Esc', 'Cancel confirmation · close panels · leave drawing tool · then close the terminal'],
  [`1 – ${TIMEFRAMES.length}`, `Timeframes ${TIMEFRAMES.map((t) => t.id).join(' ')}`],
  ['+  /  −', 'Zoom the active chart in / out'],
  ['?', 'This list'],
]

// Desktop keyboard shortcuts. `onHelp` opens the shortcut list.
export function useTerminalHotkeys(enabled, onHelp) {
  useEffect(() => {
    if (!enabled) return undefined
    const onKey = (e) => {
      if (e.repeat || isTypingTarget(e)) return
      const st = useTerminalStore.getState()
      const k = e.key
      if (k === 'b' || k === 'B') { st.fireHotkey('buy'); e.preventDefault() }
      else if (k === 's' || k === 'S') { st.fireHotkey('sell'); e.preventDefault() }
      else if (k === 'Enter' && st.ticketPending) { st.fireHotkey('confirm'); e.preventDefault() }
      else if (/^[1-9]$/.test(k) && TIMEFRAMES[Number(k) - 1]) { st.setTimeframe(TIMEFRAMES[Number(k) - 1].id); e.preventDefault() }
      else if (k === '+' || k === '=') { window.dispatchEvent(new CustomEvent('tm-zoom', { detail: 1 })); e.preventDefault() }
      else if (k === '-' || k === '_') { window.dispatchEvent(new CustomEvent('tm-zoom', { detail: -1 })); e.preventDefault() }
      else if (k === '?') { onHelp?.(); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled, onHelp])
}
