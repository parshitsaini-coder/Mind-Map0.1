import { memo, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useMapStore } from '../../store/mapStore'

// Section 14 — perf pass: memoized like CustomNode.
function BoundaryGroup({ id, data, selected }) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(data.label)
  const renameGroup = useMapStore((s) => s.renameGroup)

  const commit = useCallback(() => {
    setEditing(false)
    renameGroup(id, label)
  }, [id, label, renameGroup])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className={`pointer-events-none relative border-2 border-dashed ${
        data.shape === 'circle' ? 'rounded-[50%]' : 'rounded-2xl'
      }`}
      style={{
        width: data.width,
        height: data.height,
        borderColor: selected ? 'var(--color-accent)' : `${data.color}88`,
        backgroundColor: 'rgba(207, 219, 213, 0.15)',
      }}
    >
      <div
        onDoubleClick={() => setEditing(true)}
        className="pointer-events-auto absolute -top-6 left-1 rounded-t-md px-1.5 py-0.5 text-[10px] font-medium"
        style={{ color: 'var(--color-slate)' }}
      >
        {editing ? (
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => e.key === 'Enter' && commit()}
            className="w-24 bg-transparent outline-none"
          />
        ) : (
          <span>{data.label}</span>
        )}
      </div>
    </motion.div>
  )
}

export default memo(BoundaryGroup)
