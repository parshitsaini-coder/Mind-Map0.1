import { useTradeAnalysisStore } from '../store/tradeAnalysisStore'
import { useStrategyTesterStore } from '../store/strategyTesterStore'
import { useProjectsStore } from '../store/projectsStore'
import { useMapStore } from '../store/mapStore'
import { deleteProjectCloud } from './projectCloudSync'
import { useTerminalStore } from '../store/terminalStore'
import { terminalCloud } from './terminal/terminalCloud'

// Wipes the signed-in person's data — both this browser's copy and the
// cloud copy — for whichever groups are selected. Used by the "Clear all
// data" action in the account popup (behind its ID + password gate).
//   trades   -> Trade Analysis (trades, validation rules/categories)
//   strategy -> Strategy Tester (strategies + entries)
//   maps     -> every mind map; a single blank "My Mind Map" is left behind
//   terminal -> Demo Terminal (virtual account, positions, history, drawings, indicators)
export async function clearAccountData(userId, { trades = true, strategy = true, maps = true, terminal = true } = {}) {
  if (trades) {
    const s = useTradeAnalysisStore.getState()
    s.resetLocalData()
    await s.saveToCloud(userId) // upserts the now-empty row
  }
  if (strategy) {
    const s = useStrategyTesterStore.getState()
    s.resetLocalData()
    await s.saveToCloud(userId)
  }
  if (terminal) {
    const t = useTerminalStore.getState()
    const known = t.cloudMeta?.cloudUpdatedAt || null
    t.resetLocalData()
    // A deliberate wipe: uploaded even though the account is now empty (otherwise the
    // "never overwrite a non-empty cloud account with an empty one" rule would restore it).
    await terminalCloud.forcePush(known)
  }
  if (maps) {
    const ps = useProjectsStore.getState()
    const ids = ps.projects.map((p) => p.id)
    ids.forEach((id) => ps.deleteProject(id))
    await Promise.all(ids.map((id) => deleteProjectCloud(userId, id)))
    const fresh = useProjectsStore.getState().createProject('My Mind Map')
    useMapStore.getState().loadProject(fresh)
  }
}
