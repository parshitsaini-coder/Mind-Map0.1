import { Plus, CornerDownRight, Copy, Trash2, ChevronsUpDown, Scissors, TrendingUp, ListChecks, Lock, LockOpen } from 'lucide-react'
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
  const deleteNode = useMapStore((s) => s.deleteNodeAnimated)
  const deleteChildren = useMapStore((s) => s.deleteChildren)
  const toggleCollapse = useMapStore((s) => s.toggleCollapse)
  const toggleNodeLock = useMapStore((s) => s.toggleNodeLock)
  const updateNodeData = useMapStore((s) => s.updateNodeData)

  if (!node) return null

  const run = (fn) => {
    fn()
    onClose()
  }

  const isLastRoot = node.data?.isRoot && rootCount <= 1
  const hasLinkedTrade = Boolean(node.data?.linkedTradeId)
  const isLocked = Boolean(node.data?.locked)

  const items = [
    { icon: Plus, label: 'Add child node', onClick: () => run(() => addChildNode(id)) },
    { icon: CornerDownRight, label: 'Add sibling node', onClick: () => run(() => addSiblingNode(id)) },
    { icon: Copy, label: 'Duplicate', onClick: () => run(() => duplicateNode(id)) },
    {
      icon: isLocked ? LockOpen : Lock,
      label: isLocked ? 'Unlock node' : 'Lock node',
      onClick: () => run(() => toggleNodeLock(id)),
    },
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
      onClick: () => run(() => useUiStore.getState().openTradeLinkPicker(id)),
    },
    ...(hasLinkedTrade
      ? [
          {
            icon: TrendingUp,
            label: 'Unlink trade',
            onClick: () => run(() => updateNodeData(id, { linkedTradeId: null })),
          },
        ]
      : []),
    // Section — Checklist Library. Opens the left-side ChecklistPanel
    // scoped to this node, where any saved checklist can be applied (and
    // new ones created) — see ChecklistPanel.jsx / checklistStore.js.
    {
      icon: ListChecks,
      label: 'Checklist',
      onClick: () => run(() => useUiStore.getState().openChecklistPanel(id)),
    },
    {
      icon: ChevronsUpDown,
      label: node.data?.collapsed ? 'Expand branch' : 'Collapse branch',
      onClick: () => run(() => toggleCollapse(id)),
    },
  ]
  if (hasChildren) {
    items.push({
      icon: Scissors,
      label: 'Delete children',
      danger: true,
      onClick: () => run(() => deleteChildren(id)),
    })
  }
  items.push({
    icon: Trash2,
    label: isLastRoot ? 'Delete node (only central topic)' : isLocked ? 'Delete node (locked)' : 'Delete node',
    danger: true,
    disabled: isLastRoot || isLocked,
    onClick: () => {
      if (isLastRoot || isLocked) return
      run(() => deleteNode(id))
    },
  })

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
      <div
        className="fixed z-50 w-44 overflow-hidden rounded-md border py-1 shadow-lg"
        style={{ top: y, left: x, backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
      >
        {items.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            disabled={item.disabled}
            title={
              item.disabled
                ? isLastRoot
                  ? 'Add another central topic before deleting this one'
                  : 'Unlock this node before deleting it'
                : undefined
            }
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
              item.disabled
                ? 'cursor-not-allowed opacity-40'
                : 'hover:bg-[var(--color-sage)]/60'
            } ${item.danger ? 'text-[#c1443c]' : 'text-[var(--color-ink)]'}`}
          >
            <item.icon size={13} />
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}
