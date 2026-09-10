import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  User,
  AtSign,
  Mail,
  Lock,
  Eye,
  EyeOff,
  LogOut,
  Cloud,
  MailCheck,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  KeyRound,
  Sparkles,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'
import { isSupabaseConfigured } from '../../lib/supabaseClient'

// Real multi-color Google "G" mark — lucide has no brand icons, and a
// mono-color stand-in would look cheap next to a "pro" login button.
function GoogleIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.6-6 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.4-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34.6 6 29.6 4 24 4c-7.5 0-14 4.2-17.7 10.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.4C29.6 35.4 26.9 36.5 24 36.5c-5.2 0-9.7-3.5-11.3-8.3l-6.6 5.1C9.9 39.7 16.4 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.2-4.1 5.6l6.6 5.4C41.6 36 44 30.5 44 24c0-1.2-.1-2.4-.4-3.5z"
      />
    </svg>
  )
}

// Floating icon + input, with an animated focus underline and (for
// passwords) a show/hide toggle. Keeps the form markup below readable.
function FieldInput({ icon: Icon, label, type = 'text', value, onChange, placeholder, disabled, autoFocus }) {
  const [focused, setFocused] = useState(false)
  const [reveal, setReveal] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (reveal ? 'text' : 'password') : type

  return (
    <div>
      <label className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--color-slate)]">
        {label}
      </label>
      <div className="relative flex items-center">
        <Icon
          size={13}
          className="pointer-events-none absolute left-2.5 transition-colors"
          style={{ color: focused ? 'var(--color-ink)' : 'var(--color-slate)', opacity: focused ? 1 : 0.55 }}
        />
        <input
          type={inputType}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={disabled}
          autoFocus={autoFocus}
          className="w-full rounded-md border bg-[#f2f1ea] py-1.5 pl-7 text-xs outline-none transition-shadow disabled:opacity-50"
          style={{
            borderColor: focused ? 'var(--color-accent)' : 'var(--color-sage)',
            boxShadow: focused ? '0 0 0 3px color-mix(in srgb, var(--color-accent) 30%, transparent)' : 'none',
            paddingRight: isPassword ? '1.75rem' : '0.625rem',
          }}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setReveal((r) => !r)}
            className="absolute right-2 text-[var(--color-slate)] opacity-60 hover:opacity-100"
          >
            {reveal ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}
      </div>
    </div>
  )
}

const fieldStack = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
}
const fieldItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 30 } },
}

// Order matters here — it drives which direction the mode-switch slide
// animates in (login -> signup feels like moving "forward").
const VIEW_ORDER = ['login', 'signup', 'forgot']

