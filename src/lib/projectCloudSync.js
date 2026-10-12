import { supabase, isSupabaseConfigured } from './supabaseClient'

// ---------------------------------------------------------------------------
// Per-project cloud backup.
//
// Unlike the older single-row `maps`/`trade_analysis` cloud sync (one row per
// user, for whatever's currently on the canvas), every project in the
// dashboard gets its own row here, keyed by project_id. That's what makes
// the *dashboard* survive a cleared browser / new device — not just
// whichever single map happened to be open at the time.
//
// Every call is a no-op (resolves quietly) when Supabase isn't configured or
// nobody's signed in, matching the rest of the app's "works fine offline"
// convention.
// ---------------------------------------------------------------------------

const TABLE = 'project_maps'

export async function upsertProjectCloud(userId, project) {
  if (!isSupabaseConfigured || !userId || !project?.id) return { error: null }
  const { id, name, nodes, edges, groups, activityLog, updatedAt } = project
  const { error } = await supabase.from(TABLE).upsert({
    project_id: id,
    user_id: userId,
    name: name || 'Untitled Mind Map',
    nodes: nodes ?? [],
    edges: edges ?? [],
    groups: groups ?? [],
    activity_log: activityLog ?? [],
    updated_at: new Date(updatedAt || Date.now()).toISOString(),
  })
  return { error: error?.message || null }
}

export async function deleteProjectCloud(userId, projectId) {
  if (!isSupabaseConfigured || !userId || !projectId) return { error: null }
  const { error } = await supabase.from(TABLE).delete().eq('user_id', userId).eq('project_id', projectId)
  return { error: error?.message || null }
}

export async function fetchAllProjectsCloud(userId) {
  if (!isSupabaseConfigured || !userId) return { data: [], error: null }
  const { data, error } = await supabase.from(TABLE).select('*').eq('user_id', userId)
  return { data: data || [], error: error?.message || null }
}
