import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Clock, Save, RotateCcw, Trash2 } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { listSnapshots, saveSnapshot, deleteSnapshot } from '../../utils/versionHistory'

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function ActivityLog() {
  const [tab, setTab] = useState('activity')
  const activityLog = useMapStore((s) => s.activityLog)
  const nodes = useMapStore((s) => s.nodes)
  const edges = useMapStore((s) => s.edges)
  const pushSnapshot = useMapStore((s) => s.pushSnapshot)
  const logActivity = useMapStore((s) => s.logActivity)
  const [, forceRender] = useState(0)

  const snapshots = listSnapshots()

  const handleSave = () => {
    const label = window.prompt('Name this snapshot', new Date().toLocaleString())
    if (label === null) return
    saveSnapshot(label, { nodes, edges })
    logActivity(`📸 Saved version snapshot "${label}"`)
    forceRender((n) => n + 1)
  }

  const handleRestore = (snap) => {
    if (!window.confirm(`Restore "${snap.label}"? Current changes will be pushed to undo history.`)) return
    pushSnapshot()
    useMapStore.setState({ nodes: snap.data.nodes, edges: snap.data.edges })
    logActivity(`⏪ Restored version "${snap.label}"`)
  }

  const handleDelete = (id) => {
    deleteSnapshot(id)
    forceRender((n) => n + 1)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        <button
          onClick={() => setTab('activity')}
          className={`rounded-md border px-2 py-1 text-[10px] ${tab === 'activity' ? 'border-[#f5cb5c] bg-[#f5cb5c]/30' : 'border-[#cfdbd5]'}`}
        >
          Activity
        </button>
        <button
          onClick={() => setTab('versions')}
          className={`rounded-md border px-2 py-1 text-[10px] ${tab === 'versions' ? 'border-[#f5cb5c] bg-[#f5cb5c]/30' : 'border-[#cfdbd5]'}`}
        >
          Versions
        </button>
      </div>

      {tab === 'activity' ? (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          {activityLog.length === 0 && <p className="text-[10px] text-[#333533]">No activity yet.</p>}
          <AnimatePresence initial={false}>
            {activityLog.map((a) => (
              <motion.li
                key={a.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                transition={{ duration: 0.16 }}
                className="flex items-start gap-1 text-[10px]"
              >
                <Clock size={10} className="mt-0.5 shrink-0 text-[#333533]" />
                <span className="flex-1">{a.message}</span>
                <span className="shrink-0 text-[9px] text-[#333533]">{timeAgo(a.ts)}</span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <div className="flex flex-col gap-1.5">
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleSave}
            className="flex w-fit items-center gap-1 rounded-md border border-[#333533] px-2 py-1 text-[10px] hover:bg-[#cfdbd5]/30"
          >
            <Save size={10} /> Save snapshot now
          </motion.button>
          <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {snapshots.length === 0 && <p className="text-[10px] text-[#333533]">No snapshots yet.</p>}
            <AnimatePresence initial={false}>
              {snapshots.map((snap) => (
                <motion.li
                  key={snap.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.16 }}
                  className="flex items-center justify-between rounded-md bg-[#cfdbd5]/25 px-1.5 py-1 text-[10px]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{snap.label}</p>
                    <p className="text-[9px] text-[#333533]">{timeAgo(snap.timestamp)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => handleRestore(snap)} title="Restore"><RotateCcw size={11} /></button>
                    <button onClick={() => handleDelete(snap.id)} title="Delete"><Trash2 size={11} /></button>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}
    </div>
  )
}
