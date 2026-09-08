import { Plus, CornerDownRight, Copy, Trash2, ChevronsUpDown, Scissors } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'

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
  const deleteNode = useMapStore((s) => s.deleteNode)
  const deleteChildren = useMapStore((s) => s.deleteChildren)
  const toggleCollapse = useMapStore((s) => s.toggleCollapse)

  if (!node) return null

  const run = (fn) => {
    fn()
    onClose()
  }

  const isLastRoot = node.data?.isRoot && rootCount <= 1

  const items = [
    { icon: Plus, label: 'Add child node', onClick: () => run(() => addChildNode(id)) },
    { icon: CornerDownRight, label: 'Add sibling node', onClick: () => run(() => addSiblingNode(id)) },
    { icon: Copy, label: 'Duplicate', onClick: () => run(() => duplicateNode(id)) },
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
    label: isLastRoot ? 'Delete node (only central topic)' : 'Delete node',
    danger: true,
    disabled: isLastRoot,
    onClick: () => {
      if (isLastRoot) return
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
        style={{ top: y, left: x, backgroundColor: '#e8eddf', borderColor: '#cfdbd5' }}
      >
        {items.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            disabled={item.disabled}
            title={item.disabled ? 'Add another central topic before deleting this one' : undefined}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${
              item.disabled
                ? 'cursor-not-allowed opacity-40'
                : 'hover:bg-[#cfdbd5]/60'
            } ${item.danger ? 'text-[#c1443c]' : 'text-[#242423]'}`}
          >
            <item.icon size={13} />
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}
