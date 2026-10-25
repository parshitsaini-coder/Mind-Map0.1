import { useMapStore } from '../store/mapStore'
import { useProjectsStore, readProjectData, writeProjectData } from '../store/projectsStore'
import { useTradeAnalysisStore } from '../store/tradeAnalysisStore'
import { useWhiteboardStore } from '../store/whiteboardStore'
import { useStrategyTesterStore } from '../store/strategyTesterStore'

// ---------------------------------------------------------------------------
// Whole-account backup: every mind map (not just the open one) plus, if
// asked, Trade Analysis, the Whiteboard and the Strategy Tester, in ONE .json
// file the person keeps on their own PC. Import only ever ADDS — nothing that
// already exists is overwritten or deleted.
// ---------------------------------------------------------------------------

export const FULL_BACKUP_APP = 'mindmap-full-backup'
const LAST_KEY = 'mm-last-full-backup'

export const getLastBackupAt = () => {
  try { return Number(localStorage.getItem(LAST_KEY)) || 0 } catch { return 0 }
}
const setLastBackupAt = () => {
  try { localStorage.setItem(LAST_KEY, String(Date.now())) } catch { /* private mode */ }
}

const emptyData = () => ({ nodes: [], edges: [], groups: [], activityLog: [] })

// Live counts shown in the popup so the person sees exactly what's inside.
export function currentStats() {
  const ps = useProjectsStore.getState()
  const mapSt = useMapStore.getState()
  let nodes = 0
  for (const p of ps.projects) {
    const d = p.id === ps.activeProjectId ? mapSt : readProjectData(p.id)
    nodes += d?.nodes?.length || 0
  }
  const ta = useTradeAnalysisStore.getState()
  const st = useStrategyTesterStore.getState()
  return {
    maps: ps.projects.length,
    nodes,
    trades: ta.trades.length,
    whiteboard: useWhiteboardStore.getState().elements.length,
    strategies: st.strategies.length,
  }
}

export function buildFullBackup(include) {
  const ps = useProjectsStore.getState()
  // Flush the canvas that's currently open so its latest edits are included.
  if (ps.activeProjectId) useMapStore.getState().saveProject(ps.activeProjectId)

  const payload = { app: FULL_BACKUP_APP, backupVersion: 2, exportedAt: new Date().toISOString(), include }
  if (include.maps) {
    payload.projects = ps.projects.map((p) => ({
      meta: { id: p.id, name: p.name, createdAt: p.createdAt, updatedAt: p.updatedAt },
      data: readProjectData(p.id) || emptyData(),
    }))
  }
  if (include.trades) {
    const t = useTradeAnalysisStore.getState()
    payload.tradeAnalysis = {
      trades: t.trades,
      validationRules: t.validationRules,
      validationCategories: t.validationCategories,
      setupTypes: t.setupTypes,
    }
  }
  if (include.whiteboard) payload.whiteboard = { elements: useWhiteboardStore.getState().elements }
  if (include.strategy) {
    const s = useStrategyTesterStore.getState()
    payload.strategyTester = { strategies: s.strategies, entries: s.entries }
  }
  return payload
}

