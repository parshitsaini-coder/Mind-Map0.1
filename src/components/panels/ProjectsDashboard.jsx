import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, FolderOpen, Trash2, Pencil, Check, X } from 'lucide-react'
import MindNodeIcon from '../common/MindNodeIcon'
import { useProjectsStore, readProjectData } from '../../store/projectsStore'
import { useMapStore } from '../../store/mapStore'

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function ProjectCard({ project, isActive, onOpen, onRename, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(project.name)
  const data = readProjectData(project.id)
  const nodeCount = data?.nodes?.length || 0

  const commitRename = () => {
    setEditing(false)
    if (name.trim() && name.trim() !== project.name) onRename(project.id, name.trim())
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col overflow-hidden rounded-lg border shadow-sm"
      style={{ borderColor: isActive ? 'var(--color-accent)' : 'var(--color-sage)', backgroundColor: '#fff' }}
    >
      <button
        onClick={() => onOpen(project.id)}
        className="flex h-24 w-full flex-col items-center justify-center gap-1"
        style={{ backgroundColor: 'var(--color-cream)' }}
        title="Open project"
      >
        <MindNodeIcon size={22} color="var(--color-accent)" />
        <span className="text-[10px] text-[var(--color-slate)]/70">
          {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'}
        </span>
      </button>
      <div className="flex flex-col gap-1 p-2.5">
        {editing ? (
          <div className="flex items-center gap-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && commitRename()}
              className="min-w-0 flex-1 rounded border border-[var(--color-accent)] bg-white px-1.5 py-0.5 text-xs outline-none"
            />
            <button onClick={commitRename} title="Save"><Check size={13} /></button>
            <button onClick={() => setEditing(false)} title="Cancel"><X size={13} /></button>
          </div>
        ) : (
          <button onClick={() => onOpen(project.id)} className="truncate text-left text-xs font-medium" style={{ color: 'var(--color-ink)' }}>
            {project.name}
          </button>
        )}
        <span className="text-[10px] text-[var(--color-slate)]/60">Edited {formatDate(project.updatedAt)}</span>
        <div className="mt-1 flex items-center gap-2">
          <button onClick={() => onOpen(project.id)} className="flex items-center gap-1 text-[10px] hover:underline">
            <FolderOpen size={11} /> Open
          </button>
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-[10px] hover:underline">
            <Pencil size={11} /> Rename
          </button>
          <button onClick={() => onDelete(project.id)} className="ml-auto flex items-center gap-1 text-[10px] text-red-600 hover:underline">
            <Trash2 size={11} /> Delete
          </button>
        </div>
      </div>
    </motion.div>
  )
}

export default function ProjectsDashboard() {
  const dashboardOpen = useProjectsStore((s) => s.dashboardOpen)
  const projects = useProjectsStore((s) => s.projects)
  const activeProjectId = useProjectsStore((s) => s.activeProjectId)
  const openTabs = useProjectsStore((s) => s.openTabs)
  const createProject = useProjectsStore((s) => s.createProject)
  const openProject = useProjectsStore((s) => s.openProject)
  const renameProject = useProjectsStore((s) => s.renameProject)
  const deleteProject = useProjectsStore((s) => s.deleteProject)
  const closeDashboard = useProjectsStore((s) => s.closeDashboard)
  const [newName, setNewName] = useState('')

  if (!dashboardOpen) return null

  const sorted = [...projects].sort((a, b) => b.updatedAt - a.updatedAt)

  const handleCreate = () => {
    if (activeProjectId) useMapStore.getState().saveProject(activeProjectId)
    const id = createProject(newName)
    setNewName('')
    useMapStore.getState().loadProject(id)
  }

  const handleOpen = (id) => {
    if (id === activeProjectId) {
      closeDashboard()
      return
    }
    if (activeProjectId) useMapStore.getState().saveProject(activeProjectId)
    openProject(id)
    useMapStore.getState().loadProject(id)
  }

  const handleDelete = (id) => {
    if (!window.confirm('Delete this project? This cannot be undone.')) return
    deleteProject(id)
    const stillActive = useProjectsStore.getState().activeProjectId
    if (stillActive && stillActive !== id) {
      useMapStore.getState().loadProject(stillActive)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-6"
        onClick={(e) => e.target === e.currentTarget && openTabs.length > 0 && closeDashboard()}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          className="mt-8 w-full max-w-3xl rounded-xl p-5 shadow-2xl"
          style={{ backgroundColor: '#f5f5f0' }}
        >
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold" style={{ color: 'var(--color-ink)' }}>🧠 Your Mind Maps</h2>
            {openTabs.length > 0 && (
              <button onClick={closeDashboard} className="rounded-md p-1 hover:bg-black/5">
                <X size={16} />
              </button>
            )}
          </div>

          <div className="mb-4 flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              placeholder="Name your new mind map…"
              className="flex-1 rounded-md border border-[var(--color-sage)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-accent)]"
            />
            <button
              onClick={handleCreate}
              className="flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium"
              style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-ink)' }}
            >
              <Plus size={15} /> New Project
            </button>
          </div>

          {sorted.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--color-slate)]/60">No mind maps yet — create your first one above.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <AnimatePresence>
                {sorted.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    isActive={p.id === activeProjectId}
                    onOpen={handleOpen}
                    onRename={renameProject}
                    onDelete={handleDelete}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
