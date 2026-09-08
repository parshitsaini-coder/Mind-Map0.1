import { AnimatePresence, motion } from 'framer-motion'
import { Plus, X, LayoutGrid } from 'lucide-react'
import { useProjectsStore } from '../../store/projectsStore'
import { useMapStore } from '../../store/mapStore'

// Browser-style tab strip for open mind-map projects. Sits just under the
// main toolbar. Clicking a tab switches the canvas to that project;
// clicking "+" (or the grid icon) opens the Projects dashboard to create a
// new one or pick from all saved projects.
export default function TabsBar() {
  const projects = useProjectsStore((s) => s.projects)
  const openTabs = useProjectsStore((s) => s.openTabs)
  const activeProjectId = useProjectsStore((s) => s.activeProjectId)
  const switchTab = useProjectsStore((s) => s.switchTab)
  const closeTab = useProjectsStore((s) => s.closeTab)
  const openDashboard = useProjectsStore((s) => s.openDashboard)

  const byId = Object.fromEntries(projects.map((p) => [p.id, p]))

  const handleSwitch = (id) => {
    if (id === activeProjectId) return
    // Save the outgoing project before swapping the canvas over.
    if (activeProjectId) useMapStore.getState().saveProject(activeProjectId)
    switchTab(id)
    useMapStore.getState().loadProject(id)
  }

  const handleClose = (e, id) => {
    e.stopPropagation()
    if (activeProjectId) useMapStore.getState().saveProject(activeProjectId)
    closeTab(id)
    const nextActive = useProjectsStore.getState().activeProjectId
    if (nextActive && nextActive !== id) useMapStore.getState().loadProject(nextActive)
  }

  if (openTabs.length === 0) return null

  return (
    <div
      className="no-scrollbar flex h-6 shrink-0 items-center gap-1 overflow-x-auto border-b px-2"
      style={{ backgroundColor: '#cfdbd5', borderColor: '#b8c4bd' }}
    >
      <button
        onClick={openDashboard}
        title="All projects"
        className="flex shrink-0 items-center justify-center rounded-md p-1 hover:bg-white/50"
      >
        <LayoutGrid size={13} color="#242423" />
      </button>
      <AnimatePresence initial={false}>
        {openTabs.map((id) => {
          const project = byId[id]
          if (!project) return null
          const active = id === activeProjectId
          return (
            <motion.button
              key={id}
              layout
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.14 }}
              onClick={() => handleSwitch(id)}
              title={project.name}
              className={`group flex shrink-0 items-center gap-1 rounded-t-md px-2 py-0.5 text-[10px] transition-colors ${
                active ? 'font-medium' : 'text-[#333533]/70 hover:bg-white/40'
              }`}
              style={active ? { backgroundColor: '#e8eddf', color: '#242423' } : undefined}
            >
              <span className="max-w-[120px] truncate">{project.name}</span>
              <span
                role="button"
                tabIndex={-1}
                onClick={(e) => handleClose(e, id)}
                className="rounded-sm p-0.5 opacity-0 hover:bg-black/10 group-hover:opacity-100"
                title="Close tab"
              >
                <X size={11} />
              </span>
            </motion.button>
          )
        })}
      </AnimatePresence>
      <button
        onClick={openDashboard}
        title="New project"
        className="flex shrink-0 items-center justify-center rounded-md p-1 hover:bg-white/50"
      >
        <Plus size={13} color="#242423" />
      </button>
    </div>
  )
}
