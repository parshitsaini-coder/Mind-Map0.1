import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Camera, ClipboardPaste, Loader2 } from 'lucide-react'
import { uploadTradeImage } from '../../lib/imageUpload'
import { useUiStore } from '../../store/uiStore'

// Image cell for the Strategy Tester grid. Three ways in, on top of the
// original click-to-browse: drag a file straight onto the cell, or
// right-click for a small "Paste image" menu that reads whatever's on
// the system clipboard (a screenshot copied with Win+Shift+S / Cmd+Shift+4,
// or a copied image) — no need to save it to disk first.
export default function ImageCell({ value, onChange }) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [menu, setMenu] = useState(null) // { x, y } | null
  const fileRef = useRef(null)
  const dragDepth = useRef(0)

  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setMenu(null)
    }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [menu])

  const doUpload = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const { url } = await uploadTradeImage(file)
      onChange(url)
    } catch (err) {
      useUiStore.getState().showToast(err.message || 'Could not upload image')
    } finally {
      setUploading(false)
    }
  }

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    await doUpload(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }
  const handleDragEnter = (e) => {
    e.preventDefault()
    dragDepth.current += 1
    setDragOver(true)
  }
  const handleDragLeave = (e) => {
    e.preventDefault()
    dragDepth.current -= 1
    if (dragDepth.current <= 0) {
      dragDepth.current = 0
      setDragOver(false)
    }
  }
  const handleDrop = async (e) => {
    e.preventDefault()
    dragDepth.current = 0
    setDragOver(false)
    const file = Array.from(e.dataTransfer.files || []).find((f) => f.type.startsWith('image/'))
    if (file) await doUpload(file)
    else useUiStore.getState().showToast('Drop an image file here')
  }

  const handlePasteFromClipboard = async () => {
    setMenu(null)
    try {
      if (!navigator.clipboard?.read) {
        useUiStore.getState().showToast('Clipboard paste isn\u2019t supported in this browser')
        return
      }
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'))
        if (type) {
          const blob = await item.getType(type)
          await doUpload(new File([blob], 'pasted-image.png', { type }))
          return
        }
      }
      useUiStore.getState().showToast('No image found on the clipboard')
    } catch {
      useUiStore.getState().showToast('Could not read clipboard \u2014 allow paste permission and try again')
    }
  }

  return (
    <div
      className="relative flex h-full w-full items-center justify-center py-0.5"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

      {uploading ? (
        <Loader2 size={11} className="animate-spin" style={{ color: 'var(--ta-accent)' }} />
      ) : value ? (
        <motion.button
          key={value}
          type="button"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={dragOver ? { opacity: 1, scale: 1.1 } : { opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.18, zIndex: 3 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: 'spring', stiffness: 460, damping: 24 }}
          onClick={() => useUiStore.getState().openImageLightbox(value, () => onChange(null))}
          className="h-5 w-7 shrink-0 overflow-hidden rounded-[3px] border"
          style={{
            borderColor: dragOver ? 'var(--ta-accent)' : 'var(--tad-border)',
            boxShadow: dragOver ? '0 0 0 2px color-mix(in srgb, var(--ta-accent) 35%, transparent)' : 'none',
          }}
          title="View image \u2014 drop a file or right-click to replace it"
        >
          <img src={value} alt="" className="h-full w-full object-cover" />
        </motion.button>
      ) : (
        <motion.button
          type="button"
          animate={dragOver ? { scale: 1.14 } : { scale: 1 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 500, damping: 26 }}
          onClick={() => fileRef.current?.click()}
          title="Click to browse, drop an image, or right-click to paste"
          className="flex h-5 w-7 items-center justify-center rounded-[3px] border border-dashed transition-colors hover:bg-black/5"
          style={{
            borderColor: dragOver ? 'var(--ta-accent)' : 'var(--tad-border)',
            backgroundColor: dragOver ? 'color-mix(in srgb, var(--ta-accent) 14%, transparent)' : 'transparent',
          }}
        >
          <Camera size={10} style={{ color: dragOver ? 'var(--ta-accent)' : 'var(--ta-slate)', opacity: dragOver ? 1 : 0.6 }} />
        </motion.button>
      )}

      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -4 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            onMouseDown={(e) => e.stopPropagation()}
            className="ta-glass-popover fixed z-[220] flex flex-col gap-0.5 rounded-lg border p-1 shadow-xl"
            style={{
              left: menu.x,
              top: menu.y,
              backgroundColor: 'var(--ta-surface)',
              borderColor: 'var(--ta-slate)',
              transformOrigin: 'top left',
            }}
          >
            <motion.button
              type="button"
              whileHover={{ x: 2, backgroundColor: 'rgba(0,0,0,0.05)' }}
              whileTap={{ scale: 0.97 }}
              onClick={handlePasteFromClipboard}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1 text-left text-[10px] font-medium"
              style={{ color: 'var(--ta-ink)' }}
            >
              <ClipboardPaste size={11} style={{ color: 'var(--ta-accent)' }} />
              Paste image
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
