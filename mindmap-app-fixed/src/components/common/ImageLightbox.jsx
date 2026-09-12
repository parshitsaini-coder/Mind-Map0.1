import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'

// Fullscreen viewer for a node's image — opened by clicking the small image
// thumbnail on a node in CustomNode.jsx. Click the backdrop, hit Escape, or
// use the close button to dismiss; clicking the image itself does nothing
// (so a stray click there doesn't close it).
export default function ImageLightbox() {
  const url = useUiStore((s) => s.imageLightboxUrl)
  const close = useUiStore((s) => s.closeImageLightbox)

  useEffect(() => {
    if (!url) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [url, close])

  return (
    <AnimatePresence>
      {url && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 p-6"
        >
          <button
            onClick={close}
            className="fixed right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Close"
          >
            <X size={20} />
          </button>
          <motion.img
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            src={url}
            alt=""
            onClick={(e) => e.stopPropagation()}
            className="max-h-full max-w-full rounded-md object-contain shadow-2xl"
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