export function downloadFullBackup(include) {
  const payload = buildFullBackup(include)
  const json = JSON.stringify(payload)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const d = new Date()
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const a = document.createElement('a')
  a.href = url
  a.download = `mindmap-full-backup-${stamp}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  setLastBackupAt()
  return { bytes: json.length, mapCount: payload.projects?.length || 0 }
}

// Parses a chosen file and reports what's inside (without changing anything).
export function readFullBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = () => {
      let data
      try { data = JSON.parse(reader.result) } catch { reject(new Error('That file isn’t valid JSON.')); return }
      if (data?.app !== FULL_BACKUP_APP) {
        // A single-map backup from the older toolbar button.
        if (Array.isArray(data?.nodes)) {
          resolve({
            parsed: { app: FULL_BACKUP_APP, projects: [{ meta: { name: 'Imported map' }, data: { nodes: data.nodes, edges: data.edges || [], groups: data.groups || [], activityLog: data.activityLog || [] } }] },
            summary: { maps: 1, nodes: data.nodes.length, trades: 0, whiteboard: 0, strategies: 0 },
          })
          return
        }
        reject(new Error('This isn’t a MindMap full-backup file.'))
        return
      }
      resolve({
        parsed: data,
        summary: {
          maps: data.projects?.length || 0,
          nodes: (data.projects || []).reduce((n, p) => n + (p.data?.nodes?.length || 0), 0),
          trades: data.tradeAnalysis?.trades?.length || 0,
          whiteboard: data.whiteboard?.elements?.length || 0,
          strategies: data.strategyTester?.strategies?.length || 0,
        },
      })
    }
    reader.readAsText(file)
  })
}

const byId = (list) => new Set((list || []).map((x) => x?.id))
const addMissing = (existing, incoming) => {
  const have = byId(existing)
  const fresh = (incoming || []).filter((x) => x && !have.has(x.id))
  return { merged: [...existing, ...fresh], added: fresh.length }
}
function mergeDeep(existing, incoming) {
  if (existing == null) return incoming
  if (typeof existing !== 'object' || typeof incoming !== 'object' || Array.isArray(existing)) return existing
  const out = { ...existing }
  for (const k of Object.keys(incoming)) out[k] = k in existing ? mergeDeep(existing[k], incoming[k]) : incoming[k]
  return out
}

// Adds the backup's contents on top of what's here. Existing items win.
export function importFullBackup(parsed, include) {
  const done = { maps: 0, trades: 0, whiteboard: 0, strategies: 0 }

  if (include.maps && parsed.projects?.length) {
    const ps = useProjectsStore.getState()
    const taken = new Set(ps.projects.map((p) => p.id))
    const now = Date.now()
    const fresh = parsed.projects.map((p, i) => {
      let id = p.meta?.id
      let name = p.meta?.name || 'Imported map'
      if (!id || taken.has(id)) {
        id = `proj_${now}_imp${i}`
        name = taken.size && p.meta?.id ? `${name} (imported)` : name
      }
      taken.add(id)
      writeProjectData(id, { ...emptyData(), ...(p.data || {}) })
      return { id, name, createdAt: p.meta?.createdAt || now, updatedAt: now, cloudSynced: false }
    })
    useProjectsStore.getState().importProjects(fresh)
    done.maps = fresh.length
  }

  if (include.trades && parsed.tradeAnalysis) {
    const inc = parsed.tradeAnalysis
    useTradeAnalysisStore.setState((s) => {
      const t = addMissing(s.trades, inc.trades)
      const r = addMissing(s.validationRules, inc.validationRules)
      const c = addMissing(s.validationCategories, inc.validationCategories)
      const have = new Set(s.setupTypes.map((x) => String(x).toLowerCase()))
      const setupTypes = [...s.setupTypes, ...(inc.setupTypes || []).filter((x) => !have.has(String(x).toLowerCase()))]
      done.trades = t.added
      return { trades: t.merged, validationRules: r.merged, validationCategories: c.merged, setupTypes }
    })
  }

  if (include.whiteboard && parsed.whiteboard?.elements) {
    useWhiteboardStore.setState((s) => {
      const w = addMissing(s.elements, parsed.whiteboard.elements)
      done.whiteboard = w.added
      return { elements: w.merged }
    })
  }

  if (include.strategy && parsed.strategyTester) {
    const inc = parsed.strategyTester
    useStrategyTesterStore.setState((s) => {
      const st = addMissing(s.strategies, inc.strategies)
      done.strategies = st.added
      return { strategies: st.merged, entries: mergeDeep(s.entries || {}, inc.entries || {}) }
    })
  }
  return done
}
