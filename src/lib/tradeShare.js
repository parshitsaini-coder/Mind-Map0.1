import { supabase, isSupabaseConfigured } from './supabaseClient'
import { generateShareId, LIVE_EXPIRY_OPTIONS } from './liveShare'

// Same id generator + expiry presets as the mind-map's live-share feature —
// re-exported so callers only need one import for both.
export { generateShareId, LIVE_EXPIRY_OPTIONS }

function expiryToTimestamp(expiryValue) {
  const opt = LIVE_EXPIRY_OPTIONS.find((o) => o.value === expiryValue)
  if (!opt || opt.ms == null) return null
  return new Date(Date.now() + opt.ms).toISOString()
}

// Builds the `...?tradeShare=<id>` URL a visitor opens to see the shared
// trades — kept in one place so the modal and any other caller never drift
// on the query param's name.
export function tradeShareUrl(id) {
  const url = new URL(window.location.href)
  url.search = ''
  url.searchParams.set('tradeShare', id)
  return url.toString()
}

// Creates a brand-new row every call — unlike the mind map's one-live-link-
// per-project model, a person may want several trade-share links alive at
// once (e.g. one scoped to this month's Forex trades for one group, another
// scoped to a single pair for someone else), so this never reuses an id.
export async function createTradeShare({ userId, trades, validationRules, filters, themeName, expiryValue }) {
  if (!isSupabaseConfigured) {
    return { error: 'Cloud save isn\u2019t set up yet (missing Supabase keys) — see SUPABASE_SETUP.md.' }
  }
  if (!userId) {
    return { error: 'Log in first — a share link needs somewhere to save to.' }
  }
  const id = generateShareId()
  const row = {
    id,
    user_id: userId,
    trades,
    validation_rules: validationRules,
    filters,
    theme_name: themeName,
    expires_at: expiryToTimestamp(expiryValue),
    ended_at: null,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('trade_shares').insert(row).select('id, expires_at').single()
  if (error) return { error: error.message }
  return { id: data.id, expiresAt: data.expires_at }
}

export async function endTradeShare(id) {
  if (!isSupabaseConfigured || !id) return
  await supabase.from('trade_shares').update({ ended_at: new Date().toISOString() }).eq('id', id)
}

// Visitor-side read, used by TradeShareView. Goes through the
// get_trade_share RPC (SECURITY DEFINER) rather than a direct table SELECT,
// same reasoning as get_live_share — the anon key can only ever fetch the
// one row whose id it already has.
export async function fetchTradeShare(id) {
  if (!isSupabaseConfigured || !id) return { error: 'not-configured' }
  const { data, error } = await supabase.rpc('get_trade_share', { share_id: id })
  if (error) return { error: 'not-found' }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { error: 'not-found' }
  if (row.ended_at) return { error: 'ended' }
  if (row.expires_at && new Date(row.expires_at) < new Date()) return { error: 'expired' }
  return { data: row }
}
