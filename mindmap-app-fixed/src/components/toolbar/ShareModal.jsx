import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Link2, Radio, Copy, Square } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useMapStore } from '../../store/mapStore'
import { useAuthStore } from '../../store/authStore'
import { useLiveShareStore } from '../../store/liveShareStore'
import { buildShareUrl } from '../../utils/exportShareLink'
import { LIVE_EXPIRY_OPTIONS } from '../../lib/liveShare'
import { isSupabaseConfigured } from '../../lib/supabaseClient'

async function copyToClipboard(url) {
  try {
    await navigator.clipboard.writeText(url)
    return true
  } catch {
    window.prompt('Copy this link:', url)
    return false
  }
}

function liveShareUrl(id) {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('live', id)
  return url.toString()
}

function OneTimeTab() {
  const nodes = useMapStore((s) => s.nodes)
  const edges = useMapStore((s) => s.edges)
  const showToast = useUiStore((s) => s.showToast)
  const [busy, setBusy] = useState(false)

  const handleCopy = async () => {
    setBusy(true)
    const result = buildShareUrl(nodes, edges)
    setBusy(false)
    if (result.error) {
      showToast(result.error)
      return
    }
    const copied = await copyToClipboard(result.url)
    showToast(result.warning || (copied ? 'View-only link copied to clipboard' : 'Link ready — copy it above'))
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-snug text-[var(--color-slate)]">
        A snapshot of the map exactly as it is right now, encoded straight into the link — works for anyone, no
        account needed. Later edits you make here won't show up for people who already have this link.
      </p>
      <button
        onClick={handleCopy}
        disabled={busy}
        className="flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-[var(--color-ink)] hover:opacity-90 disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-accent)' }}
      >
        <Copy size={13} /> {busy ? 'Building link…' : 'Copy one-time link'}
      </button>
    </div>
  )
}

function LiveTab() {
  const nodes = useMapStore((s) => s.nodes)
  const edges = useMapStore((s) => s.edges)
  const activeProjectId = useMapStore((s) => s.activeProjectId)
  const authUser = useAuthStore((s) => s.user)
  const toggleAuthModal = useUiStore((s) => s.toggleAuthModal)
  const showToast = useUiStore((s) => s.showToast)
  const getActiveLink = useLiveShareStore((s) => s.getActiveLink)
  const createOrUpdate = useLiveShareStore((s) => s.createOrUpdate)
  const endSession = useLiveShareStore((s) => s.endSession)
  // Subscribed only so this tab re-renders after create/end (getActiveLink
  // itself isn't reactive state) — value itself is unused.
  useLiveShareStore((s) => s.links)
  const [expiryValue, setExpiryValue] = useState('24h')
  const [busy, setBusy] = useState(false)

  const projectId = activeProjectId || 'default'
  const activeLink = getActiveLink(projectId)

  if (!isSupabaseConfigured) {
    return (
      <p className="text-xs leading-snug text-[var(--color-slate)]">
        Live links need cloud save set up (Supabase keys) — see <code>SUPABASE_SETUP.md</code>. Use the one-time
        link in the meantime.
      </p>
    )
  }

  if (!authUser) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-xs leading-snug text-[var(--color-slate)]">
          A live link stays in sync with your edits, so it needs somewhere to save to. Log in to create one.
        </p>
        <button
          onClick={() => {
            useUiStore.getState().toggleShareModal()
            toggleAuthModal()
          }}
          className="rounded-md border border-[var(--color-slate)] py-1.5 text-xs hover:bg-[var(--color-sage)]/40"
        >
          Log in / sign up
        </button>
      </div>
    )
  }

  const handleCreate = async () => {
    setBusy(true)
    const result = await createOrUpdate({ userId: authUser.id, projectId, nodes, edges, expiryValue })
    setBusy(false)
    if (result.error) {
      showToast(result.error)
      return
    }
    const copied = await copyToClipboard(liveShareUrl(result.id))
    showToast(copied ? 'Live link copied — it updates as you edit' : 'Live link ready — copy it above')
  }

  const handleCopyExisting = async () => {
    const copied = await copyToClipboard(liveShareUrl(activeLink.id))
    showToast(copied ? 'Live link copied to clipboard' : 'Link ready — copy it above')
  }

  const handleEnd = async () => {
    if (!window.confirm('End this live link? Anyone with it will see "link ended" from now on.')) return
    setBusy(true)
    await endSession(projectId)
    setBusy(false)
    showToast('Live link ended')
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-snug text-[var(--color-slate)]">
        A short link that always shows the latest version of this map — anyone who refreshes it sees your newest
        edits, until it expires or you end it.
      </p>

      {activeLink ? (
        <>
          <div
            className="flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium"
            style={{ borderColor: 'var(--color-sage)', color: 'var(--color-ink)' }}
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3fa66a] opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#3fa66a]" />
            </span>
            Live —{' '}
            {activeLink.expiresAt
              ? `expires ${new Date(activeLink.expiresAt).toLocaleString()}`
              : 'no expiry'}
          </div>
          <button
            onClick={handleCopyExisting}
            className="flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-[var(--color-ink)] hover:opacity-90"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            <Copy size={13} /> Copy live link
          </button>
          <button
            onClick={handleEnd}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-md border border-[#c1443c] py-1.5 text-xs text-[#c1443c] hover:bg-[#c1443c]/10 disabled:opacity-50"
          >
            <Square size={11} /> End live session
          </button>
        </>
      ) : (
        <>
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
              Expires after
            </label>
            <select
              value={expiryValue}
              onChange={(e) => setExpiryValue(e.target.value)}
              className="w-full rounded-md border px-2 py-1.5 text-xs"
              style={{ borderColor: 'var(--color-sage)', backgroundColor: 'var(--color-cream)' }}
            >
              {LIVE_EXPIRY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleCreate}
            disabled={busy}
            className="flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-[var(--color-ink)] hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            <Radio size={13} /> {busy ? 'Creating…' : 'Create live link'}
          </button>
        </>
      )}
    </div>
  )
}

export default function ShareModal() {
  const open = useUiStore((s) => s.shareModalOpen)
  const toggle = useUiStore((s) => s.toggleShareModal)
  const [tab, setTab] = useState('once') // 'once' | 'live'

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={toggle}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xs rounded-lg border shadow-xl"
          style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
        >
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--color-sage)' }}>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              <Link2 size={15} /> Share mind map
            </h2>
            <button onClick={toggle} className="rounded p-0.5 hover:bg-[var(--color-sage)]">
              <X size={14} />
            </button>
          </div>

          <div className="flex border-b text-xs" style={{ borderColor: 'var(--color-sage)' }}>
            <button
              onClick={() => setTab('once')}
              className={`flex-1 py-2 font-medium ${tab === 'once' ? '' : 'text-[var(--color-slate)]'}`}
              style={tab === 'once' ? { borderBottom: '2px solid var(--color-accent)', color: 'var(--color-ink)' } : {}}
            >
              One-time
            </button>
            <button
              onClick={() => setTab('live')}
              className={`flex-1 py-2 font-medium ${tab === 'live' ? '' : 'text-[var(--color-slate)]'}`}
              style={tab === 'live' ? { borderBottom: '2px solid var(--color-accent)', color: 'var(--color-ink)' } : {}}
            >
              Live
            </button>
          </div>

          <div className="p-4">{tab === 'once' ? <OneTimeTab /> : <LiveTab />}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
