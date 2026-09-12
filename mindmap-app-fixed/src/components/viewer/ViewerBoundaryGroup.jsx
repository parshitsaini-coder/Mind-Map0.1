import { memo } from 'react'
import { motion } from 'framer-motion'

// Read-only counterpart to canvas/BoundaryGroup.jsx — same look, no rename.
function ViewerBoundaryGroup({ data }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26 }}
      className={`pointer-events-none relative border-2 border-dashed ${
        data.shape === 'circle' ? 'rounded-[50%]' : 'rounded-2xl'
      }`}
      style={{
        width: data.width,
        height: data.height,
        borderColor: `${data.color}88`,
        backgroundColor: 'rgba(207, 219, 213, 0.15)',
      }}
    >
      <div
        className="pointer-events-none absolute -top-6 left-1 rounded-t-md px-1.5 py-0.5 text-[10px] font-medium"
        style={{ color: 'var(--color-slate)' }}
      >
        <span>{data.label}</span>
      </div>
    </motion.div>
  )
}

export default memo(ViewerBoundaryGroup)
