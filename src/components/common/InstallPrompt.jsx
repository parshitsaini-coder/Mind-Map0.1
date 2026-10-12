import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, X, Share } from 'lucide-react'

// Small "Install app" pill. Android/desktop Chrome & Edge fire
// `beforeinstallprompt` — we keep that event and trigger it on tap. iOS Safari
// has no such event, so there we show a one-line "Share → Add to Home Screen"
// hint instead. Hidden once installed (standalone) or after being dismissed.
const DISMISS_KEY = 'mm-install-dismissed'

const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true

const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent) && !window.MSStream

export default function InstallPrompt() {
  const [deferred, setDeferred] = useState(null)
  const [iosHint, setIosHint] = useState(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    if (isStandalone()) return
    try {
      if (localStorage.getItem(DISMISS_KEY)) return
    } catch { /* storage blocked — just show it */ }

    const onPrompt = (e) => {
      e.preventDefault()
      setDeferred(e)
      setHidden(false)
    }
    const onInstalled = () => {
      setDeferred(null)
      setHidden(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    if (isIos()) {
      setIosHint(true)
      setHidden(false)
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => {
    setHidden(true)
    try { localStorage.setItem(DISMISS_KEY, '1') } catch { /* ignore */ }
  }

  const install = async () => {
    if (!deferred) return
    deferred.prompt()
    await deferred.userChoice.catch(() => {})
    setDeferred(null)
    setHidden(true)
  }

  return (
    <AnimatePresence>
      {!hidden && (deferred || iosHint) && (
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 24, scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          className="fixed left-1/2 z-[200] flex max-w-[92vw] -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold shadow-lg"
          style={{
            bottom: 'calc(env(safe-area-inset-bottom, 0px) + 14px)',
            backgroundColor: '#242423',
            borderColor: '#242423',
            color: '#f5f5f0',
          }}
        >
          {deferred ? (
            <button type="button" onClick={install} className="flex items-center gap-1.5 outline-none">
              <Download size={13} />
              Install app
            </button>
          ) : (
            <span className="flex items-center gap-1.5">
              <Share size={13} />
              Tap Share, then “Add to Home Screen”
            </span>
          )}
          <button type="button" onClick={dismiss} aria-label="Dismiss" className="rounded-full p-0.5 opacity-70 hover:opacity-100">
            <X size={12} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
