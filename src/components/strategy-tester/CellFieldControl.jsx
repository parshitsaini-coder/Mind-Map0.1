import { motion, AnimatePresence } from 'framer-motion'
import { SquareCheck, Square, ArrowUp, ArrowDown, Image as ImageIcon, StickyNote, Hash, Crosshair, Percent, Scale, Wallet, Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { RRR_OPTIONS, isFieldFilled } from '../../utils/strategyTesterFields'
import { useUiStore } from '../../store/uiStore'
import { uploadTradeImage } from '../../lib/imageUpload'

const GREEN = '#16a34a'
const RED = '#dc2626'

// One field's mini control inside a single (row x strategy) cell. Kept
// intentionally tiny — text-[9px]/icon-11px — so a row with several active
// fields, times several strategy columns, still fits without the grid
// blowing up. Anything needing more than a couple of characters opens a
// small anchored popover instead of growing the cell.
export default function CellFieldControl({ field, value, onChange, onOpenNotes }) {
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef(null)
  const filled = isFieldFilled(field.kind, value)
  const wrapRef = useRef(null)

  const closePopover = () => setOpen(false)

  if (field.kind === 'checkbox') {
    return (
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={() => onChange(!value)}
        title="Checklist"
        className="flex h-4 w-4 items-center justify-center"
      >
        {value ? <SquareCheck size={13} color={GREEN} /> : <Square size={13} color="var(--color-slate)" />}
      </motion.button>
    )
  }

  if (field.kind === 'side') {
    const next = value === 'buy' ? 'sell' : value === 'sell' ? null : 'buy'
    return (
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => onChange(next)}
        title="Buy / Sell — click to cycle"
        className="flex h-4 min-w-[1.1rem] items-center justify-center rounded px-0.5 text-[8px] font-bold"
        style={{
          backgroundColor: value === 'buy' ? 'rgba(22,163,74,0.16)' : value === 'sell' ? 'rgba(220,38,38,0.16)' : 'var(--color-sage)',
          color: value === 'buy' ? GREEN : value === 'sell' ? RED : 'var(--color-slate)',
        }}
      >
        {value === 'buy' ? <ArrowUp size={10} /> : value === 'sell' ? <ArrowDown size={10} /> : '—'}
      </motion.button>
    )
  }

  if (field.kind === 'notes') {
    return (
      <motion.button
        whileTap={{ scale: 0.88 }}
        onClick={onOpenNotes}
        title={filled ? value : 'Add note'}
        className="flex h-4 w-4 items-center justify-center rounded"
        style={{ backgroundColor: filled ? 'var(--color-accent)' : 'transparent' }}
      >
        <StickyNote size={11} color="var(--color-ink)" />
      </motion.button>
    )
  }

  if (field.kind === 'image') {
    return (
      <div ref={wrapRef} className="relative">
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={() => (filled ? useUiStore.getState().openImageLightbox(value, () => onChange(null)) : setOpen((o) => !o))}
          title={filled ? 'View image' : 'Add image'}
          className="flex h-4 w-4 items-center justify-center overflow-hidden rounded"
          style={{ backgroundColor: filled ? 'transparent' : 'var(--color-sage)' }}
        >
          {uploading ? (
            <Loader2 size={10} className="animate-spin" color="var(--color-slate)" />
          ) : filled ? (
            <img src={value} alt="" className="h-4 w-4 object-cover" />
          ) : (
            <ImageIcon size={10} color="var(--color-slate)" />
          )}
        </motion.button>
        <AnimatePresence>
          {open && (
            <>
              <div className="fixed inset-0 z-[70]" onClick={closePopover} />
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 top-full z-[71] mt-1 w-28 rounded-md border p-1.5 shadow-lg"
                style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-slate)' }}
              >
                <button
                  onClick={async () => {
                    fileInputRef.current?.click()
                  }}
                  className="w-full rounded px-1.5 py-1 text-left text-[9px] hover:bg-black/5"
                  style={{ color: 'var(--color-ink)' }}
                >
                  Upload image
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) return
                    setOpen(false)
                    setUploading(true)
                    try {
                      const { url } = await uploadTradeImage(file)
                      onChange(url)
                    } catch (err) {
                      useUiStore.getState().showToast(err.message || 'Image upload failed')
                    } finally {
                      setUploading(false)
                    }
                  }}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    )
  }

  if (field.kind === 'rrr') {
    return (
      <div ref={wrapRef} className="relative">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setOpen((o) => !o)}
          title="RRR"
          className="flex h-4 items-center justify-center rounded px-1 text-[8px] font-semibold"
          style={{ backgroundColor: filled ? 'var(--color-accent)' : 'var(--color-sage)', color: 'var(--color-ink)' }}
        >
          {filled ? value : <Scale size={10} />}
        </motion.button>
        <AnimatePresence>
          {open && (
            <>
              <div className="fixed inset-0 z-[70]" onClick={closePopover} />
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 top-full z-[71] mt-1 grid w-24 grid-cols-2 gap-0.5 rounded-md border p-1 shadow-lg"
                style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-slate)' }}
              >
                {RRR_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => {
                      onChange(opt)
                      setOpen(false)
                    }}
                    className="rounded px-1 py-0.5 text-[9px] font-medium hover:bg-black/5"
                    style={{
                      backgroundColor: value === opt ? 'var(--color-accent)' : 'transparent',
                      color: 'var(--color-ink)',
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    )
  }

  if (field.kind === 'slTarget') {
    const sl = value?.sl ?? ''
    const target = value?.target ?? ''
    return (
      <div ref={wrapRef} className="relative">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={() => setOpen((o) => !o)}
          title="SL / Target"
          className="flex h-4 items-center justify-center rounded px-1 text-[8px] font-semibold"
          style={{ backgroundColor: filled ? 'var(--color-accent)' : 'var(--color-sage)', color: 'var(--color-ink)' }}
        >
          {filled ? `${sl || '-'}/${target || '-'}` : <Crosshair size={10} />}
        </motion.button>
        <AnimatePresence>
          {open && (
            <>
              <div className="fixed inset-0 z-[70]" onClick={closePopover} />
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 top-full z-[71] mt-1 flex w-32 flex-col gap-1 rounded-md border p-1.5 shadow-lg"
                style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-slate)' }}
              >
                <label className="text-[8px] font-medium" style={{ color: 'var(--color-slate)' }}>
                  SL
                  <input
                    type="number"
                    autoFocus
                    value={sl}
                    onChange={(e) => onChange({ sl: e.target.value, target })}
                    className="mt-0.5 w-full rounded border bg-white/70 px-1 py-0.5 text-[10px] outline-none"
                    style={{ borderColor: 'var(--color-sage)', color: 'var(--color-ink)' }}
                  />
                </label>
                <label className="text-[8px] font-medium" style={{ color: 'var(--color-slate)' }}>
                  Target
                  <input
                    type="number"
                    value={target}
                    onChange={(e) => onChange({ sl, target: e.target.value })}
                    className="mt-0.5 w-full rounded border bg-white/70 px-1 py-0.5 text-[10px] outline-none"
                    style={{ borderColor: 'var(--color-sage)', color: 'var(--color-ink)' }}
                  />
                </label>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    )
  }

  // number | winrate | pnl — same "badge that opens a single numeric input" shape.
  const icon = field.kind === 'winrate' ? Percent : field.kind === 'pnl' ? Wallet : Hash
  const Icon = icon
  const pnlColor = field.kind === 'pnl' && filled ? (Number(value) >= 0 ? GREEN : RED) : 'var(--color-ink)'
  return (
    <div ref={wrapRef} className="relative">
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => setOpen((o) => !o)}
        title={field.label}
        className="flex h-4 items-center justify-center rounded px-1 text-[8px] font-semibold"
        style={{ backgroundColor: filled ? 'var(--color-accent)' : 'var(--color-sage)', color: filled ? pnlColor : 'var(--color-ink)' }}
      >
        {filled ? `${value}${field.kind === 'winrate' ? '%' : ''}` : <Icon size={10} />}
      </motion.button>
      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-[70]" onClick={closePopover} />
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="absolute left-0 top-full z-[71] mt-1 w-24 rounded-md border p-1.5 shadow-lg"
              style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-slate)' }}
            >
              <input
                type="number"
                autoFocus
                value={value ?? ''}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setOpen(false)}
                placeholder={field.kind === 'winrate' ? '0-100' : '0'}
                className="w-full rounded border bg-white/70 px-1 py-0.5 text-[10px] outline-none"
                style={{ borderColor: 'var(--color-sage)', color: 'var(--color-ink)' }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
