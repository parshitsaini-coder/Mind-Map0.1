import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Lock, Trash2, X, ShieldAlert } from 'lucide-react'

// The password gate for deleting a mind map. Kept as a plain constant
// rather than anything server-checked — this is a friction/confirmation
// step against misclicks, not real access control, per the requested
// design (the password is even shown in the modal itself).
const DELETE_PASSWORD = '1007'

// Section — glassmorphic delete confirmation. Frosted-glass card (blurred
// translucent background, soft borders, floating color blobs behind it)
// with a spring entrance, a shake animation on a wrong password, and a
// short "dissolve" exit once the password is confirmed — the project
// itself isn't actually removed from the store until that exit animation
// finishes, so the card never just pops away.
export default function DeleteConfirmModal({ projectName, onConfirm, onCancel }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [shakeKey, setShakeKey] = useState(0)
  const [deleting, setDeleting] = useState(false)

  const handleConfirm = () => {
    if (deleting) return
    if (password.trim() === DELETE_PASSWORD) {
      setError(false)
      setDeleting(true)
      setTimeout(onConfirm, 420)
    } else {
      setError(true)
      setShakeKey((k) => k + 1)
      setPassword('')
    }
  }

  return (
    <AnimatePresence>
      {!deleting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && onCancel()}
        >
          <motion.div
            key={shakeKey}
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
              x: error ? [0, -9, 9, -7, 7, -4, 4, 0] : 0,
            }}
            exit={{ opacity: 0, y: 10, scale: 0.92, filter: 'blur(4px)' }}
            transition={{
              default: { type: 'spring', stiffness: 320, damping: 24 },
              x: { duration: 0.45, ease: 'easeInOut' },
            }}
            className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/25 p-7 text-white shadow-[0_8px_40px_rgba(0,0,0,0.45)]"
            style={{
              background: 'linear-gradient(160deg, rgba(255,255,255,0.14), rgba(255,255,255,0.04))',
              backdropFilter: 'blur(22px)',
              WebkitBackdropFilter: 'blur(22px)',
            }}
          >
            {/* Floating color blobs behind the glass — pure decoration,
                clipped by the card's own overflow-hidden. */}
            <div className="pointer-events-none absolute -left-10 -top-14 h-36 w-36 rounded-full bg-red-500/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -right-10 h-40 w-40 rounded-full bg-orange-400/20 blur-3xl" />
            {/* Thin top highlight — the classic glass "light catching an edge" */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/60 to-transparent" />

            <button
              onClick={onCancel}
              className="absolute right-3 top-3 rounded-full p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={15} />
            </button>

            <div className="relative flex flex-col items-center text-center">
              <motion.div
                animate={{ boxShadow: ['0 0 0 0 rgba(248,113,113,0.35)', '0 0 0 10px rgba(248,113,113,0)'] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: 'easeOut' }}
                className="mb-3 flex h-14 w-14 items-center justify-center rounded-full border border-red-400/40"
                style={{ background: 'linear-gradient(160deg, rgba(248,113,113,0.35), rgba(248,113,113,0.08))' }}
              >
                <Trash2 size={22} className="text-red-300" />
              </motion.div>

              <h2 className="text-[15px] font-semibold text-white">
                Delete "{projectName}"?
              </h2>
              <p className="mt-1 text-[11.5px] leading-snug text-white/60">
                This action can't be undone. Enter the password to confirm you want to permanently delete this mind map.
              </p>

              <div className="mt-5 w-full">
                <div
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors ${
                    error ? 'border-red-400/70' : 'border-white/20 focus-within:border-white/50'
                  }`}
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                >
                  <Lock size={14} className={error ? 'text-red-300' : 'text-white/50'} />
                  <input
                    type="password"
                    autoFocus
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (error) setError(false)
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                    placeholder="Enter password"
                    className="w-full bg-transparent text-[13px] text-white placeholder-white/35 outline-none"
                  />
                </div>
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="mt-1.5 flex items-center gap-1 text-[10.5px] text-red-300"
                    >
                      <ShieldAlert size={11} /> Incorrect password. Try again.
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="mt-5 flex w-full gap-2">
                <button
                  onClick={onCancel}
                  className="flex-1 rounded-xl border border-white/20 py-2 text-[12px] font-medium text-white/80 transition-colors hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 rounded-xl py-2 text-[12px] font-semibold text-white shadow-lg transition-transform active:scale-[0.97]"
                  style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}
                >
                  Delete
                </button>
              </div>

              <p className="mt-4 text-[9.5px] tracking-wide text-white/35">Your password :- 1007</p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
