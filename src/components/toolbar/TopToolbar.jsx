import 'motion-icons-react/style.css'
import { MotionIcon } from 'motion-icons-react'
import {
  Plus,
  StickyNote,
  LayoutGrid,
  Palette,
  ListTree,
  CheckSquare,
  MessageSquare,
  History,
  Focus,
  PlayCircle,
  Undo2,
  Redo2,
  Search,
  Target,
  Shapes,
  Share2,
  FolderOpen,
  Users,
  Download,
  FileDown,
  FileJson,
  Upload,
  GitBranch,
  User,
  UserCheck,
  LayoutDashboard,
  Sparkles,
  PenSquare,
  CandlestickChart,
  ListChecks,
  LibraryBig,
} from 'lucide-react'
import { useState, useRef } from 'react'
import { useMapStore } from '../../store/mapStore'
import { useUiStore } from '../../store/uiStore'
import { useWhiteboardStore } from '../../store/whiteboardStore'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { useAuthStore } from '../../store/authStore'
import { useProjectsStore } from '../../store/projectsStore'

import { exportMapAsPng, exportMapAsPdf } from '../../utils/exportImage'
import { downloadMapBackup, readMapBackup } from '../../utils/exportImportBackup'

const IconBtn = ({ icon: Icon, label, onClick, active }) => (
  <button
    onClick={onClick}
    title={label}
    className={`flex shrink-0 items-center justify-center rounded-md p-1 transition-colors ${
      active ? 'bg-[var(--color-accent)]' : 'hover:bg-[var(--color-sage)]'
    }`}
  >
    <MotionIcon
      name={Icon.displayName || Icon.name}
      size={13}
      color="var(--color-ink)"
      interactive
      trigger="hover"
      animation="nudge"
      animationDuration={180}
    />
  </button>
)

