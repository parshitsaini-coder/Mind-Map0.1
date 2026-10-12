import { supabase, isSupabaseConfigured } from './supabaseClient'

// Short, URL-safe id for live share links (`?live=<id>`) — no extra
// dependency, just crypto.getRandomValues mapped onto an alphabet with the
// visually-ambiguous characters (0/O, 1/l/I) removed.
const ID_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz'
export function generateShareId(length = 10) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join('')
}

// Expiry presets shown in the Live Link tab of the share modal.
export const LIVE_EXPIRY_OPTIONS = [
  { value: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
  { value: '24h', label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { value: '7d', label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { value: '30d', label: '30 days', ms: 30 * 24 * 60 * 60 * 1000 },
  { value: 'never', label: 'No expiry', ms: null },
]

function expiryToTimestamp(expiryValue) {
  const opt = LIVE_EXPIRY_OPTIONS.find((o) => o.value === expiryValue)
  if (!opt || opt.ms == null) return null
  return new Date(Date.now() + opt.ms).toISOString()
}

// Creates the live share row the first time for this (user, project) pair,
// or reuses/updates the existing one on every later call (picking a
// different expiry, or just re-opening the tab) — so the URL never changes
// under the owner once they've shared it. Returns the fresh expiry so the
// UI doesn't have to recompute it.
export async function upsertLiveShare({ userId, projectId, payload, expiryValue, existingId }) {
  if (!isSupabaseConfigured || !userId) {
    return { error: 'Cloud save isn\u2019t set up yet (missing Supabase keys).' }
  }
  // `existingId` only reflects what THIS browser remembers locally (it's
  // persisted zustand state). If that's missing — cleared storage, a
  // different browser/device, or a previously-ended session whose row
  // Supabase still has — but a row for this (user_id, project_id) already
  // exists server-side, blindly generating a fresh id and upserting would
  // try to INSERT a second row for the same pair and hit the table's
  // `unique (user_id, project_id)` constraint (upsert only resolves
  // conflicts on the primary key `id` by default, not this constraint).
  // So look the real row up first and reuse its id whenever one exists.
  let id = existingId
  if (!id) {
    const { data: existingRow } = await supabase
      .from('live_shares')
      .select('id')
      .eq('user_id', userId)
      .eq('project_id', projectId)
      .maybeSingle()
    id = existingRow?.id || generateShareId()
  }
  const row = {
    id,
    user_id: userId,
    project_id: projectId,
    ...payload, // nodes, edges, checklists, trades, validation_rules
    expires_at: expiryToTimestamp(expiryValue),
    ended_at: null,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase.from('live_shares').upsert(row).select('id, expires_at').single()
  if (error) return { error: error.message }
  return { id: data.id, expiresAt: data.expires_at }
}

// Debounced content-only push — called whenever the map changes while a
// live link is active for the current project, so a visitor refreshing
// their tab sees the latest edits.
export async function pushLiveShareUpdate(id, payload) {
  if (!isSupabaseConfigured || !id) return
  await supabase
    .from('live_shares')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id)
}

export async function endLiveShare(id) {
  if (!isSupabaseConfigured || !id) return
  await supabase.from('live_shares').update({ ended_at: new Date().toISOString() }).eq('id', id)
}

// Visitor-side read, used by LiveMapView. Goes through the get_live_share
// RPC (SECURITY DEFINER) rather than a direct table SELECT, so the anon key
// can only ever fetch the one row whose id it already has, never list/dump
// every live share in the table.
export async function fetchLiveShare(id) {
  if (!isSupabaseConfigured || !id) return { error: 'not-configured' }
  const { data, error } = await supabase.rpc('get_live_share', { share_id: id })
  if (error) return { error: 'not-found' }
  const row = Array.isArray(data) ? data[0] : data
  if (!row) return { error: 'not-found' }
  if (row.ended_at) return { error: 'ended' }
  if (row.expires_at && new Date(row.expires_at) < new Date()) return { error: 'expired' }
  return { data: row }
}