export default function AuthPanel() {
  const open = useUiStore((s) => s.authModalOpen)
  const toggle = useUiStore((s) => s.toggleAuthModal)
  const showToast = useUiStore((s) => s.showToast)
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const error = useAuthStore((s) => s.error)
  const pendingEmail = useAuthStore((s) => s.pendingEmail)
  const oauthPending = useAuthStore((s) => s.oauthPending)
  const passwordRecovery = useAuthStore((s) => s.passwordRecovery)
  const resetEmailSent = useAuthStore((s) => s.resetEmailSent)
  const signUp = useAuthStore((s) => s.signUp)
  const signIn = useAuthStore((s) => s.signIn)
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)
  const sendPasswordReset = useAuthStore((s) => s.sendPasswordReset)
  const updatePassword = useAuthStore((s) => s.updatePassword)
  const signOut = useAuthStore((s) => s.signOut)
  const resendConfirmation = useAuthStore((s) => s.resendConfirmation)
  const clearError = useAuthStore((s) => s.clearError)
  const clearResetEmailSent = useAuthStore((s) => s.clearResetEmailSent)

  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [direction, setDirection] = useState(1)

  if (!open && !passwordRecovery) return null

  const goTo = (next) => {
    setDirection(VIEW_ORDER.indexOf(next) > VIEW_ORDER.indexOf(mode) ? 1 : -1)
    setMode(next)
    clearError()
  }

  const close = () => {
    toggle()
    clearError()
    clearResetEmailSent()
    setPassword('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (mode === 'forgot') {
      await sendPasswordReset(email)
      return
    }
    const result =
      mode === 'signup' ? await signUp(name, username, email, password) : await signIn(email, password)
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

  const handleResetPassword = async (e) => {
    e.preventDefault()
    const ok = await updatePassword(newPassword)
    if (ok) {
      showToast('Password updated — you\u2019re signed in.')
      setNewPassword('')
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

  const handleGoogle = async () => {
    await signInWithGoogle()
  }

  // Which "screen" the card is currently showing — drives the header icon
  // and copy. Priority: password-recovery link > signed in > pending email
  // confirmation > google redirect in flight > the login/signup/forgot form.
  const view = passwordRecovery
    ? 'reset'
    : user
    ? 'account'
    : pendingEmail
    ? 'confirm'
    : oauthPending
    ? 'oauth'
    : resetEmailSent
    ? 'reset-sent'
    : mode

  const headerIcon = {
    account: <Cloud size={15} />,
    confirm: <MailCheck size={15} />,
    oauth: <Loader2 size={15} className="animate-spin" />,
    reset: <KeyRound size={15} />,
    'reset-sent': <MailCheck size={15} />,
    login: <User size={15} />,
    signup: <Sparkles size={15} />,
    forgot: <KeyRound size={15} />,
  }[view]

  const headerLabel = {
    account: 'Your account',
    confirm: 'Confirm your email',
    oauth: 'Signing you in…',
    reset: 'Set a new password',
    'reset-sent': 'Check your email',
    login: 'Log in',
    signup: 'Create account',
    forgot: 'Reset password',
  }[view]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={close}
        className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-black/40 p-4 backdrop-blur-[2px]"
      >
        {/* Ambient floating glow blobs — purely decorative, sit behind the
            card and drift slowly so the backdrop doesn't feel static. */}
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ backgroundColor: 'var(--color-accent)' }}
          animate={{ x: [-40, 30, -40], y: [-30, 20, -30] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute h-64 w-64 translate-x-40 translate-y-24 rounded-full opacity-20 blur-3xl"
          style={{ backgroundColor: 'var(--color-sage)' }}
          animate={{ x: [20, -30, 20], y: [10, -20, 10] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 8 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-xs overflow-hidden rounded-xl border shadow-2xl"
          style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
        >
          {/* Slow-rotating conic gradient sliver along the top edge — a
              subtle "premium" accent instead of a flat border. */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-6 -top-6 h-12 opacity-40 blur-xl"
            style={{
              background:
                'conic-gradient(from 0deg, var(--color-accent), var(--color-sage), var(--color-accent))',
            }}
            animate={{ rotate: 360 }}
            transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
          />

          <div
            className="relative flex items-center justify-between border-b px-4 py-3"
            style={{ borderColor: 'var(--color-sage)', backgroundColor: 'var(--color-cream)' }}
          >
            <h2 className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              <AnimatePresence mode="wait">
                <motion.span
                  key={view}
                  initial={{ opacity: 0, rotate: -45, scale: 0.5 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 45, scale: 0.5 }}
                  transition={{ duration: 0.22 }}
                  className="flex"
                >
                  {headerIcon}
                </motion.span>
              </AnimatePresence>
              <AnimatePresence mode="wait">
                <motion.span
                  key={view}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 6 }}
                  transition={{ duration: 0.18 }}
                >
                  {headerLabel}
                </motion.span>
              </AnimatePresence>
            </h2>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 90 }}
              whileTap={{ scale: 0.9 }}
              onClick={close}
              className="rounded p-0.5 hover:bg-[var(--color-sage)]"
            >
              <X size={14} />
            </motion.button>
          </div>

          <div className="relative p-4">
            {!isSupabaseConfigured && (
              <p className="mb-3 rounded-md bg-[var(--color-accent)]/30 p-2 text-[11px] leading-snug text-[var(--color-ink)]">
                Cloud save isn't connected yet. Add your Supabase URL/key to <code>.env</code> to enable online
                accounts — until then the map still saves locally in this browser.
              </p>
            )}

            <AnimatePresence mode="wait" custom={direction}>
              {view === 'account' && (
                <motion.div
                  key="account"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="flex flex-col gap-3"
                >
                  <p className="text-xs text-[var(--color-slate)]">
                    Signed in as <span className="font-semibold">{user.name}</span>
                    {user.username && <span className="text-[var(--color-slate)]"> (@{user.username})</span>} —{' '}
                    {user.email}. Your map auto-saves to the cloud as you edit it.
                  </p>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleSignOut}
                    className="flex items-center justify-center gap-1.5 rounded-md border border-[var(--color-slate)] py-1.5 text-xs hover:bg-[var(--color-sage)]/40"
                  >
                    <LogOut size={13} /> Sign out
                  </motion.button>
                </motion.div>
              )}

              {view === 'oauth' && (
                <motion.div
                  key="oauth"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="flex flex-col items-center gap-3 py-4 text-center"
                >
                  <Loader2 size={22} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                  <p className="text-xs text-[var(--color-slate)]">Redirecting you to Google…</p>
                </motion.div>
              )}

              {view === 'confirm' && (
                <motion.div
                  key="confirm"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="flex flex-col gap-3"
                >
                  <motion.div
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                    className="flex justify-center"
                  >
                    <MailCheck size={28} style={{ color: 'var(--color-accent)' }} />
                  </motion.div>
                  <p className="text-xs text-[var(--color-slate)]">
                    We sent a confirmation link to <span className="font-semibold">{pendingEmail}</span>. Click it,
                    then come back and log in.
                  </p>
                  <ErrorMessage error={error} />
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleResend}
                    disabled={loading}
                    className="rounded-md border border-[var(--color-slate)] py-1.5 text-xs hover:bg-[var(--color-sage)]/40 disabled:opacity-50"
                  >
                    {loading ? 'Sending…' : 'Resend email'}
                  </motion.button>
                  <button
                    type="button"
                    onClick={() => {
                      goTo('login')
                      useAuthStore.setState({ pendingEmail: null })
                    }}
                    className="flex items-center justify-center gap-1 text-[11px] text-[var(--color-slate)] underline underline-offset-2"
                  >
                    <ArrowLeft size={11} /> Back to log in
                  </button>
                </motion.div>
              )}

              {view === 'reset-sent' && (
                <motion.div
                  key="reset-sent"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="flex flex-col gap-3"
                >
                  <motion.div
                    initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                    className="flex justify-center"
                  >
                    <CheckCircle2 size={28} style={{ color: 'var(--color-accent)' }} />
                  </motion.div>
                  <p className="text-xs text-[var(--color-slate)]">
                    We sent a password reset link to <span className="font-semibold">{resetEmailSent}</span>. Open it
                    on this device to set a new password.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      clearResetEmailSent()
                      goTo('login')
                    }}
                    className="flex items-center justify-center gap-1 text-[11px] text-[var(--color-slate)] underline underline-offset-2"
                  >
                    <ArrowLeft size={11} /> Back to log in
                  </button>
                </motion.div>
              )}

              {view === 'reset' && (
                <motion.form
                  key="reset"
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  onSubmit={handleResetPassword}
                  className="flex flex-col gap-2.5"
                >
                  <motion.div variants={fieldStack} initial="hidden" animate="show" className="flex flex-col gap-2.5">
                    <motion.p variants={fieldItem} className="text-xs text-[var(--color-slate)]">
                      Choose a new password for your account.
                    </motion.p>
                    <motion.div variants={fieldItem}>
                      <FieldInput
                        icon={Lock}
                        label="New password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="At least 6 characters"
                        autoFocus
                      />
                    </motion.div>
                    <motion.div variants={fieldItem}>
                      <ErrorMessage error={error} />
                    </motion.div>
                    <motion.button
                      variants={fieldItem}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      type="submit"
                      disabled={loading}
                      className="mt-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold text-[var(--color-ink)] disabled:opacity-50"
                      style={{ backgroundColor: 'var(--color-accent)' }}
                    >
                      {loading && <Loader2 size={12} className="animate-spin" />}
                      {loading ? 'Updating…' : 'Update password'}
                    </motion.button>
                  </motion.div>
                </motion.form>
              )}

              {(view === 'login' || view === 'signup' || view === 'forgot') && (
                <motion.form
                  key={view}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  onSubmit={handleSubmit}
                >
                  <motion.div
                    variants={fieldStack}
                    initial="hidden"
                    animate="show"
                    className="flex flex-col gap-2.5"
                  >
                    {view === 'signup' && (
                      <motion.div variants={fieldItem}>
                        <FieldInput
                          icon={User}
                          label="Name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your name"
                          disabled={!isSupabaseConfigured}
                          autoFocus
                        />
                      </motion.div>
                    )}
                    {view === 'signup' && (
                      <motion.div variants={fieldItem}>
                        <FieldInput
                          icon={AtSign}
                          label="Username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                          placeholder="e.g. trader_saini"
                          disabled={!isSupabaseConfigured}
                        />
                      </motion.div>
                    )}

                    {view !== 'forgot' && (
                      <motion.div variants={fieldItem}>
                        <FieldInput
                          icon={Mail}
                          label="Email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          disabled={!isSupabaseConfigured}
                          autoFocus={view === 'login'}
                        />
                      </motion.div>
                    )}
                    {view === 'forgot' && (
                      <motion.div variants={fieldItem}>
                        <p className="mb-2 text-xs text-[var(--color-slate)]">
                          Enter your account email and we'll send you a reset link.
                        </p>
                        <FieldInput
                          icon={Mail}
                          label="Email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@example.com"
                          disabled={!isSupabaseConfigured}
                          autoFocus
                        />
                      </motion.div>
                    )}

                    {view !== 'forgot' && (
                      <motion.div variants={fieldItem}>
                        <FieldInput
                          icon={Lock}
                          label="Password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={view === 'signup' ? 'At least 6 characters' : 'Your password'}
                          disabled={!isSupabaseConfigured}
                        />
                      </motion.div>
                    )}

                    {view === 'login' && (
                      <motion.button
                        variants={fieldItem}
                        type="button"
                        onClick={() => goTo('forgot')}
                        className="-mt-1 self-end text-[11px] text-[var(--color-slate)] underline underline-offset-2 hover:text-[var(--color-ink)]"
                      >
                        Forgot password?
                      </motion.button>
                    )}

                    <motion.div variants={fieldItem}>
                      <ErrorMessage error={error} />
                    </motion.div>

                    <motion.button
                      variants={fieldItem}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      type="submit"
                      disabled={loading || !isSupabaseConfigured}
                      className="mt-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold text-[var(--color-ink)] disabled:opacity-50"
                      style={{ backgroundColor: 'var(--color-accent)' }}
                    >
                      {loading && <Loader2 size={12} className="animate-spin" />}
                      {loading
                        ? 'Please wait…'
                        : view === 'signup'
                        ? 'Sign up'
                        : view === 'forgot'
                        ? 'Send reset link'
                        : 'Log in'}
                    </motion.button>

                    {view !== 'forgot' && (
                      <motion.div variants={fieldItem} className="flex items-center gap-2 py-0.5">
                        <div className="h-px flex-1" style={{ backgroundColor: 'var(--color-sage)' }} />
                        <span className="text-[10px] uppercase tracking-wide text-[var(--color-slate)]">or</span>
                        <div className="h-px flex-1" style={{ backgroundColor: 'var(--color-sage)' }} />
                      </motion.div>
                    )}

                    {view !== 'forgot' && (
                      <motion.button
                        variants={fieldItem}
                        whileHover={{ scale: 1.02, backgroundColor: '#fafaf6' }}
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        onClick={handleGoogle}
                        disabled={loading || !isSupabaseConfigured}
                        className="flex items-center justify-center gap-2 rounded-md border py-1.5 text-xs font-medium disabled:opacity-50"
                        style={{ borderColor: 'var(--color-sage)', color: 'var(--color-ink)', backgroundColor: '#fff' }}
                      >
                        <GoogleIcon size={14} /> Continue with Google
                      </motion.button>
                    )}

                    <motion.button
                      variants={fieldItem}
                      type="button"
                      onClick={() => goTo(view === 'signup' ? 'login' : view === 'forgot' ? 'login' : 'signup')}
                      className="flex items-center justify-center gap-1 text-[11px] text-[var(--color-slate)] underline underline-offset-2"
                    >
                      {view === 'forgot' && <ArrowLeft size={11} />}
                      {view === 'signup'
                        ? 'Already have an account? Log in'
                        : view === 'forgot'
                        ? 'Back to log in'
                        : 'New here? Create an account'}
                    </motion.button>
                  </motion.div>
                </motion.form>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// Slide + fade used for the mode-switch (login <-> signup <-> forgot etc.),
// direction-aware so moving "forward" in VIEW_ORDER slides left->right and
// moving back reverses it — reads as a natural stack of cards.
const slideVariants = {
  enter: (dir) => ({ opacity: 0, x: dir > 0 ? 24 : -24 }),
  center: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 380, damping: 32 } },
  exit: (dir) => ({ opacity: 0, x: dir > 0 ? -24 : 24, transition: { duration: 0.15 } }),
}

function ErrorMessage({ error }) {
  return (
    <AnimatePresence>
      {error && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto', x: [0, -6, 6, -4, 4, 0] }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ x: { duration: 0.35 }, default: { duration: 0.18 } }}
          className="text-[11px] text-[#c1443c]"
        >
          {error}
        </motion.p>
      )}
    </AnimatePresence>
  )
}