export default function TopToolbar() {
  const addFloatingNode = useMapStore((s) => s.addFloatingNode)
  const addCentralTopic = useMapStore((s) => s.addCentralTopic)
  const addGroupFromSelection = useMapStore((s) => s.addGroupFromSelection)
  const undo = useMapStore((s) => s.undo)
  const redo = useMapStore((s) => s.redo)
  const activePanel = useUiStore((s) => s.activePanel)
  const setActivePanel = useUiStore((s) => s.setActivePanel)
  const focusMode = useUiStore((s) => s.focusMode)
  const toggleFocusMode = useUiStore((s) => s.toggleFocusMode)
  const togglePresentationMode = useUiStore((s) => s.togglePresentationMode)
  const searchOpen = useUiStore((s) => s.searchOpen)
  const toggleSearch = useUiStore((s) => s.toggleSearch)
  const showMockCursors = useUiStore((s) => s.showMockCursors)
  const toggleMockCursors = useUiStore((s) => s.toggleMockCursors)
  const connectorPanelOpen = useUiStore((s) => s.connectorPanelOpen)
  const toggleConnectorPanel = useUiStore((s) => s.toggleConnectorPanel)
  const toggleAuthModal = useUiStore((s) => s.toggleAuthModal)
  const styleLibraryOpen = useUiStore((s) => s.styleLibraryOpen)
  const toggleStyleLibrary = useUiStore((s) => s.toggleStyleLibrary)
  const nodeLibraryOpen = useUiStore((s) => s.nodeLibraryOpen)
  const toggleNodeLibrary = useUiStore((s) => s.toggleNodeLibrary)
  const authUser = useAuthStore((s) => s.user)
  const showToast = useUiStore((s) => s.showToast)
  const nodes = useMapStore((s) => s.nodes)
  const edges = useMapStore((s) => s.edges)
  const groups = useMapStore((s) => s.groups)
  const activityLog = useMapStore((s) => s.activityLog)
  const loadMapData = useMapStore((s) => s.loadMapData)
  const openProjectsDashboard = useProjectsStore((s) => s.openDashboard)
  const [exporting, setExporting] = useState(false)
  const backupInputRef = useRef(null)

  const toggleShareModal = useUiStore((s) => s.toggleShareModal)

  const handleExportPng = async () => {
    if (exporting) return
    setExporting(true)
    try {
      await exportMapAsPng(nodes)
      showToast('Exported as PNG')
    } catch (err) {
      showToast(err.message || 'Could not export PNG')
    } finally {
      setExporting(false)
    }
  }

  const handleExportPdf = async () => {
    if (exporting) return
    setExporting(true)
    try {
      await exportMapAsPdf(nodes)
      showToast('Exported as PDF')
    } catch (err) {
      showToast(err.message || 'Could not export PDF')
    } finally {
      setExporting(false)
    }
  }

  const handleExportJson = () => {
    downloadMapBackup({ nodes, edges, groups, activityLog })
    showToast('Backup downloaded (.json)')
  }

  const handleImportJsonClick = () => backupInputRef.current?.click()

  const handleImportJsonFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (
      !window.confirm(
        'Import this backup? It will replace your current map — your current map stays in undo history (Ctrl+Z).'
      )
    ) {
      return
    }
    try {
      const data = await readMapBackup(file)
      loadMapData(data)
      showToast('Backup imported')
    } catch (err) {
      showToast(err.message || 'Could not import that file')
    }
  }

  return (
    <div
      className="flex h-8 shrink-0 items-center gap-1 border-b px-2"
      style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
    >
      {/* Section 14 — responsive pass: this cluster is the widest part of the
          toolbar (11 icons). On narrow/mobile viewports it scrolls
          horizontally instead of wrapping or clipping, so the undo/redo/
          focus/presentation cluster on the right stays reachable. */}
      <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        <span className="hidden shrink-0 text-xs font-semibold sm:inline" style={{ color: 'var(--color-ink)' }}>
          🧠 MindMap
        </span>
        <div className="mx-0.5 hidden h-4 w-px shrink-0 sm:block" style={{ backgroundColor: 'var(--color-sage)' }} />
        <IconBtn icon={LayoutDashboard} label="My mind maps (new / open projects)" onClick={openProjectsDashboard} />
        <IconBtn
          icon={PenSquare}
          label="Whiteboard — write text/notes anywhere, draw, then attach a note to any node"
          onClick={() => useWhiteboardStore.getState().open()}
        />
        <IconBtn
          icon={CandlestickChart}
          label="Trade Analysis — log trades with screenshots, notes & a validation checklist"
          onClick={() => useTradeAnalysisStore.getState().open()}
        />
        <IconBtn
          icon={ListChecks}
          label="Checklists — build reusable checkbox lists and apply them to any node"
          onClick={() => useUiStore.getState().openChecklistPanel()}
        />
        <IconBtn icon={Target} label="Add central topic" onClick={addCentralTopic} />
        <IconBtn icon={StickyNote} label="Add floating note" onClick={addFloatingNode} />
        <IconBtn
          icon={Shapes}
          label="Group selected nodes into a boundary (select 2+ nodes with Shift-drag first)"
          onClick={() => addGroupFromSelection('box')}
        />
        <IconBtn icon={LayoutGrid} label="Layouts" active={activePanel === 'layouts'} onClick={() => setActivePanel('layouts')} />
        <IconBtn icon={Palette} label="Theme" active={activePanel === 'theme'} onClick={() => setActivePanel('theme')} />
        <IconBtn icon={ListTree} label="Outline view" active={activePanel === 'outline'} onClick={() => setActivePanel('outline')} />
        <IconBtn icon={CheckSquare} label="Tasks" active={activePanel === 'tasks'} onClick={() => setActivePanel('tasks')} />
        <IconBtn icon={MessageSquare} label="Comments" active={activePanel === 'comments'} onClick={() => setActivePanel('comments')} />
        <IconBtn icon={History} label="Activity / version history" active={activePanel === 'activity'} onClick={() => setActivePanel('activity')} />
        <IconBtn icon={FolderOpen} label="Workspaces" active={activePanel === 'workspaces'} onClick={() => setActivePanel('workspaces')} />
        <IconBtn icon={Share2} label="Share (one-time or live link)" onClick={toggleShareModal} />
        <IconBtn icon={Download} label="Export as PNG image" onClick={handleExportPng} />
        <IconBtn icon={FileDown} label="Export as PDF" onClick={handleExportPdf} />
        <IconBtn icon={FileJson} label="Download backup (.json) — full map, restorable" onClick={handleExportJson} />
        <IconBtn icon={Upload} label="Import backup (.json)" onClick={handleImportJsonClick} />
        <input
          ref={backupInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportJsonFile}
          className="hidden"
        />
        <IconBtn
          icon={GitBranch}
          label="Connector Styles panel — select a line, pick a style"
          active={connectorPanelOpen}
          onClick={toggleConnectorPanel}
        />
        <IconBtn icon={Users} label="Simulate collaborators (local demo only)" active={showMockCursors} onClick={toggleMockCursors} />
        <IconBtn
          icon={Sparkles}
          label="Style Library — 40+ colors, gradients, glow & animated node styles"
          active={styleLibraryOpen}
          onClick={toggleStyleLibrary}
        />
        <IconBtn
          icon={LibraryBig}
          label="Node Library — add multiple nodes in a layout (horizontal, vertical, circular, grid)"
          active={nodeLibraryOpen}
          onClick={toggleNodeLibrary}
        />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <IconBtn icon={Search} label="Search & replace" active={searchOpen} onClick={toggleSearch} />
        <IconBtn icon={Undo2} label="Undo (Ctrl+Z)" onClick={undo} />
        <IconBtn icon={Redo2} label="Redo (Ctrl+Y)" onClick={redo} />
        <div className="mx-0.5 hidden h-4 w-px sm:block" style={{ backgroundColor: 'var(--color-sage)' }} />
        <IconBtn icon={Focus} label="Focus mode" active={focusMode} onClick={toggleFocusMode} />
        <IconBtn icon={PlayCircle} label="Presentation mode" onClick={togglePresentationMode} />
        <IconBtn
          icon={authUser ? UserCheck : User}
          label={authUser ? `Signed in as ${authUser.name} — click for account` : 'Sign up / Log in to save online'}
          active={!!authUser}
          onClick={toggleAuthModal}
        />
      </div>
    </div>
  )
}
