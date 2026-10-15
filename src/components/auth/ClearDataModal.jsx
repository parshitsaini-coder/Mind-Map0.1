import { useEffect, useState } from 'react'
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, AtSign, Lock, ShieldAlert, Trash2, X, Loader2, Check } from 'lucide-react'

// Confirmation step for "Clear all data" — friction against misclicks, not
// real access control (same convention as DeleteConfirmModal): the person
// must type their own account ID (email or username) and then re-enter their
// real account password (checked with Supabase) before anything is deleted.
// Accounts without a password (Google sign-in) or when Supabase is not
// configured type the word DELETE instead. No password is stored in the app.
const CONFIRM_WORD = 'DELETE'

const GROUPS = [
  { id: 'trades', label: 'Trade Analysis', hint: 'trades, validation rules' },
  { id: 'strategy', label: 'Strategy Tester', hint: 'strategies & entries' },
  { id: 'terminal', label: 'Demo Terminal', hint: 'virtual account, trades, drawings' },
  { id: 'maps', label: 'Mind Maps', hint: 'every map & tab' },
]

export default function ClearDataModal({ user, onConfirm, onCancel }) {
  const [accountId, setAccountId] = useState('')
  const [password, setPassword] = useState('')
  const [selected, setSelected] = useState({ trades: true, strategy: true, terminal: true, maps: true })
  const [error, setError] = useState('')
  const [shakeKey, setShakeKey] = useState(0)
  const [busy, setBusy] = useState(false)
  // true = verify the account password; false = type the word DELETE.
  const [needsPassword, setNeedsPassword] = useState(false)

  useEffect(() => {
    if (!isSupabaseConfigured || !user?.email) return undefined
    let alive = true
    supabase.auth.getUser().then(({ data }) => {
      const ids = data?.user?.identities || []
      if (alive) setNeedsPassword(ids.some((i) => i.provider === 'email'))
    }).catch(() => {})
    return () => { alive = false }
  }, [user?.email])

  const anySelected = Object.values(selected).some(Boolean)

  const fail = (msg) => {
    setError(msg)
    setShakeKey((k) => k + 1)
    setPassword('')
  }

  const handleConfirm = async () => {
    if (busy) return
    const typed = accountId.trim().toLowerCase()
    const valid = [user.email, user.username, user.name].filter(Boolean).map((v) => String(v).toLowerCase())
    if (!anySelected) return fail('Select at least one thing to clear.')
    if (!typed || !valid.includes(typed)) return fail('That ID doesn’t match this account.')
    setError('')
    setBusy(true)
    try {
      if (needsPassword) {
        const { error: authErr } = await supabase.auth.signInWithPassword({ email: user.email, password })
        if (authErr) { setBusy(false); return fail('Incorrect password. Try again.') }
      } else if (password.trim() !== CONFIRM_WORD) {
        setBusy(false)
        return fail(`Wrong password — type ${CONFIRM_WORD} exactly.`)
      }
      await onConfirm(selected)
    } finally {
      setBusy(false)
    }
  }

  const inputWrap = (hasError) =>
    `flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors ${
      hasError ? 'border-red-400/70' : 'border-white/20 focus-within:border-red-300/70'
    }`

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
        onClick={(e) => e.target === e.currentTarget && !busy && onCancel()}
      >
        <motion.div
          key={shakeKey}
          initial={{ opacity: 0, y: 24, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1, x: error ? [0, -9, 9, -7, 7, -4, 4, 0] : 0 }}
          exit={{ opacity: 0, y: 10, scale: 0.92, filter: 'blur(4px)' }}
          transition={{ default: { type: 'spring', stiffness: 320, damping: 24 }, x: { duration: 0.45, ease: 'easeInOut' } }}
          className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-red-400/30 p-6 text-white shadow-[0_8px_48px_rgba(220,38,38,0.35)]"
          style={{
            background: 'linear-gradient(160deg, rgba(127,29,29,0.88), rgba(24,10,10,0.92))',
            backdropFilter: 'blur(22px)',
            WebkitBackdropFilter: 'blur(22px)',
          }}
        >
          {/* Pulsing danger glow + highlight edge */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -left-12 -top-16 h-44 w-44 rounded-full bg-red-500/40 blur-3xl"
            animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.15, 1] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
          />
          <div className="pointer-events-none absolute -bottom-16 -right-10 h-40 w-40 rounded-full bg-orange-500/20 blur-3xl" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-red-300/70 to-transparent" />

          <button
            onClick={onCancel}
            disabled={busy}
            className="absolute right-3 top-3 rounded-full p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
            aria-label="Close"
          >
            <X size={15} />
          </button>

          <div className="relative flex flex-col items-center text-center">
            <motion.div
              animate={{ boxShadow: ['0 0 0 0 rgba(248,113,113,0.5)', '0 0 0 14px rgba(248,113,113,0)'] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
              className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-red-400/50"
              style={{ background: 'linear-gradient(160deg, rgba(248,113,113,0.4), rgba(248,113,113,0.1))' }}
            >
              <motion.span animate={{ rotate: [0, -8, 8, -6, 6, 0] }} transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.6 }} className="flex">
                <AlertTriangle size={24} className="text-red-200" />
              </motion.span>
            </motion.div>

            <h2 className="text-[15px] font-bold tracking-wide text-red-100">Clear all data?</h2>
            <p className="mt-1 text-[11.5px] leading-snug text-white/65">
              This permanently deletes your data from this device <b>and the cloud</b>. It can&apos;t be undone.
            </p>

            {/* What to clear */}
            <div className="mt-4 flex w-full flex-col gap-1.5">
              {GROUPS.map((g) => {
                const on = selected[g.id]
                return (
                  <motion.button
                    key={g.id}
                    type="button"
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setSelected((s) => ({ ...s, [g.id]: !s[g.id] }))}
                    className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors"
                    style={{
                      borderColor: on ? 'rgba(248,113,113,0.6)' : 'rgba(255,255,255,0.15)',
                      background: on ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
                    }}
                  >
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border"
                      style={on ? { background: '#ef4444', borderColor: '#ef4444' } : { borderColor: 'rgba(255,255,255,0.35)' }}
                    >
                      {on && <Check size={11} color="#fff" />}
                    </span>
                    <span className="flex flex-col leading-tight">
                      <span className="text-[11.5px] font-semibold text-white">{g.label}</span>
                      <span className="text-[9.5px] text-white/50">{g.hint}</span>
                    </span>
                  </motion.button>
                )
              })}
            </div>

            {/* ID + password */}
            <div className="mt-4 flex w-full flex-col gap-2">
              <div className={inputWrap(!!error && error.includes('ID'))} style={{ background: 'rgba(255,255,255,0.06)' }}>
                <AtSign size={14} className="text-white/50" />
                <input
                  type="text"
                  autoFocus
                  value={accountId}
                  onChange={(e) => { setAccountId(e.target.value); if (error) setError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                  placeholder="Your ID (email or username)"
                  className="w-full bg-transparent text-[13px] text-white placeholder-white/35 outline-none"
                />
              </div>
              <div className={inputWrap(!!error && error.includes('password'))} style={{ background: 'rgba(255,255,255,0.06)' }}>
                <Lock size={14} className="text-white/50" />
                <input
                  type={needsPassword ? 'password' : 'text'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); if (error) setError('') }}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                  placeholder={needsPassword ? 'Enter your account password' : `Type ${CONFIRM_WORD} to confirm`}
                  className="w-full bg-transparent text-[13px] text-white placeholder-white/35 outline-none"
                />
              </div>
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-1 text-left text-[10.5px] text-red-300"
                  >
                    <ShieldAlert size={11} /> {error}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div className="mt-5 flex w-full gap-2">
              <button
                onClick={onCancel}
                disabled={busy}
                className="flex-1 rounded-xl border border-white/20 py-2 text-[12px] font-medium text-white/80 transition-colors hover:bg-white/10 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-[12px] font-semibold text-white shadow-lg transition-transform active:scale-[0.97] disabled:opacity-70"
                style={{ background: 'linear-gradient(135deg, #ef4444, #991b1b)' }}
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                {busy ? 'Clearing…' : 'Clear all'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
