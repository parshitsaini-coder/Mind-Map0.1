import { motion } from 'framer-motion'
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
  Link2,
  Shapes,
  Share2,
  FolderOpen,
  Users,
  Spline,
  Download,
  FileDown,
  GitBranch,
  User,
  UserCheck,
  LayoutDashboard,
} from 'lucide-react'
import { useState } from 'react'
import { useMapStore } from '../../store/mapStore'
import { useUiStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { useProjectsStore } from '../../store/projectsStore'
import { buildShareUrl } from '../../utils/exportShareLink'
import { exportMapAsPng, exportMapAsPdf } from '../../utils/exportImage'

const IconBtn = ({ icon: Icon, label, onClick, active }) => (
  <motion.button
    whileHover={{ scale: 1.06 }}
    whileTap={{ scale: 0.94 }}
    onClick={onClick}
    title={label}
    className={`flex shrink-0 items-center justify-center rounded-md p-1 transition-colors ${
      active ? 'bg-[#f5cb5c]' : 'hover:bg-[#cfdbd5]'
    }`}
  >
    <Icon size={13} color="#242423" />
  </motion.button>
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
  const relationshipMode = useUiStore((s) => s.relationshipMode)
  const toggleRelationshipMode = useUiStore((s) => s.toggleRelationshipMode)
  const searchOpen = useUiStore((s) => s.searchOpen)
  const toggleSearch = useUiStore((s) => s.toggleSearch)
  const showMockCursors = useUiStore((s) => s.showMockCursors)
  const toggleMockCursors = useUiStore((s) => s.toggleMockCursors)
  const connectorPanelOpen = useUiStore((s) => s.connectorPanelOpen)
  const toggleConnectorPanel = useUiStore((s) => s.toggleConnectorPanel)
  const toggleAuthModal = useUiStore((s) => s.toggleAuthModal)
  const authUser = useAuthStore((s) => s.user)
  const showToast = useUiStore((s) => s.showToast)
  const nodes = useMapStore((s) => s.nodes)
  const edges = useMapStore((s) => s.edges)
  const loadConnectorDemo = useMapStore((s) => s.loadConnectorDemo)
  const openProjectsDashboard = useProjectsStore((s) => s.openDashboard)
  const [exporting, setExporting] = useState(false)

  const handleConnectorDemo = () => {
    if (
      window.confirm(
        'Load the connector-styles demo map (18 line styles)? This replaces your current map — your current map stays in undo history (Ctrl+Z).'
      )
    ) {
      loadConnectorDemo()
      showToast('Connector styles demo loaded — Ctrl+Z to go back')
    }
  }

  const handleShare = async () => {
    const url = buildShareUrl(nodes, edges)
    try {
      await navigator.clipboard.writeText(url)
      showToast('Share link copied to clipboard')
    } catch {
      window.prompt('Copy this share link:', url)
    }
  }

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

  return (
    <div
      className="flex h-8 shrink-0 items-center gap-1 border-b px-2"
      style={{ backgroundColor: '#e8eddf', borderColor: '#cfdbd5' }}
    >
      {/* Section 14 — responsive pass: this cluster is the widest part of the
          toolbar (11 icons). On narrow/mobile viewports it scrolls
          horizontally instead of wrapping or clipping, so the undo/redo/
          focus/presentation cluster on the right stays reachable. */}
      <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        <span className="hidden shrink-0 text-xs font-semibold sm:inline" style={{ color: '#242423' }}>
          🧠 MindMap
        </span>
        <div className="mx-0.5 hidden h-4 w-px shrink-0 sm:block" style={{ backgroundColor: '#cfdbd5' }} />
        <IconBtn icon={LayoutDashboard} label="My mind maps (new / open projects)" onClick={openProjectsDashboard} />
        <IconBtn icon={Target} label="Add central topic" onClick={addCentralTopic} />
        <IconBtn icon={StickyNote} label="Add floating note" onClick={addFloatingNode} />
        <IconBtn
          icon={Link2}
          label="Relationship mode — drag between nodes to link across branches"
          active={relationshipMode}
          onClick={toggleRelationshipMode}
        />
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
        <IconBtn icon={Share2} label="Copy share link" onClick={handleShare} />
        <IconBtn icon={Download} label="Export as PNG image" onClick={handleExportPng} />
        <IconBtn icon={FileDown} label="Export as PDF" onClick={handleExportPdf} />
        <IconBtn icon={Spline} label="Connector styles demo (18 line styles)" onClick={handleConnectorDemo} />
        <IconBtn
          icon={GitBranch}
          label="Connector Styles panel — select a line, pick a style"
          active={connectorPanelOpen}
          onClick={toggleConnectorPanel}
        />
        <IconBtn icon={Users} label="Simulate collaborators (local demo only)" active={showMockCursors} onClick={toggleMockCursors} />
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <IconBtn icon={Search} label="Search & replace" active={searchOpen} onClick={toggleSearch} />
        <IconBtn icon={Undo2} label="Undo (Ctrl+Z)" onClick={undo} />
        <IconBtn icon={Redo2} label="Redo (Ctrl+Y)" onClick={redo} />
        <div className="mx-0.5 hidden h-4 w-px sm:block" style={{ backgroundColor: '#cfdbd5' }} />
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
