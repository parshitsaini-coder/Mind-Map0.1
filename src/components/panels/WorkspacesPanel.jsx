import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Save, FolderOpen, Trash2 } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'

function listWorkspaces() {
  try {
    return JSON.parse(localStorage.getItem('mindmap-workspaces') || '[]')
  } catch {
    return []
  }
}

export default function WorkspacesPanel() {
  const saveWorkspace = useMapStore((s) => s.saveWorkspace)
  const loadWorkspace = useMapStore((s) => s.loadWorkspace)
  const [, forceRender] = useState(0)
  const [name, setName] = useState('')

  const workspaces = listWorkspaces()

  const handleSave = () => {
    if (!name.trim()) return
    saveWorkspace(name.trim())
    setName('')
    forceRender((n) => n + 1)
  }

  const handleDelete = (wsName) => {
    const updated = listWorkspaces().filter((w) => w.name !== wsName)
    localStorage.setItem('mindmap-workspaces', JSON.stringify(updated))
    forceRender((n) => n + 1)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          placeholder="Workspace name…"
          className="flex-1 rounded-md border border-[#cfdbd5] bg-white/60 px-2 py-1 text-[10px] outline-none focus:border-[#f5cb5c]"
        />
        <button onClick={handleSave} className="rounded-md border border-[#333533] px-2" title="Save current map">
          <Save size={12} />
        </button>
      </div>
      <ul className="flex flex-col gap-1">
        {workspaces.length === 0 && <p className="text-[10px] text-[#333533]">No saved workspaces yet.</p>}
        <AnimatePresence initial={false}>
          {workspaces.map((w) => (
            <motion.li
              key={w.name}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.16 }}
              className="flex items-center justify-between rounded-md bg-[#cfdbd5]/25 px-1.5 py-1 text-[10px]"
            >
              <span className="truncate">{w.name}</span>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => loadWorkspace(w.name)} title="Load"><FolderOpen size={11} /></button>
                <button onClick={() => handleDelete(w.name)} title="Delete"><Trash2 size={11} /></button>
              </div>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  )
}
