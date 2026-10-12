// Phase 7 — the sync engine for the demo terminal. It owns no Supabase code and no React: the
// zustand `store` and a `remote` adapter are injected (see terminalCloud.js for the real ones), so the
// whole conflict flow is tested in plain Node with a fake remote (tests/terminal-phase7.test.mjs).
//
//   store   needs: getState() / setState() / subscribe(), plus the state fields in SYNCED_KEYS,
//           `cloudMeta` / `cloudStatus`, and an `applyCloud(snapshot)` action.
//   remote  fetch(uid)                -> { row|null, error }
//           insert(uid, cols)         -> { updatedAt, error }
//           update(uid, cols, expTs)  -> { updatedAt|null, error }   (null = no row matched `expTs`)
import { buildRow, parseRow, snapshotOf, decideSync, classifyError, SYNCED_KEYS } from './cloudSync.js'

const SAVE_DEBOUNCE_MS = 2000 // quiet period after the last change
const SAVE_MAX_WAIT_MS = 20000 // …but never hold a save back longer than this while changes keep coming
const RETRY_MS = [5000, 15000, 60000]
const MAX_CONFLICT_RETRIES = 3

const pickSynced = (s) => Object.fromEntries(SYNCED_KEYS.map((k) => [k, s[k]]))

export function createTerminalSync({ store, remote, now = Date.now, isOnline = () => true, onPulled, onNotice, onTrimmed }) {
  let userId = null
  let unsub = null
  let prev = pickSynced(store.getState())
  let rev = 0 // bumps on every real local change
  let suppress = false // true while a cloud snapshot is being applied (that is not a local edit)
  let saveTimer = null
  let firstChangeAt = 0
  let retryTimer = null
  let retryIdx = 0
  let unavailable = false // table/columns missing -> stop calling the server this session
  let inflight = null
  let again = false

  const setMeta = (patch) => store.setState((s) => ({ cloudMeta: { ...s.cloudMeta, ...patch } }))
  const setStatus = (cloudStatus) => { if (store.getState().cloudStatus !== cloudStatus) store.setState({ cloudStatus }) }

  function onChange(state) {
    if (!SYNCED_KEYS.some((k) => state[k] !== prev[k])) return
    prev = pickSynced(state)
    if (suppress || !userId) return
    rev++
    setMeta({ userId, dirty: true, localUpdatedAt: now() })
    scheduleSave()
  }

  function scheduleSave() {
    if (unavailable || !userId) return
    const t = now()
    if (!firstChangeAt) firstChangeAt = t
    const wait = Math.min(SAVE_DEBOUNCE_MS, Math.max(0, firstChangeAt + SAVE_MAX_WAIT_MS - t))
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => { firstChangeAt = 0; saveTimer = null; sync() }, wait)
    const st = store.getState().cloudStatus
    if (st === 'synced' || st === 'idle') setStatus('pending')
  }

  function scheduleRetry() {
    clearTimeout(retryTimer)
    const wait = RETRY_MS[Math.min(retryIdx, RETRY_MS.length - 1)]
    retryIdx++
    retryTimer = setTimeout(() => { retryTimer = null; sync() }, wait)
  }

  function fail(error) {
    const kind = classifyError(error)
    if (kind === 'missing') { unavailable = true; setStatus('missing'); return }
    if (kind === 'auth') { setStatus('auth'); return }
    setStatus(kind === 'offline' || !isOnline() ? 'offline' : 'error')
    scheduleRetry()
  }

  function pull(uid, cloud, ts, d) {
    suppress = true
    try { store.getState().applyCloud(cloud) } finally { prev = pickSynced(store.getState()); suppress = false }
    setMeta({ userId: uid, cloudUpdatedAt: ts, dirty: false, force: false, localUpdatedAt: Date.parse(ts) || now() })
    setStatus('synced')
    retryIdx = 0
    if (d.notify) onNotice?.('Demo account updated from another device')
    onPulled?.(Math.floor((Date.parse(ts) || now()) / 1000))
  }

  async function push(uid, expectedTs, attempt) {
    const revAtStart = rev
    const { row, trimmed } = buildRow(store.getState())
    setStatus('syncing')
    let res
    try { res = expectedTs ? await remote.update(uid, row, expectedTs) : await remote.insert(uid, row) } catch (e) { res = { updatedAt: null, error: e } }
    if (uid !== userId) return
    const kind = res.error ? classifyError(res.error) : null
    // Someone else wrote first (row appeared / `updated_at` moved): look at the cloud again and re-decide.
    if (kind === 'conflict' || (!res.error && !res.updatedAt)) {
      if (attempt < MAX_CONFLICT_RETRIES) return run(uid, attempt + 1)
      return fail({ message: 'sync conflict — will retry' })
    }
    if (res.error) return fail(res.error)
    const editedMeanwhile = rev !== revAtStart
    setMeta({ userId: uid, cloudUpdatedAt: res.updatedAt, dirty: editedMeanwhile, ...(editedMeanwhile ? {} : { force: false }) })
    retryIdx = 0
    if (editedMeanwhile) scheduleSave(); else setStatus('synced')
    if (trimmed) onTrimmed?.(trimmed)
  }

  async function run(uid, attempt) {
    if (!isOnline()) { setStatus('offline'); return }
    setStatus('syncing')
    let res
    try { res = await remote.fetch(uid) } catch (e) { res = { row: null, error: e } }
    if (uid !== userId) return
    if (res.error) return fail(res.error)
    const st = store.getState()
    const local = snapshotOf(st)
    let cloud = null
    if (res.row) {
      cloud = parseRow(res.row)
      if (!cloud) { setStatus('unreadable'); return } // never overwrite a row we can't read
    }
    const ts = res.row?.updated_at ?? null
    const d = decideSync({ local, cloud, cloudTs: ts, meta: st.cloudMeta }, uid)
    if (d.action === 'noop') {
      // keep the bookkeeping in step so the next comparison starts from the right place
      if (ts && st.cloudMeta.userId !== uid) setMeta({ userId: uid, cloudUpdatedAt: ts, dirty: false })
      setStatus(d.reason === 'in sync' ? 'synced' : 'idle')
      retryIdx = 0
      return
    }
    if (d.action === 'pull') return pull(uid, cloud, ts, d)
    return push(uid, ts, attempt)
  }

  // Single-flight: calls made while a sync is running coalesce into one follow-up run.
  function sync() {
    if (!userId || unavailable) return Promise.resolve()
    if (inflight) { again = true; return inflight }
    inflight = (async () => {
      try {
        do { again = false; await run(userId, 0) } while (again && userId && !unavailable)
      } finally { inflight = null }
    })()
    return inflight
  }

  return {
    start(uid) {
      if (!uid) return
      if (userId === uid && unsub) return
      this.stop()
      userId = uid
      unavailable = false
      retryIdx = 0
      prev = pickSynced(store.getState())
      unsub = store.subscribe(onChange)
      return sync()
    },
    stop() {
      if (unsub) unsub()
      unsub = null
      clearTimeout(saveTimer); clearTimeout(retryTimer)
      saveTimer = retryTimer = null
      firstChangeAt = 0
      userId = null
      again = false
      if (store.getState().cloudStatus !== 'idle') store.setState({ cloudStatus: 'idle' })
    },
    sync,
    // Upload now instead of waiting out the debounce (tab hidden / closing).
    flush() {
      if (!userId || unavailable) return Promise.resolve()
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; firstChangeAt = 0; return sync() }
      return Promise.resolve()
    },
    // A deliberate wipe ("Clear all data" / reset): upload even though the local account is empty.
    forcePush(knownCloudTs = null) {
      if (!userId) return Promise.resolve()
      rev++
      setMeta({ userId, dirty: true, force: true, localUpdatedAt: now(), ...(knownCloudTs ? { cloudUpdatedAt: knownCloudTs } : {}) })
      return sync()
    },
    get active() { return !!userId },
  }
}
