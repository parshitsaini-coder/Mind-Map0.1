import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useMapStore } from '../../store/mapStore'
import { useIsMobile } from '../../hooks/useIsMobile'
import { LAYOUTS, THEME_PRESETS } from '../../theme/tokens'
import NodeInspector from './NodeInspector'
import TaskPanel from './TaskPanel'
import OutlineView from './OutlineView'
import CommentsPanel from './CommentsPanel'
import ActivityLog from './ActivityLog'
import WorkspacesPanel from './WorkspacesPanel'

const PANEL_TITLES = {
  inspector: 'Node Inspector',
  layouts: 'Layouts',
  theme: 'Theme',
  outline: 'Outline View',
  tasks: 'Tasks',
  comments: 'Comments',
  activity: 'Activity & Versions',
  workspaces: 'Workspaces',
}

function PanelBody({ panel }) {
  const setLayout = useUiStore((s) => s.setLayout)
  const layout = useUiStore((s) => s.layout)
  const treeDirection = useUiStore((s) => s.treeDirection)
  const setTreeDirection = useUiStore((s) => s.setTreeDirection)
  const setThemeName = useUiStore((s) => s.setThemeName)
  const themeName = useUiStore((s) => s.themeName)
  const applyLayout = useMapStore((s) => s.applyLayout)

  const chooseLayout = (id) => {
    setLayout(id)
    applyLayout(id)
  }

  if (panel === 'layouts') {
    return (
      <div className="flex flex-col gap-1.5">
        {LAYOUTS.map((l) => (
          <button
            key={l.id}
            onClick={() => chooseLayout(l.id)}
            className={`rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
              layout === l.id ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/30' : 'border-[var(--color-sage)] hover:bg-[var(--color-sage)]/40'
            }`}
          >
            {l.label}
          </button>
        ))}

        {layout === 'orgChart' && (
          <div className="mt-2 flex gap-1.5">
            {['vertical', 'horizontal'].map((dir) => (
              <button
                key={dir}
                onClick={() => {
                  setTreeDirection(dir)
                  applyLayout('orgChart', dir)
                }}
                className={`flex-1 rounded-md border py-1 text-[10px] capitalize ${
                  treeDirection === dir ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/30' : 'border-[var(--color-sage)]'
                }`}
              >
                {dir === 'vertical' ? 'Top-down' : 'Left-right'}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => chooseLayout(layout)}
          className="mt-2 rounded-md border border-[var(--color-slate)] py-1 text-[10px] hover:bg-[var(--color-sage)]/40"
        >
          Re-run layout
        </button>
      </div>
    )
  }

  if (panel === 'inspector') {
    return <NodeInspector />
  }

  if (panel === 'tasks') {
    return <TaskPanel />
  }

  if (panel === 'outline') {
    return <OutlineView />
  }

  if (panel === 'comments') {
    return <CommentsPanel />
  }

  if (panel === 'activity') {
    return <ActivityLog />
  }

  if (panel === 'workspaces') {
    return <WorkspacesPanel />
  }

  if (panel === 'theme') {
    return (
      <div className="flex flex-col gap-2">
        {Object.entries(THEME_PRESETS).map(([name, colors]) => (
          <button
            key={name}
            onClick={() => setThemeName(name)}
            className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs capitalize ${
              themeName === name ? 'border-[var(--color-accent)]' : 'border-[var(--color-sage)]'
            }`}
          >
            <span className="flex gap-0.5">
              {Object.values(colors).slice(0, 4).map((c) => (
                <span key={c} style={{ backgroundColor: c }} className="h-3 w-3 rounded-full border border-black/10" />
              ))}
            </span>
            {name}
          </button>
        ))}
      </div>
    )
  }

  return (
    <p className="text-xs text-[var(--color-slate)]">
      {PANEL_TITLES[panel]} panel — full functionality lands in later progress-tracker steps (rich text,
      tasks, comments, version history).
    </p>
  )
}

export default function Sidebar() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen)
  const activePanel = useUiStore((s) => s.activePanel)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const isMobile = useIsMobile()

  return (
    <AnimatePresence>
      {sidebarOpen && (
        <>
          {/* Section 14 — responsive pass: below sm, the sidebar overlays the
              canvas (fixed) with a dismissible backdrop instead of squeezing
              it — a 220px-narrower canvas is unusable on a phone-width
              screen. From sm up it stays docked in the normal flex flow. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggleSidebar}
            className="fixed inset-0 top-11 z-30 bg-black/30 sm:hidden"
          />

          {isMobile ? (
            // Section — Mobile touch UI: a bottom sheet instead of a narrow
            // side overlay. Full-width, capped at 70vh so the map behind it
            // stays partly visible/reachable, with a drag-handle affordance
            // and larger (py-2) tap targets throughout the header.
            <motion.aside
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              className="fixed inset-x-0 bottom-0 z-40 flex max-h-[70vh] flex-col overflow-hidden rounded-t-2xl border-t shadow-2xl"
              style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
            >
              <div className="flex shrink-0 justify-center pt-2">
                <div className="h-1 w-10 rounded-full" style={{ backgroundColor: 'var(--color-sage)' }} />
              </div>
              <div className="flex min-h-0 flex-1 flex-col p-3">
                <div className="mb-2 flex items-center justify-between">
                  <motion.h2
                    key={activePanel}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="animated-panel-title text-sm font-semibold"
                  >
                    {PANEL_TITLES[activePanel]}
                  </motion.h2>
                  <button onClick={toggleSidebar} className="rounded-full p-1.5 hover:bg-[var(--color-sage)]">
                    <X size={16} />
                  </button>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activePanel}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="min-h-0 flex-1 overflow-y-auto pb-2 pr-0.5 text-sm"
                  >
                    <PanelBody panel={activePanel} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.aside>
          ) : (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 220, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="fixed top-11 right-0 bottom-0 z-40 h-auto shrink-0 overflow-hidden border-l shadow-xl sm:static sm:z-auto sm:h-full sm:shadow-none"
              style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
            >
              <div className="flex h-full w-[220px] flex-col p-3">
                <div className="mb-2 flex items-center justify-between">
                  <motion.h2
                    key={activePanel}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    className="animated-panel-title text-xs font-semibold"
                  >
                    {PANEL_TITLES[activePanel]}
                  </motion.h2>
                  <button onClick={toggleSidebar} className="rounded p-0.5 hover:bg-[var(--color-sage)]">
                    <X size={13} />
                  </button>
                </div>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activePanel}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                    className="min-h-0 flex-1 overflow-y-auto pr-0.5"
                  >
                    <PanelBody panel={activePanel} />
                  </motion.div>
                </AnimatePresence>
              </div>
            </motion.aside>
          )}
        </>
      )}
    </AnimatePresence>
  )
}
