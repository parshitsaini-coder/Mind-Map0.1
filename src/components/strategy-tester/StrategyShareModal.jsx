import { useCallback, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Share2, X, Link2, Copy, Check, ExternalLink, Eye, Loader2, Clock3, RefreshCw, LogIn, Sparkles, Ban, Send } from 'lucide-react'
import { useStrategyTesterStore } from '../../store/strategyTesterStore'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import {
  createStrategyShare,
  updateStrategyShareData,
  fetchOwnStrategyShares,
  endStrategyShare,
  strategyShareUrl,
  expiryLabel,
  LIVE_EXPIRY_OPTIONS,
} from '../../lib/strategyShare'

const SPRING = { type: 'spring', stiffness: 640, damping: 40, mass: 0.6 }

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    window.prompt('Copy this link:', text)
    return false
  }
}

const notify = () => window.dispatchEvent(new Event('strategy-share-changed'))

// Share popup for ONE strategy: pick how long the link lives → Create →
// copy / send / open it. Existing links for this strategy are listed below
// with views, time left, Copy and End. Links stay in sync while the Strategy
// Tester is open (see useStrategyShareSync), "Sync now" forces it.
export default function StrategyShareModal({ open, strategyId, onClose }) {
  const strategies = useStrategyTesterStore((s) => s.strategies)
  const entries = useStrategyTesterStore((s) => s.entries)
  const user = useAuthStore((s) => s.user)
  const strategy = strategies.find((s) => s.id === strategyId)

  const [expiry, setExpiry] = useState('7d')
  const [links, setLinks] = useState([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState(null)
  const [justCreated, setJustCreated] = useState(null)
  const [syncing, setSyncing] = useState(null)

  const stats = useMemo(() => {
    if (!strategy) return null
    const own = entries?.[strategy.id] || {}
    const rows = Object.keys(own).length
    const months = new Set(Object.keys(own).map((k) => k.slice(0, 7))).size
    return { rows, months, fields: strategy.fields.length }
  }, [strategy, entries])

  const reload = useCallback(async () => {
    if (!user?.id || !strategyId) return
    setLoading(true)
    setLinks(await fetchOwnStrategyShares(user.id, strategyId))
    setLoading(false)
  }, [user?.id, strategyId])

  useEffect(() => {
    if (!open) return
    setError('')
    setJustCreated(null)
    reload()
  }, [open, reload])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, onClose])

  const copy = async (id) => {
    const ok = await copyText(strategyShareUrl(id))
    if (ok) {
      setCopiedId(id)
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1600)
    }
  }

  const create = async () => {
    if (!strategy || creating) return
    setCreating(true)
    setError('')
    const res = await createStrategyShare({
      userId: user?.id,
      strategy,
      entries: useStrategyTesterStore.getState().entries,
      themeName: useStrategyTesterStore.getState().theme,
      expiryValue: expiry,
    })
    setCreating(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setJustCreated(res.id)
    notify()
    await reload()
    if (await copyText(strategyShareUrl(res.id))) {
      setCopiedId(res.id)
      setTimeout(() => setCopiedId((c) => (c === res.id ? null : c)), 1600)
      useUiStore.getState().showToast('Link created & copied')
    }
  }

  const end = async (id) => {
    setLinks((l) => l.filter((x) => x.id !== id))
    await endStrategyShare(id)
    notify()
    useUiStore.getState().showToast('Link closed')
  }

  const sync = async (id) => {
    setSyncing(id)
    const st = useStrategyTesterStore.getState()
    const res = await updateStrategyShareData(id, { strategy, entries: st.entries, themeName: st.theme })
    setSyncing(null)
    if (res.error) setError(res.error)
    else {
      useUiStore.getState().showToast('Shared view updated')
      reload()
    }
  }

  const send = async (id) => {
    const url = strategyShareUrl(id)
    if (navigator.share) {
      try {
        await navigator.share({ title: `${strategy?.name} — strategy`, url })
        return
      } catch {
        /* cancelled */
      }
    }
    copy(id)
  }

  const needsLogin = !user
  const notConfigured = !isSupabaseConfigured

  return (
    <AnimatePresence>
      {open && strategy && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.12 } }}
          transition={{ duration: 0.16 }}
        >
          <div className="absolute inset-0 bg-black/40" onMouseDown={onClose} />
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.12 } }}
            transition={SPRING}
            className="relative flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-2xl"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 border-b px-4 py-3" style={{ borderColor: 'color-mix(in srgb, var(--ta-slate) 40%, transparent)' }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: 'var(--ta-accent)', color: '#fffcf2' }}>
                <Share2 size={14} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold leading-tight">Share strategy</p>
                <p className="truncate text-[9.5px]" style={{ color: 'var(--ta-slate)' }}>
                  {strategy.name}
                  {stats && ` · ${stats.rows} entries · ${stats.months} month${stats.months === 1 ? '' : 's'}`}
                </p>
              </div>
              <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-black/5" aria-label="Close">
                <X size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-4 overflow-y-auto px-4 py-4">
              {needsLogin || notConfigured ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center" style={{ borderColor: 'var(--ta-slate)' }}>
                  <LogIn size={20} style={{ color: 'var(--ta-accent)' }} />
                  <p className="text-[11px] font-semibold">{notConfigured ? 'Cloud sharing isn’t set up yet' : 'Log in to create a share link'}</p>
                  <p className="max-w-[260px] text-[9.5px]" style={{ color: 'var(--ta-slate)' }}>
                    {notConfigured
                      ? 'Add your Supabase keys (see SUPABASE_SETUP.md) so links have somewhere to live.'
                      : 'A link needs your account so it can stay up to date and be closed later.'}
                  </p>
                </div>
              ) : (
                <>
                  {/* What's shared */}
                  <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-[9.5px]" style={{ backgroundColor: 'color-mix(in srgb, var(--ta-accent) 9%, transparent)' }}>
                    <Sparkles size={12} className="mt-[1px] shrink-0" style={{ color: 'var(--ta-accent)' }} />
                    <p>
                      Anyone with the link sees this strategy's <b>Table</b> and <b>Analysis</b> (all months) — view-only, no login needed. Other strategies and
                      your account stay private. It updates by itself while you edit.
                    </p>
                  </div>

                  {/* Expiry */}
                  <div>
                    <p className="mb-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
                      <Clock3 size={10} /> Link stays open for
                    </p>
                    <div className="grid grid-cols-5 gap-1 rounded-xl p-1" style={{ backgroundColor: 'var(--ta-bg)' }}>
                      {LIVE_EXPIRY_OPTIONS.map((o) => {
                        const on = expiry === o.value
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => setExpiry(o.value)}
                            className="relative rounded-lg px-1 py-1.5 text-[9px] font-semibold"
                            style={{ color: on ? '#fffcf2' : 'var(--ta-ink)', transition: 'color 0.15s ease' }}
                          >
                            {on && (
                              <motion.span
                                layoutId="st-share-expiry"
                                transition={SPRING}
                                className="absolute inset-0 rounded-lg"
                                style={{ backgroundColor: 'var(--ta-accent)' }}
                              />
                            )}
                            <span className="relative">{o.label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={create}
                    disabled={creating}
                    className="flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-bold disabled:opacity-70"
                    style={{ background: 'var(--ta-accent)', color: '#fffcf2' }}
                  >
                    {creating ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />}
                    {creating ? 'Creating…' : 'Create share link'}
                  </motion.button>

                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden rounded-lg px-3 py-2 text-[9.5px]"
                        style={{ backgroundColor: '#dc262614', color: '#dc2626' }}
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  {/* Existing links */}
                  <div>
                    <p className="mb-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
                      Active links {loading && <Loader2 size={9} className="animate-spin" />}
                    </p>
                    {links.length === 0 && !loading ? (
                      <p className="rounded-xl border border-dashed px-3 py-4 text-center text-[9.5px]" style={{ borderColor: 'var(--ta-slate)', color: 'var(--ta-slate)' }}>
                        No links yet — create one above.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <AnimatePresence initial={false}>
                          {links.map((l) => {
                            const url = strategyShareUrl(l.id)
                            const fresh = justCreated === l.id
                            return (
                              <motion.div
                                key={l.id}
                                layout
                                initial={{ opacity: 0, y: 8, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, x: 16, transition: { duration: 0.12 } }}
                                transition={SPRING}
                                className="rounded-xl border p-2.5"
                                style={{
                                  borderColor: fresh ? 'var(--ta-accent)' : 'color-mix(in srgb, var(--ta-slate) 45%, transparent)',
                                  boxShadow: fresh ? '0 0 0 3px color-mix(in srgb, var(--ta-accent) 18%, transparent)' : 'none',
                                }}
                              >
                                <div className="flex items-center gap-1.5">
                                  <input
                                    readOnly
                                    value={url}
                                    onFocus={(e) => e.target.select()}
                                    className="min-w-0 flex-1 rounded-md bg-transparent px-2 py-1 text-[9.5px] outline-none"
                                    style={{ backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }}
                                  />
                                  <motion.button
                                    type="button"
                                    whileTap={{ scale: 0.92 }}
                                    onClick={() => copy(l.id)}
                                    className="flex w-[64px] items-center justify-center gap-1 rounded-md py-1 text-[9px] font-bold"
                                    style={{ background: copiedId === l.id ? '#16a34a' : 'var(--ta-accent)', color: '#fffcf2', transition: 'background-color 0.18s ease' }}
                                  >
                                    {copiedId === l.id ? <Check size={11} /> : <Copy size={11} />}
                                    {copiedId === l.id ? 'Copied' : 'Copy'}
                                  </motion.button>
                                </div>
                                <div className="mt-2 flex items-center gap-2 text-[9px]" style={{ color: 'var(--ta-slate)' }}>
                                  <span className="flex items-center gap-0.5">
                                    <Eye size={10} /> {l.view_count ?? 0}
                                  </span>
                                  <span className="flex items-center gap-0.5">
                                    <Clock3 size={10} /> {expiryLabel(l.expires_at)}
                                  </span>
                                  <span className="ml-auto flex items-center gap-1">
                                    <IconBtn title="Send / share" onClick={() => send(l.id)}>
                                      <Send size={11} />
                                    </IconBtn>
                                    <IconBtn title="Open in new tab" onClick={() => window.open(url, '_blank', 'noopener')}>
                                      <ExternalLink size={11} />
                                    </IconBtn>
                                    <IconBtn title="Update now" onClick={() => sync(l.id)}>
                                      <RefreshCw size={11} className={syncing === l.id ? 'animate-spin' : ''} />
                                    </IconBtn>
                                    <IconBtn title="End link" danger onClick={() => end(l.id)}>
                                      <Ban size={11} />
                                    </IconBtn>
                                  </span>
                                </div>
                              </motion.div>
                            )
                          })}
                        </AnimatePresence>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function IconBtn({ children, title, onClick, danger }) {
  return (
    <motion.button
      type="button"
      title={title}
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      className="flex h-5 w-5 items-center justify-center rounded-md hover:bg-black/5"
      style={{ color: danger ? '#dc2626' : 'var(--ta-ink)' }}
    >
      {children}
    </motion.button>
  )
}
