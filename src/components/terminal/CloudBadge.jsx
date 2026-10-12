import { memo } from 'react'
import { useTerminalStore } from '../../store/terminalStore'
import { useAuthStore } from '../../store/authStore'
import { isSupabaseConfigured } from '../../lib/supabaseClient'
import { terminalCloud } from '../../lib/terminal/terminalCloud'
import { STATUS_TEXT } from '../../lib/terminal/cloudSync'
import { useOnline } from './phase8Hooks'

// Small "where is my demo account saved?" pill at the end of the account bar. Text, not just a
// colour, so it is readable without colour vision. Tap it to retry when something went wrong.
const TONE = { good: '#4ade80', warn: '#fbbf24', bad: '#f87171', mute: '#94a3b8' }
const toneOf = (st) => (st === 'synced' ? TONE.good : st === 'error' || st === 'auth' || st === 'unreadable' ? TONE.bad : st === 'missing' || st === 'offline' ? TONE.warn : TONE.mute)

function CloudBadge() {
  const status = useTerminalStore((s) => s.cloudStatus)
  const user = useAuthStore((s) => s.user)
  const online = useOnline()
  let text
  let tone
  if (!online) { text = 'Offline — simulated prices keep running'; tone = TONE.warn }
  else if (!isSupabaseConfigured) { text = 'Saved on this device only'; tone = TONE.mute }
  else if (!user) { text = STATUS_TEXT.signedout; tone = TONE.mute }
  else { text = STATUS_TEXT[status] || 'Cloud sync on'; tone = toneOf(status) }
  const retry = online && user && ['error', 'offline', 'auth', 'unreadable'].includes(status)
  const Tag = retry ? 'button' : 'span'
  return (
    <Tag
      type={retry ? 'button' : undefined}
      onClick={retry ? () => terminalCloud.sync() : undefined}
      title={retry ? 'Tap to retry' : text}
      className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
      style={{ borderColor: '#27313d', color: tone, backgroundColor: 'transparent' }}
    >
      <span aria-hidden="true" className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone }} />
      {text}
    </Tag>
  )
}
export default memo(CloudBadge)
