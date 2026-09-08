import { Plus, CornerDownRight, Copy, Trash2, ChevronsUpDown } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'

export default function NodeContextMenu({ id, x, y, onClose }) {
  const node = useMapStore((s) => s.nodes.find((n) => n.id === id))
  const addChildNode = useMapStore((s) => s.addChildNode)
  const addSiblingNode = useMapStore((s) => s.addSiblingNode)
  const duplicateNode = useMapStore((s) => s.duplicateNode)
  const deleteNode = useMapStore((s) => s.deleteNode)
  const toggleCollapse = useMapStore((s) => s.toggleCollapse)

  if (!node) return null

  const run = (fn) => {
    fn()
    onClose()
  }

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
  if (!node.data?.isRoot) {
    items.push({ icon: Trash2, label: 'Delete node', danger: true, onClick: () => run(() => deleteNode(id)) })
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
      <div
        className="fixed z-50 w-44 overflow-hidden rounded-md border py-1 shadow-lg"
        style={{ top: y, left: x, backgroundColor: '#e8eddf', borderColor: '#cfdbd5' }}
      >
        {items.map((item) => (
          <button
            key={item.label}
            onClick={item.onClick}
            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[#cfdbd5]/60 ${
              item.danger ? 'text-[#c1443c]' : 'text-[#242423]'
            }`}
          >
            <item.icon size={13} />
            {item.label}
          </button>
        ))}
      </div>
    </>
  )
}
