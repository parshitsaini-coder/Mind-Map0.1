import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { MousePointer2 } from 'lucide-react'

const MOCK_USERS = [
  { name: 'Aisha', color: '#e07856' },
  { name: 'Marco', color: '#4fb0a5' },
  { name: 'Priya', color: '#8a7fd1' },
]

function randomPoint() {
  return { x: 40 + Math.random() * 70 + '%', y: 40 + Math.random() * 50 + '%' }
}

export default function MockCursors() {
  const [targets, setTargets] = useState(() => MOCK_USERS.map(randomPoint))

  useEffect(() => {
    const interval = setInterval(() => setTargets(MOCK_USERS.map(randomPoint)), 2800)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
      {MOCK_USERS.map((user, i) => (
        <motion.div
          key={user.name}
          className="absolute flex items-center gap-1"
          animate={{ left: targets[i].x, top: targets[i].y }}
          transition={{ duration: 2.4, ease: 'easeInOut' }}
        >
          <MousePointer2 size={14} fill={user.color} color={user.color} />
          <span
            className="rounded px-1 py-0.5 text-[9px] font-medium text-white shadow"
            style={{ backgroundColor: user.color }}
          >
            {user.name}
          </span>
        </motion.div>
      ))}
    </div>
  )
}
