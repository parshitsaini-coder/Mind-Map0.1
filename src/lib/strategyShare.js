import { supabase, isSupabaseConfigured } from './supabaseClient'
import { generateShareId, LIVE_EXPIRY_OPTIONS } from './liveShare'
import { ROWS_KEY } from '../utils/strategyRows'

export { LIVE_EXPIRY_OPTIONS }

const SETUP_HINT = 'Run the "strategy_shares" SQL from SUPABASE_SETUP.md (section 3c-3) in Supabase, then try again.'

function expiryToTimestamp(expiryValue) {
  const opt = LIVE_EXPIRY_OPTIONS.find((o) => o.value === expiryValue)
  if (!opt || opt.ms == null) return null
  return new Date(Date.now() + opt.ms).toISOString()
}

// `...?strategyShare=<id>` — the URL a visitor opens.
export function strategyShareUrl(id) {
  const url = new URL(window.location.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('strategyShare', id)
  return url.toString()
}

// What a visitor needs, and nothing else: this ONE strategy (name + fields +
// options), its entries (all months, extra rows included) and the list of
// extra-row ids. Other strategies, mind maps and account data never leave.
export function buildStrategyPayload(strategy, entries) {
  if (!strategy) return null
  return {
    strategy,
    entries: entries?.[strategy.id] || {},
    rows: entries?.[ROWS_KEY]?.[strategy.id] || {},
  }
}

const mapError = (error) => {
  const m = error?.message || ''
  if (/relation .* does not exist|schema cache|could not find the table/i.test(m)) return SETUP_HINT
  return m || 'Something went wrong.'
}

export async function createStrategyShare({ userId, strategy, entries, themeName, expiryValue }) {
  if (!isSupabaseConfigured) return { error: 'Cloud save isn’t set up yet (missing Supabase keys) — see SUPABASE_SETUP.md.' }
  if (!userId) return { error: 'Log in first — a share link needs somewhere to save to.' }
  const id = generateShareId()
  const row = {
    id,
    user_id: userId,
    strategy_id: strategy.id,
    strategy_name: strategy.name,
    payload: buildStrategyPayload(strategy, entries),
    theme_name: themeName,
    expires_at: expiryToTimestamp(expiryValue),
    ended_at: null,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('strategy_shares').insert(row).select('id, expires_at').single()
  if (error) return { error: mapError(error) }
  return { id: data.id, expiresAt: data.expires_at }
}

// Owner side: push the latest data into an existing link.
export async function updateStrategyShareData(id, { strategy, entries, themeName }) {
  if (!isSupabaseConfigured || !id) return { error: 'not-configured' }
  const { data, error } = await supabase
    .from('strategy_shares')
    .update({
      strategy_name: strategy.name,
      payload: buildStrategyPayload(strategy, entries),
      theme_name: themeName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('id')
  if (error) return { error: mapError(error) }
  if (!data || data.length === 0) return { error: 'Update blocked (0 rows) — check the strategy_shares RLS policy in SUPABASE_SETUP.md.' }
  return {}
}

// Every live link this account owns (optionally for one strategy), with its view count.
export async function fetchOwnStrategyShares(userId, strategyId) {
  if (!isSupabaseConfigured || !userId) return []
  let q = supabase
    .from('strategy_shares')
    .select('id, strategy_id, strategy_name, expires_at, ended_at, view_count, updated_at, created_at')
    .eq('user_id', userId)
    .is('ended_at', null)
    .order('created_at', { ascending: false })
  if (strategyId) q = q.eq('strategy_id', strategyId)
  const { data, error } = await q
  if (error || !data) return []
  const now = Date.now()
  return data.filter((r) => !r.expires_at || new Date(r.expires_at).getTime() > now)
}

export async function endStrategyShare(id) {
  if (!isSupabaseConfigured || !id) return
  await supabase.from('strategy_shares').update({ ended_at: new Date().toISOString() }).eq('id', id)
}

// Visitor side — through SECURITY DEFINER RPCs so the anon key only ever
// reaches the one row whose id it already has.
export async function fetchStrategyShare(id) {
  if (!isSupabaseConfigured || !id) return { error: 'not-configured' }
  const { data, error } = await supabase.rpc('get_strategy_share', { share_id: id })
  if (error) return { error: /does not exist|schema cache/i.test(error.message || '') ? 'not-configured' : 'not-found' }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { error: 'not-found' }
  if (row.ended_at) return { error: 'ended' }
  if (row.expires_at && new Date(row.expires_at) < new Date()) return { error: 'expired' }
  return { data: row }
}

export async function registerStrategyShareView(id) {
  if (!isSupabaseConfigured || !id) return null
  const { data, error } = await supabase.rpc('increment_strategy_share_view', { share_id: id })
  if (error) return null
  return typeof data === 'number' ? data : null
}

export const expiryLabel = (expiresAt) => {
  if (!expiresAt) return 'No expiry'
  const ms = new Date(expiresAt).getTime() - Date.now()
  if (ms <= 0) return 'Expired'
  const m = Math.round(ms / 60000)
  if (m < 60) return `${m} min left`
  const h = Math.round(m / 60)
  if (h < 48) return `${h} h left`
  return `${Math.round(h / 24)} days left`
}
