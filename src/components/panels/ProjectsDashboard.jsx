import { useMemo, useState } from 'react'
import { useAuthStore } from '../../store/authStore'
import { useUiStore } from '../../store/uiStore'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, FolderOpen, Trash2, Pencil, Check, X } from 'lucide-react'
import MindNodeIcon from '../common/MindNodeIcon'
import { useProjectsStore, readProjectData } from '../../store/projectsStore'
import { useMapStore } from '../../store/mapStore'
import DeleteConfirmModal from './DeleteConfirmModal'
import { computeHidden } from '../../utils/graphUtils'

// Live preview of a whole mind map: every (visible) node + connector drawn as a small SVG, auto-fitted to the card.
const firstColor = (bg) => (typeof bg === 'string' ? bg.match(/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)/i)?.[0] : null)

function MapThumbnail({ nodes, edges }) {
  const model = useMemo(() => {
    if (!nodes?.length) return null
    const { hiddenNodeIds, hiddenEdgeIds } = computeHidden(nodes, edges || [], { revealManualHidden: true })
    const vis = nodes.filter((n) => !hiddenNodeIds.has(n.id) && n.type !== 'boundaryGroup')
    if (!vis.length) return null
    const boxes = new Map()
    for (const n of vis) {
      const d = n.data || {}
      const sc = d.sizeScale || 1
      const label = String(d.label ?? '')
      const w = n.measured?.width || n.width || Math.max(90, Math.min(260, label.length * 7 + 28)) * sc
      const h = n.measured?.height || n.height || 30 * sc
      boxes.set(n.id, { x: n.position.x, y: n.position.y, w, h, d, label })
    }
    const all = [...boxes.values()]
    const minX = Math.min(...all.map((b) => b.x)), minY = Math.min(...all.map((b) => b.y))
    const maxX = Math.max(...all.map((b) => b.x + b.w)), maxY = Math.max(...all.map((b) => b.y + b.h))
    const pad = 24
    const lines = (edges || [])
      .filter((e) => !hiddenEdgeIds.has(e.id) && boxes.has(e.source) && boxes.has(e.target))
      .map((e) => {
        const a = boxes.get(e.source), b = boxes.get(e.target)
        const x1 = a.x + a.w, y1 = a.y + a.h / 2, x2 = b.x, y2 = b.y + b.h / 2
        const dx = Math.max(30, Math.abs(x2 - x1) / 2)
        return { id: e.id, d: `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`, cross: e.type === 'crossEdge' }
      })
    return { boxes: [...boxes.entries()], lines, vb: `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}` }
  }, [nodes, edges])

  if (!model) return <MindNodeIcon size={22} color="var(--color-accent)" />
  return (
    <svg viewBox={model.vb} preserveAspectRatio="xMidYMid meet" className="h-full w-full" aria-hidden>
      {model.lines.map((l) => (
        <path key={l.id} d={l.d} fill="none" stroke="#7b8794" strokeWidth={2.2} strokeDasharray={l.cross ? '6 5' : undefined} opacity={0.75} />
      ))}
      {model.boxes.map(([id, b]) => {
        const fill = b.d.customBg ? firstColor(b.d.customBg) || b.d.color : b.d.color
        const r = b.d.shape === 'oval' ? b.h / 2 : b.d.shape === 'no-border' ? 0 : 6
        return (
          <g key={id} opacity={b.d.opacity ?? 1}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={r} fill={fill || '#f5f5f0'} stroke={b.d.customBorder?.color || '#5c6b7a'} strokeWidth={b.d.shape === 'no-border' ? 0 : 1.4} strokeDasharray={b.d.customBorder?.style === 'dashed' ? '5 3' : undefined} />
            <text x={b.x + b.w / 2} y={b.y + b.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={Math.min(13 * (b.d.sizeScale || 1), b.h * 0.42)} fill={b.d.textColor || '#242423'} fontFamily="Inter, system-ui, sans-serif">
              {b.label.length > 22 ? `${b.label.slice(0, 21)}…` : b.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

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
        className="relative flex h-36 w-full items-center justify-center p-1.5 transition-colors hover:brightness-95"
        style={{ backgroundColor: 'var(--color-bg-main, #ecebe4)' }}
        title="Open project"
      >
        <MapThumbnail nodes={data?.nodes} edges={data?.edges} />
        <span className="absolute bottom-1 right-1.5 rounded-full bg-black/55 px-1.5 py-px text-[9px] font-medium text-white">
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
  // Section — password-gated delete. Holds the project awaiting
  // confirmation (or null when no delete is in progress) so
  // DeleteConfirmModal can be mounted/unmounted around it.
  const [pendingDelete, setPendingDelete] = useState(null)
  const authUser = useAuthStore((s) => s.user)
  const [restoring, setRestoring] = useState(false)
  const [restoreMsg, setRestoreMsg] = useState('')
  const handleRestore = async () => {
    if (!authUser || restoring) return
    setRestoring(true)
    const r = await useProjectsStore.getState().syncWithCloud(authUser.id)
    setRestoring(false)
    setRestoreMsg(
      r?.error ? `Error: ${r.error}`
        : `Account: ${authUser.email || '—'} (id ${String(authUser.id).slice(0, 8)}…) — cloud me ${r?.count} maps mile, ${r?.added} naye add hue. Is browser me ab ${useProjectsStore.getState().projects.length} maps hain.`
    )
    useUiStore.getState().showToast(
      r?.error ? `Cloud sync failed: ${r.error}`
        : r?.count === 0 ? 'Cloud me is account ke koi mind map nahi mile.'
        : `Cloud me ${r?.count} mind maps mile — ${r?.added} naye add hue.`
    )
  }

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

  const handleDeleteConfirmed = () => {
    const id = pendingDelete.id
    setPendingDelete(null)
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

          {authUser && (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-[11px]" style={{ borderColor: 'var(--color-sage)', color: 'var(--color-slate)' }}>
              <span>
                Signed in — maps cloud se sync hote hain. Kuch missing lage to restore karo.
                {restoreMsg && <span className="mt-1 block font-semibold" style={{ color: 'var(--color-ink)' }}>{restoreMsg}</span>}
              </span>
              <button
                onClick={handleRestore}
                disabled={restoring}
                className="shrink-0 rounded px-2.5 py-1 text-[11px] font-semibold disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-ink)' }}
              >
                {restoring ? 'Syncing…' : 'Restore from cloud'}
              </button>
            </div>
          )}

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
                    onDelete={() => setPendingDelete(p)}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </motion.div>
      </motion.div>
      {pendingDelete && (
        <DeleteConfirmModal
          projectName={pendingDelete.name}
          onConfirm={handleDeleteConfirmed}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </AnimatePresence>
  )
}
