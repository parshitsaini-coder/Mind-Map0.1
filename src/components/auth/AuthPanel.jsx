import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, User, LogOut, Cloud, MailCheck } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'
import { useMapStore } from '../../store/mapStore'
import { isSupabaseConfigured } from '../../lib/supabaseClient'

export default function AuthPanel() {
  const open = useUiStore((s) => s.authModalOpen)
  const toggle = useUiStore((s) => s.toggleAuthModal)
  const showToast = useUiStore((s) => s.showToast)
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const error = useAuthStore((s) => s.error)
  const pendingEmail = useAuthStore((s) => s.pendingEmail)
  const signUp = useAuthStore((s) => s.signUp)
  const signIn = useAuthStore((s) => s.signIn)
  const signOut = useAuthStore((s) => s.signOut)
  const resendConfirmation = useAuthStore((s) => s.resendConfirmation)
  const clearError = useAuthStore((s) => s.clearError)

  const [mode, setMode] = useState('login') // 'login' | 'signup'
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  if (!open) return null

  const close = () => {
    toggle()
    clearError()
    setPassword('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const result = mode === 'signup' ? await signUp(name, email, password) : await signIn(email, password)
    if (result === 'confirm') {
      setPassword('')
      return // stay open, panel below shows the "check your email" message
    }
    if (result) {
      showToast(mode === 'signup' ? `Account created — welcome, ${name.trim()}!` : `Welcome back!`)
      setPassword('')
      toggle()
    }
  }

  const handleResend = async () => {
    const ok = await resendConfirmation(pendingEmail)
    if (ok) showToast('Confirmation email sent again — check your inbox')
  }

  const handleSignOut = async () => {
    await signOut()
    showToast('Signed out — your map stays saved locally too')
    toggle()
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={close}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 26 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xs rounded-lg border shadow-xl"
          style={{ backgroundColor: '#e8eddf', borderColor: '#cfdbd5' }}
        >
          <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: '#cfdbd5' }}>
            <h2 className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: '#242423' }}>
              {user ? <Cloud size={15} /> : pendingEmail ? <MailCheck size={15} /> : <User size={15} />}
              {user ? 'Your account' : pendingEmail ? 'Confirm your email' : mode === 'signup' ? 'Create account' : 'Log in'}
            </h2>
            <button onClick={close} className="rounded p-0.5 hover:bg-[#cfdbd5]">
              <X size={14} />
            </button>
          </div>

          <div className="p-4">
            {!isSupabaseConfigured && (
              <p className="mb-3 rounded-md bg-[#f5cb5c]/30 p-2 text-[11px] leading-snug text-[#242423]">
                Cloud save isn't connected yet. Add your Supabase URL/key to <code>.env</code> to enable online
                accounts — until then the map still saves locally in this browser.
              </p>
            )}

            {user ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-[#333533]">
                  Signed in as <span className="font-semibold">{user.name}</span> ({user.email}). Your map auto-saves
                  to the cloud as you edit it.
                </p>
                <button
                  onClick={handleSignOut}
                  className="flex items-center justify-center gap-1.5 rounded-md border border-[#333533] py-1.5 text-xs hover:bg-[#cfdbd5]/40"
                >
                  <LogOut size={13} /> Sign out
                </button>
              </div>
            ) : pendingEmail ? (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-[#333533]">
                  We sent a confirmation link to <span className="font-semibold">{pendingEmail}</span>. Click it,
                  then come back and log in.
                </p>
                {error && <p className="text-[11px] text-[#c1443c]">{error}</p>}
                <button
                  onClick={handleResend}
                  disabled={loading}
                  className="rounded-md border border-[#333533] py-1.5 text-xs hover:bg-[#cfdbd5]/40 disabled:opacity-50"
                >
                  {loading ? 'Sending…' : 'Resend email'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login')
                    clearError()
                    useAuthStore.setState({ pendingEmail: null })
                  }}
                  className="text-[11px] text-[#333533] underline underline-offset-2"
                >
                  Back to log in
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
                {mode === 'signup' && (
                  <div>
                    <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#333533]">
                      Name
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="w-full rounded-md border px-2.5 py-1.5 text-xs outline-none focus:border-[#f5cb5c]"
                      style={{ borderColor: '#cfdbd5', backgroundColor: '#f2f1ea' }}
                      disabled={!isSupabaseConfigured}
                    />
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#333533]">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-md border px-2.5 py-1.5 text-xs outline-none focus:border-[#f5cb5c]"
                    style={{ borderColor: '#cfdbd5', backgroundColor: '#f2f1ea' }}
                    disabled={!isSupabaseConfigured}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[#333533]">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={mode === 'signup' ? 'At least 6 characters' : 'Your password'}
                    className="w-full rounded-md border px-2.5 py-1.5 text-xs outline-none focus:border-[#f5cb5c]"
                    style={{ borderColor: '#cfdbd5', backgroundColor: '#f2f1ea' }}
                    disabled={!isSupabaseConfigured}
                  />
                </div>

                {error && <p className="text-[11px] text-[#c1443c]">{error}</p>}

                <button
                  type="submit"
                  disabled={loading || !isSupabaseConfigured}
                  className="mt-1 rounded-md py-1.5 text-xs font-semibold text-[#242423] disabled:opacity-50"
                  style={{ backgroundColor: '#f5cb5c' }}
                >
                  {loading ? 'Please wait…' : mode === 'signup' ? 'Sign up' : 'Log in'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'signup' ? 'login' : 'signup')
                    clearError()
                  }}
                  className="text-[11px] text-[#333533] underline underline-offset-2"
                >
                  {mode === 'signup' ? 'Already have an account? Log in' : "New here? Create an account"}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
