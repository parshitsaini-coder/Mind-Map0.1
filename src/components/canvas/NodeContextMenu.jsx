import { motion } from 'framer-motion'
import { Plus, CornerDownRight, Copy, Files, ClipboardPaste, Trash2, ChevronsUpDown, Scissors, TrendingUp, ListChecks, Lock, LockOpen, EyeOff } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { useUiStore } from '../../store/uiStore'

export default function NodeContextMenu({ id, x, y, onClose }) {
  const node = useMapStore((s) => s.nodes.find((n) => n.id === id))
  const hasChildren = useMapStore(
    (s) => s.edges.some((e) => e.source === id && e.type !== 'crossEdge')
  )
  // Multi-map support means several root ("central topic") nodes can exist
  // side by side — those should be deletable like any other node. The only
  // thing worth protecting is ending up with zero central topics, so a
  // root node's delete option is disabled only when it's the sole root left.
  const rootCount = useMapStore((s) => s.nodes.filter((n) => n.data?.isRoot).length)
  const addChildNode = useMapStore((s) => s.addChildNode)
  const addSiblingNode = useMapStore((s) => s.addSiblingNode)
  const duplicateNode = useMapStore((s) => s.duplicateNode)
  const copyNode = useMapStore((s) => s.copyNode)
  const pasteNodeOnto = useMapStore((s) => s.pasteNodeOnto)
  const hasClipboard = useMapStore((s) => Boolean(s.nodeClipboard))
  const copyConnectedGroup = useMapStore((s) => s.copyConnectedGroup)
  const pasteConnectedGroupOnto = useMapStore((s) => s.pasteConnectedGroupOnto)
  const hasGroupClipboard = useMapStore((s) => Boolean(s.nodeGroupClipboard))
  const deleteNode = useMapStore((s) => s.deleteNodeAnimated)
  const deleteChildren = useMapStore((s) => s.deleteChildren)
  const toggleCollapse = useMapStore((s) => s.toggleCollapse)
  const toggleNodeLock = useMapStore((s) => s.toggleNodeLock)
  const toggleHidden = useMapStore((s) => s.toggleHidden)
  const updateNodeData = useMapStore((s) => s.updateNodeData)

  if (!node) return null

  const run = (fn) => {
    fn()
    onClose()
  }

  const isLastRoot = node.data?.isRoot && rootCount <= 1
  const hasLinkedTrade = Boolean(node.data?.linkedTradeId)
  const isLocked = Boolean(node.data?.locked)

  // Top quick-action row — the 3 most frequently used actions, shown as
  // icon-only buttons with a hover tooltip (label appears below the icon
  // on hover), Notion/Figma-style. Delete here mirrors the same
  // disabled/danger logic as the full "Delete node" entry further down.
  const quickActions = [
    { icon: Plus, label: 'Add child', onClick: () => run(() => addChildNode(id)) },
    { icon: Copy, label: 'Duplicate', onClick: () => run(() => duplicateNode(id)) },
    {
      icon: Trash2,
      label: isLastRoot ? 'Only central topic' : isLocked ? 'Locked' : 'Delete',
      danger: true,
      disabled: isLastRoot || isLocked,
      onClick: () => {
        if (isLastRoot || isLocked) return
        run(() => deleteNode(id))
      },
    },
    {
      icon: isLocked ? LockOpen : Lock,
      label: isLocked ? 'Unlock node' : 'Lock node',
      onClick: () => run(() => toggleNodeLock(id)),
    },
    {
      icon: EyeOff,
      label: 'Hide node',
      onClick: () => run(() => toggleHidden(id)),
    },
    {
      icon: ListChecks,
      label: 'Checklist',
      onClick: () => run(() => useUiStore.getState().openChecklistPanel(id)),
    },
  ]

  const items = [
    { icon: CornerDownRight, label: 'Add sibling node', color: '#3b82f6', onClick: () => run(() => addSiblingNode(id)) },
    // Section — Copy/Paste. "Copy" snapshots this node's full look (text,
    // size, colors, shape, motion) plus its incoming connector's style;
    // "Paste" (shown on ANY node once something's been copied) creates a
    // new node with that same look as a child of whichever node you
    // right-clicked, connected with a matching connector style too.
    { icon: Copy, label: 'Copy', color: '#8b5cf6', onClick: () => run(() => copyNode(id)) },
    ...(hasClipboard
      ? [{ icon: ClipboardPaste, label: 'Paste here', color: '#8b5cf6', onClick: () => run(() => pasteNodeOnto(id)) }]
      : []),
    // Section — "Copy all". Copies every node connected to this one
    // through any chain of connectors (parents, children, cross-linked
    // calc nodes — a whole self-contained cluster like a TP/SL row) with
    // full details, so it can be pasted as one unit elsewhere via
    // "Paste all here" on any node.
    { icon: Files, label: 'Copy all (connected)', color: '#6366f1', onClick: () => run(() => copyConnectedGroup(id)) },
    ...(hasGroupClipboard
      ? [{ icon: ClipboardPaste, label: 'Paste all here', color: '#6366f1', onClick: () => run(() => pasteConnectedGroupOnto(id)) }]
      : []),
    // Section — Link a Trade. Opens the trade-picker popup (see
    // TradeLinkPickerModal) scoped to this node; once a trade is picked,
    // the node shows its pair/stock as a small badge (CustomNode.jsx) and
    // clicking that badge reopens the full read-only trade detail popup
    // (TradeDetailModal). A node already linked to a trade also gets a
    // quick "Unlink trade" entry so this menu can undo it without needing
    // the inspector.
    {
      icon: TrendingUp,
      label: hasLinkedTrade ? 'Change linked trade' : 'Add trade',
      color: '#10b981',
      onClick: () => run(() => useUiStore.getState().openTradeLinkPicker(id)),
    },
    ...(hasLinkedTrade
      ? [
          {
            icon: TrendingUp,
            label: 'Unlink trade',
            color: '#10b981',
            onClick: () => run(() => updateNodeData(id, { linkedTradeId: null })),
          },
        ]
      : []),
    {
      icon: ChevronsUpDown,
      label: node.data?.collapsed ? 'Expand branch' : 'Collapse branch',
      color: '#64748b',
      onClick: () => run(() => toggleCollapse(id)),
    },
  ]
  if (hasChildren) {
    items.push({
      icon: Scissors,
      label: 'Delete children',
      color: '#c1443c',
      danger: true,
      onClick: () => run(() => deleteChildren(id)),
    })
  }
  return (
    <>
      {/* Full-viewport transparent layer so a click/right-click anywhere
          else on the page closes the menu, like a native context menu. */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => {
          e.preventDefault()
          onClose()
        }}
      />
      <motion.div
        className="fixed z-50 w-40 overflow-hidden rounded-xl border shadow-xl"
        style={{ top: y, left: x, backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
        initial={{ opacity: 0, scale: 0.92, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 700, damping: 32, mass: 0.4 }}
      >
        {/* Quick-action row — icon-only, label shows on hover as a tooltip */}
        <div
          className="flex items-center justify-around border-b py-1.5"
          style={{ borderColor: 'var(--color-sage)' }}
        >
          {quickActions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              disabled={action.disabled}
              title={action.label}
              className={`group relative flex items-center justify-center rounded-lg p-1 transition-transform duration-100 hover:scale-110 active:scale-90 ${
                action.disabled ? 'cursor-not-allowed opacity-40' : ''
              } ${action.danger ? 'text-[#c1443c]' : 'text-[var(--color-ink)]'}`}
              style={{ '--tw-bg-opacity': 1 }}
              onMouseEnter={(e) => {
                if (!action.disabled) e.currentTarget.style.backgroundColor = action.danger ? 'rgba(193,68,60,0.12)' : 'var(--color-sage)'
              }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '' }}
            >
              <action.icon size={14} />
              {/* Tooltip label, shown below the icon on hover */}
              <span
                className="pointer-events-none absolute top-full left-1/2 z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] opacity-0 shadow transition-opacity duration-100 group-hover:opacity-100"
                style={{ backgroundColor: 'var(--color-ink)', color: 'var(--color-cream)' }}
              >
                {action.label}
              </span>
            </button>
          ))}
        </div>

        <div className="py-1">
        {items.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className="flex w-full items-center gap-2 px-2 py-1 text-left text-[11px] transition-colors duration-75 hover:translate-x-0.5"
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--color-sage)' }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '' }}
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
              style={{ backgroundColor: `${item.color}1f`, color: item.color }}
            >
              <item.icon size={11} />
            </span>
            <span className={item.danger ? 'text-[#c1443c]' : 'text-[var(--color-ink)]'}>
              {item.label}
            </span>
          </button>
        ))}
        </div>
      </motion.div>
    </>
  )
}
