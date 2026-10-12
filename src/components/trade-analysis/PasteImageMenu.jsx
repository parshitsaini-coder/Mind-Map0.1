import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { ClipboardPaste } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'

// Reads the first image found on the system clipboard and returns it as a
// File (or null). Needs a secure context (https / localhost) and the
// browser's clipboard-read permission, which Chrome/Edge prompt for once.
export async function readClipboardImage() {
  if (!navigator.clipboard?.read) {
    useUiStore.getState().showToast('Is browser me right-click paste supported nahi hai — Ctrl+V use karo.')
    return null
  }
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith('image/'))
      if (type) {
        const blob = await item.getType(type)
        const ext = type.split('/')[1] || 'png'
        return new File([blob], `pasted-${Date.now()}.${ext}`, { type })
      }
    }
    useUiStore.getState().showToast('Clipboard me image nahi mili — pehle image copy karo.')
  } catch {
    useUiStore.getState().showToast('Clipboard access allow karo (address bar ke permission popup me), ya Ctrl+V use karo.')
  }
  return null
}

// Small right-click popup with a single "Paste image" action, anchored at
// the cursor. `pos` = { x, y } (clientX/clientY) or null when closed.
export default function PasteImageMenu({ pos, onClose, onFile }) {
  const ref = useRef(null)
  const [adj, setAdj] = useState(pos)

  useLayoutEffect(() => {
    if (!pos) return
    const w = 150
    const h = 40
    setAdj({
      x: Math.min(pos.x, window.innerWidth - w - 8),
      y: Math.min(pos.y, window.innerHeight - h - 8),
    })
  }, [pos])

  useEffect(() => {
    if (!pos) return
    const close = (e) => {
      if (e.type === 'keydown' && e.key !== 'Escape') return
      if (e.type === 'mousedown' && ref.current?.contains(e.target)) return
      onClose()
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', close)
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', close)
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [pos, onClose])

  if (!pos || !adj) return null

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.12 }}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[9999] rounded-lg border p-1 shadow-xl"
      style={{ left: adj.x, top: adj.y, background: 'var(--ta-card, #fffcf2)', borderColor: 'var(--ta-slate)' }}
    >
      <button
        type="button"
        onClick={async () => {
          onClose()
          const file = await readClipboardImage()
          if (file) onFile(file)
        }}
        className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[11px] font-semibold hover:bg-black/10"
        style={{ color: 'var(--ta-ink, inherit)' }}
      >
        <ClipboardPaste size={13} /> Paste image
      </button>
    </motion.div>,
    document.body
  )
}
