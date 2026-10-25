import { isValidElement, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import {
  Check, ChevronDown, Flame, BarChart3, ListChecks, Pencil, Trash2, ImagePlus, Camera, CheckCheck, Eraser,
  Hash, CalendarDays, ChartCandlestick, Shapes, Timer, ArrowUpDown, CircleDollarSign, Wallet, Image as ImageIcon,
  CircleDot, StickyNote, Trophy, Settings2, Gauge, Target, ReceiptText, BadgeIndianRupee,
} from 'lucide-react'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { useUiStore } from '../../store/uiStore'
import { uploadTradeImage } from '../../lib/imageUpload'
import StatusDropdown from './StatusDropdown'
import TableHeaderIcon from './TableHeaderIcon'
import { TYPE_BADGE_STYLE, TIMEFRAME_BADGE_STYLE, TIMEFRAME_DEFAULT_STYLE } from './TradesTable'
import { symbolForType } from '../../utils/currency'
import { applyFilters } from '../../utils/tradeFilters'

// Deep Analysis view — the same entries table as the Table tab (same
// columns, badges, inline P&L, status, images), with one multi-select
// column per validation CATEGORY added at the far right. Rules are ticked
// straight from the list (a compact multi-select per category), and the same store
// action the Cards view uses keeps `validationRuleIds` / `validationScore`
// in sync, so the Table, Cards, reports and Analysis all see the change.
//
// Perf: with many entries × many rules, a tap must only re-render the one
// category select it touched. CategorySelect is memoized and gets a compact
// "1010…" signature string (a primitive) instead of the ids array.

const CATEGORY_ICONS = { Flame, BarChart3, ListChecks }
const CategoryIcon = ({ name, ...props }) => {
  const Icon = CATEGORY_ICONS[name] || ListChecks
  return <Icon {...props} />
}

const scoreColor = (pct) => (pct >= 80 ? '#16a34a' : pct >= 50 ? '#d97706' : 'var(--ta-accent)')

// ─── One validation category = one compact multi-select ────────────────
// The trigger is a small pill (category name, n/m, the ticked rules as
// tiny chips). Clicking opens a floating checklist where several rules
// can be ticked at once — the menu stays open between picks.
//
// The menu is portalled to the themed overlay and positioned with `fixed`: entry rows
// are transformed (framer layout) so each one is its own stacking
// context, and a normal absolute menu would slide *under* the next row.
const MENU_W = 220

const CategorySelect = memo(function CategorySelect({ tradeId, category, rules, signature, hideLabel = false, compact = false }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  // Menu mounts inside the themed overlay (not <body>) so it inherits the
  // --ta-* colour variables set on it.
  const [host, setHost] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)

  const checkedRules = useMemo(() => rules.filter((_, i) => signature[i] === '1'), [rules, signature])
  const checkedCount = checkedRules.length
  const complete = rules.length > 0 && checkedCount === rules.length
  const disabled = rules.length === 0

  const place = useCallback(() => {
    const el = btnRef.current
    if (!el) return
    setHost(el.closest('[data-ta-theme]') || document.body)
    const r = el.getBoundingClientRect()
    const width = Math.max(MENU_W, r.width)
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8)
    const below = window.innerHeight - r.bottom
    const up = below < 230 && r.top > below
    setPos(up ? { left, width, bottom: window.innerHeight - r.top + 4, maxH: Math.min(300, r.top - 12), up } : { left, width, top: r.bottom + 4, maxH: Math.min(300, below - 12), up })
  }, [])

  useEffect(() => {
    if (!open) return
    place()
    const onDown = (e) => {
      if (btnRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onScroll = (e) => {
      if (menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', place)
    }
  }, [open, place])

  const toggle = (ruleId) => useTradeAnalysisStore.getState().toggleTradeValidationRule(tradeId, ruleId)

  // Select-all / clear for just this category.
  const toggleAll = () => {
    const st = useTradeAnalysisStore.getState()
    const trade = st.trades.find((t) => t.id === tradeId)
    if (!trade) return
    const catIds = new Set(rules.map((r) => r.id))
    const current = trade.validationRuleIds || []
    const next = complete
      ? current.filter((id) => !catIds.has(id))
      : [...current, ...rules.map((r) => r.id).filter((id) => !current.includes(id))]
    st.setTradeValidationRules(tradeId, next)
  }

  return (
    <div className="flex min-w-0 flex-col items-center gap-0.5">
      {!hideLabel && (
        <span className="flex items-center gap-1 px-0.5 text-[8.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
          <CategoryIcon name={category.icon} size={9} style={{ color: 'var(--ta-accent)', flexShrink: 0 }} />
          <span className="truncate">{category.name}</span>
        </span>
      )}

      <motion.button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        whileHover={disabled ? undefined : { y: -1 }}
        whileTap={disabled ? undefined : { scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 500, damping: 26 }}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={checkedRules.length ? checkedRules.map((r) => r.label).join(', ') : disabled ? 'No active rules' : `Select ${category.name}`}
        className={`mx-auto flex h-[22px] w-fit min-w-0 items-center gap-1 rounded-lg border ${compact ? 'px-1' : 'px-1.5'} text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--ta-accent)] disabled:opacity-50`}
        style={{
          borderColor: complete ? '#16a34a' : open ? 'var(--ta-accent)' : 'var(--ta-slate)',
          backgroundColor: 'var(--ta-bg)',
          color: 'var(--ta-ink)',
        }}
      >
        {/* names intentionally not shown in the pill — only the count + chevron; names live in the tooltip and the menu */}
        <span
          className="shrink-0 rounded-full px-1 py-px text-[8px] font-bold"
          style={{ backgroundColor: complete ? '#16a34a' : checkedCount ? 'var(--ta-accent)' : 'color-mix(in srgb, var(--ta-slate) 30%, transparent)', color: checkedCount ? '#fffcf2' : 'var(--ta-ink)' }}
        >
          {checkedCount}/{rules.length}
        </span>
        {!compact && (
          <motion.span animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.12 }} className="flex shrink-0">
            <ChevronDown size={11} style={{ color: 'var(--ta-slate)' }} />
          </motion.span>
        )}
      </motion.button>

      {host && createPortal(
        <AnimatePresence>
          {open && pos && (
            <motion.div
              ref={menuRef}
              data-ta-popover
              initial={{ opacity: 0, y: pos.up ? 4 : -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: pos.up ? 4 : -4, scale: 0.97, transition: { duration: 0.08 } }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className="ta-glass-popover fixed z-[96] flex flex-col rounded-lg border shadow-xl"
              style={{
                left: pos.left,
                width: pos.width,
                top: pos.top,
                bottom: pos.bottom,
                maxHeight: pos.maxH,
                transformOrigin: pos.up ? 'bottom' : 'top',
                backgroundColor: 'var(--ta-surface)',
                borderColor: 'var(--ta-slate)',
                color: 'var(--ta-ink)',
              }}
            >
              <div className="flex shrink-0 items-center justify-between gap-2 border-b px-2 py-1.5" style={{ borderColor: 'var(--ta-slate)' }}>
                <span className="flex min-w-0 items-center gap-1 text-[10px] font-bold uppercase tracking-wide">
                  <CategoryIcon name={category.icon} size={10} style={{ color: 'var(--ta-accent)' }} />
                  <span className="truncate">{category.name}</span>
                </span>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={toggleAll}
                  className="flex shrink-0 items-center gap-1 rounded px-1 py-0.5 text-[9px] font-semibold hover:bg-black/5"
                  style={{ color: 'var(--ta-accent)' }}
                >
                  {complete ? <Eraser size={10} /> : <CheckCheck size={10} />}
                  {complete ? 'Clear' : 'Select all'}
                </button>
              </div>
              <ul className="flex min-h-0 flex-col gap-0.5 overflow-y-auto p-1.5" role="listbox" aria-multiselectable="true">
                {rules.map((rule, i) => {
                  const active = signature[i] === '1'
                  return (
                    <li key={rule.id}>
                      <motion.button
                        type="button"
                        role="option"
                        aria-selected={active}
                        whileHover={{ x: 2, backgroundColor: 'rgba(0,0,0,0.05)' }}
                        whileTap={{ scale: 0.98 }}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => toggle(rule.id)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[10.5px] font-medium"
                        style={{ color: active ? 'var(--ta-accent)' : 'var(--ta-ink)' }}
                      >
                        <span
                          className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[4px] border"
                          style={active ? { backgroundColor: 'var(--ta-accent)', borderColor: 'var(--ta-accent)' } : { borderColor: 'var(--ta-slate)' }}
                        >
                          {active && <Check size={10} color="#fffcf2" strokeWidth={3} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{rule.label}</span>
                        {rule.color && <span className="h-2 w-2 shrink-0 rounded-full border" style={{ backgroundColor: rule.color, borderColor: 'rgba(0,0,0,0.15)' }} />}
                      </motion.button>
                    </li>
                  )
                })}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>,
        host
      )}
    </div>
  )
})

// ─── Table styling (matches TradesTable) ────────────────────────────────
const TH = 'group relative sticky top-0 z-10 whitespace-nowrap px-2 py-1.5 text-left text-[8.5px] font-extrabold uppercase tracking-wide transition-colors'
const TD = 'whitespace-nowrap px-2 py-1 align-middle text-[9px]'
// Column headers are icons (name shows in a tooltip on hover).
const BASE_COLS = [
  { label: 'No.', icon: Hash, hue: '#64748b', anim: 'pop', align: 'start' },
  { label: 'Date', icon: CalendarDays, hue: '#2563eb', anim: 'swing', align: 'start' },
  { label: 'Stock / Forex', icon: ChartCandlestick, hue: '#d97706', anim: 'stretch' },
  { label: 'Type', icon: Shapes, hue: '#7e22ce', anim: 'spin' },
  { label: 'Time frame', icon: Timer, hue: '#0f766e', anim: 'swing' },
  { label: 'Direction', icon: ArrowUpDown, hue: '#16a34a', anim: 'bounce' },
  { label: 'Price', icon: CircleDollarSign, hue: '#0369a1', anim: 'pop' },
  { label: 'P&L', icon: Wallet, hue: '#059669', anim: 'slide' },
  { label: 'Screenshot', icon: ImageIcon, hue: '#db2777', anim: 'flash' },
  { label: 'Status', icon: CircleDot, hue: '#eb5e28', anim: 'pulse' },
  { label: 'Notes', icon: StickyNote, hue: '#ca8a04', anim: 'tilt' },
  { label: 'Result', icon: Trophy, hue: '#7c3aed', anim: 'bounce' },
  { label: 'Order details', icon: ReceiptText, hue: '#0891b2', anim: 'swing' },
  { label: 'Final P&L', icon: BadgeIndianRupee, hue: '#16a34a', anim: 'pop' },
  { label: 'Actions', icon: Settings2, hue: '#475569', anim: 'spin' },
]


// Order-details / Final-P&L image cell (same behaviour as the Result cell).
function ExtraImageCell({ trade, kind }) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)
  const url = kind === 'pnl' ? trade.pnlImageUrl : trade.orderImageUrl
  const label = kind === 'pnl' ? 'final P&L' : 'order details'
  const pick = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const { url: u, hosted, error } = await uploadTradeImage(file)
      useTradeAnalysisStore.getState().updateTradeExtraImage(trade.id, kind, u, hosted)
      if (!hosted) useUiStore.getState().showToast(error ? 'Image saved locally — upload failed.' : 'Image saved locally — connect Cloudinary to host it.')
    } finally {
      setUploading(false)
    }
  }
  if (url) {
    return (
      <button
        onClick={() =>
          useUiStore.getState().openImageLightbox(url, () => useTradeAnalysisStore.getState().updateTradeExtraImage(trade.id, kind, null, false))
        }
        title={`View ${label} image`}
      >
        <img src={url} alt={label} className="h-7 w-7 rounded object-cover" />
      </button>
    )
  }
  return (
    <>
      <motion.button
        whileTap={{ scale: 0.9 }}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) pick(f) }}
        disabled={uploading}
        title={`Attach ${label} image — click or drag & drop`}
        animate={{
          scale: dragOver ? 1.12 : 1,
          borderColor: dragOver ? 'var(--ta-accent)' : 'var(--ta-slate)',
          backgroundColor: dragOver ? 'color-mix(in srgb, var(--ta-accent) 14%, transparent)' : 'rgba(0,0,0,0)',
        }}
        transition={{ duration: 0.15 }}
        className="flex h-9 w-9 items-center justify-center rounded border border-dashed disabled:opacity-40"
        style={{ color: dragOver ? 'var(--ta-accent)' : 'var(--ta-slate)' }}
      >
        {uploading ? <Camera size={12} className="animate-pulse" /> : <ImagePlus size={13} />}
      </motion.button>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pick(f) }} />
    </>
  )
}

// ─── One entry row ──────────────────────────────────────────────────────
// Memoized: `trade` keeps its identity unless that very trade changed, and
// `sigKey` is a primitive ("101|01|…"), so ticking one rule only re-renders
// that row.
const DeepRow = memo(function DeepRow({ trade, idx, groups, sigKey, total, isEditing }) {
  const [editingPnl, setEditingPnl] = useState(false)
  const [pnlDraft, setPnlDraft] = useState('')
  const [notesOpen, setNotesOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef(null)

  const sigs = sigKey.split('|')
  const checked = sigs.reduce((n, sg) => n + sg.split('').filter((c) => c === '1').length, 0)
  const pct = total ? (checked / total) * 100 : 0
  const sym = symbolForType(trade.instrumentType)

  const commitPnl = () => {
    const val = pnlDraft.trim()
    const num = val === '' ? null : Number(val)
    useTradeAnalysisStore.getState().updateTradePnl(trade.id, val === '' || Number.isNaN(num) ? null : num)
    setEditingPnl(false)
  }

  const pickResult = async (file) => {
    if (!file) return
    setUploading(true)
    try {
      const { url, hosted, error } = await uploadTradeImage(file)
      useTradeAnalysisStore.getState().updateTradeResultImage(trade.id, url, hosted)
      if (!hosted) {
        useUiStore.getState().showToast(error ? 'Result image saved locally — upload failed.' : 'Result image saved locally — connect Cloudinary to host it.')
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <motion.tr
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{
        opacity: 1,
        y: 0,
        backgroundColor: isEditing ? 'rgba(235,94,40,0.08)' : 'rgba(235,94,40,0)',
        transition: { delay: Math.min(idx, 12) * 0.03, duration: 0.22 },
      }}
      exit={{ opacity: 0, x: 16, transition: { duration: 0.15 } }}
      whileHover={{ boxShadow: '0 2px 10px rgba(64,61,57,0.12)' }}
      className="relative"
      style={{ borderBottom: '1px solid rgba(64,61,57,0.15)' }}
    >
      <td className={TD}>
        <motion.span
          initial={{ scale: 0.3, rotate: -25, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          whileHover={{ scale: 1.35, rotate: -6, y: -1 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 380, damping: 16, delay: Math.min(idx, 12) * 0.03 }}
          className="inline-block cursor-default text-[11px] font-extrabold tabular-nums"
          style={{ color: '#0a0a0a' }}
        >
          {idx + 1}
        </motion.span>
      </td>

      <td className={TD}>
        <motion.span
          initial={{ x: -14, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          whileHover={{ x: 3, scale: 1.05 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 320, damping: 20, delay: Math.min(idx, 12) * 0.03 + 0.05 }}
          className="inline-block origin-left cursor-default text-[11.5px] font-extrabold tabular-nums"
          style={{ color: '#0a0a0a' }}
        >
          {trade.date}
        </motion.span>
      </td>

      <td className={TD}>
        <p className="text-[11.5px] font-bold" style={{ color: 'var(--ta-ink)' }}>{trade.pair}</p>
        {trade.instrumentName && trade.instrumentName !== trade.pair && (
          <p className="text-[8.5px]" style={{ color: 'var(--ta-slate)' }}>{trade.instrumentName}</p>
        )}
      </td>

      <td className={TD}>
        <motion.span
          whileHover={{ scale: 1.08, y: -1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 18 }}
          className="inline-block rounded-full px-1.5 py-0.5 text-[8px] font-semibold"
          style={{
            backgroundColor: (TYPE_BADGE_STYLE[trade.instrumentType] || TIMEFRAME_DEFAULT_STYLE).bg,
            color: (TYPE_BADGE_STYLE[trade.instrumentType] || TIMEFRAME_DEFAULT_STYLE).text,
          }}
        >
          {trade.instrumentType}
        </motion.span>
      </td>

      <td className={TD}>
        <motion.span
          whileHover={{ scale: 1.08, y: -1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 18 }}
          className="inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold"
          style={{
            backgroundColor: (TIMEFRAME_BADGE_STYLE[trade.timeframe] || TIMEFRAME_DEFAULT_STYLE).bg,
            color: (TIMEFRAME_BADGE_STYLE[trade.timeframe] || TIMEFRAME_DEFAULT_STYLE).text,
          }}
        >
          {trade.timeframe}
        </motion.span>
      </td>

      <td className={TD}>
        <motion.span
          whileHover={{ scale: 1.1 }}
          className="inline-block rounded-full px-1.5 py-0.5 text-[8px] font-semibold text-white"
          style={{ backgroundColor: trade.direction === 'Buy' ? '#16a34a' : '#dc2626' }}
        >
          {trade.direction}
        </motion.span>
      </td>

      <td className={TD} style={{ color: 'var(--ta-ink)' }}>
        {trade.price != null && trade.price !== '' ? <>{sym}{trade.price}</> : '—'}
      </td>

      {/* P&L — click to edit inline; Enter/blur saves, Escape cancels */}
      <td className={TD}>
        {editingPnl ? (
          <motion.input
            autoFocus
            type="number"
            step="any"
            inputMode="decimal"
            value={pnlDraft}
            onChange={(e) => setPnlDraft(e.target.value)}
            onBlur={commitPnl}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitPnl()
              if (e.key === 'Escape') setEditingPnl(false)
            }}
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 rounded border px-1 py-0.5 text-[9px] outline-none"
            style={{ borderColor: 'var(--ta-accent)', color: 'var(--ta-ink)' }}
          />
        ) : (
          <motion.button
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              setEditingPnl(true)
              setPnlDraft(trade.pnl == null ? '' : String(trade.pnl))
            }}
            title="Click to edit P&L"
            className="rounded-full px-1.5 py-0.5 text-[8.5px] font-bold transition-colors hover:brightness-95"
            style={
              trade.pnl == null
                ? { color: 'var(--ta-slate)', border: '1px dashed var(--ta-slate)' }
                : trade.pnl > 0
                  ? { backgroundColor: 'rgba(22,163,74,0.14)', color: '#16a34a' }
                  : trade.pnl < 0
                    ? { backgroundColor: 'rgba(220,38,38,0.14)', color: '#dc2626' }
                    : { backgroundColor: 'var(--ta-bg)', color: 'var(--ta-ink)' }
            }
          >
            {trade.pnl == null ? '+ Add' : `${trade.pnl > 0 ? '+' : ''}${sym}${trade.pnl}`}
          </motion.button>
        )}
      </td>

      <td className={TD}>
        {trade.screenshotUrl ? (
          <button
            onClick={() =>
              useUiStore
                .getState()
                .openImageLightbox(trade.screenshotUrl, () =>
                  useTradeAnalysisStore.getState().autosaveTrade(trade.id, { screenshotUrl: null, screenshotHosted: false })
                )
            }
            title="View screenshot"
          >
            <img src={trade.screenshotUrl} alt="Screenshot" className="h-6 w-6 rounded object-cover" />
          </button>
        ) : (
          <span className="text-[8px]" style={{ color: 'var(--ta-slate)' }}>—</span>
        )}
      </td>

      <td className={TD}>
        <StatusDropdown value={trade.status} onChange={(next) => useTradeAnalysisStore.getState().updateTradeStatus(trade.id, next)} />
      </td>

      <td className={`${TD} ${notesOpen ? 'whitespace-normal' : ''}`}>
        {trade.notes ? (
          <button
            onClick={() => setNotesOpen((o) => !o)}
            className={`text-left ${notesOpen ? 'max-w-[220px]' : 'max-w-[110px] truncate'} block`}
            title={notesOpen ? 'Click to collapse' : trade.notes}
            style={{ color: 'var(--ta-ink)' }}
          >
            {trade.notes}
          </button>
        ) : (
          <span className="text-[8px]" style={{ color: 'var(--ta-slate)' }}>—</span>
        )}
      </td>

      <td className={TD}>
        {trade.resultImageUrl ? (
          <button
            onClick={() =>
              useUiStore
                .getState()
                .openImageLightbox(trade.resultImageUrl, () => useTradeAnalysisStore.getState().updateTradeResultImage(trade.id, null, false))
            }
            title="View result image"
          >
            <img src={trade.resultImageUrl} alt="Result" className="h-7 w-7 rounded object-cover" />
          </button>
        ) : (
          <>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const file = e.dataTransfer.files?.[0]
                if (file) pickResult(file)
              }}
              disabled={uploading}
              title="Attach result / P&L image — click or drag & drop"
              animate={{
                scale: dragOver ? 1.12 : 1,
                borderColor: dragOver ? 'var(--ta-accent)' : 'var(--ta-slate)',
                backgroundColor: dragOver ? 'color-mix(in srgb, var(--ta-accent) 14%, transparent)' : 'rgba(0,0,0,0)',
              }}
              transition={{ duration: 0.15 }}
              className="flex h-9 w-9 items-center justify-center rounded border border-dashed disabled:opacity-40"
              style={{ color: dragOver ? 'var(--ta-accent)' : 'var(--ta-slate)' }}
            >
              {uploading ? <Camera size={12} className="animate-pulse" /> : <ImagePlus size={13} />}
            </motion.button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                pickResult(file)
              }}
            />
          </>
        )}
      </td>

      <td className={TD}><ExtraImageCell trade={trade} kind="order" /></td>
      <td className={TD}><ExtraImageCell trade={trade} kind="pnl" /></td>

      <td className={TD}>
        <div className="flex items-center gap-1">
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => useTradeAnalysisStore.getState().setEditingTrade(trade.id)}
            title="Edit"
            className="rounded p-1 hover:bg-black/5"
            style={{ color: 'var(--ta-slate)' }}
          >
            <Pencil size={12} />
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => {
              if (!window.confirm('Delete this trade? This cannot be undone.')) return
              useTradeAnalysisStore.getState().deleteTrade(trade.id)
            }}
            title="Delete"
            className="rounded p-1 hover:bg-black/5"
            style={{ color: '#dc2626' }}
          >
            <Trash2 size={12} />
          </motion.button>
        </div>
      </td>

      {/* ── Validation: overall score, then one multi-select per category ── */}
      {total > 0 && (
        <td className={TD} style={{ borderLeft: '1px solid color-mix(in srgb, var(--ta-slate) 35%, transparent)' }}>
          <div className="flex w-[54px] flex-col gap-0.5">
            <span
              className="rounded-full px-1.5 py-0.5 text-center text-[8px] font-bold"
              style={{ backgroundColor: scoreColor(pct), color: '#fffcf2' }}
            >
              {checked}/{total}
            </span>
            <div className="h-[3px] overflow-hidden rounded-full" style={{ backgroundColor: 'color-mix(in srgb, var(--ta-slate) 25%, transparent)' }}>
              <motion.div className="h-full rounded-full" animate={{ width: `${pct}%`, backgroundColor: scoreColor(pct) }} transition={{ type: 'spring', stiffness: 260, damping: 28 }} />
            </div>
          </div>
        </td>
      )}
      {groups.length === 0 ? (
        <td className={TD}>
          <span className="text-[8.5px] italic" style={{ color: 'var(--ta-slate)' }}>No validation categories yet</span>
        </td>
      ) : (
        groups.map(({ category, rules }, i) => (
          <td key={category.id} className={`${TD} !px-0.5`} style={{ width: 1 }}>
            <div className="flex w-full justify-center">
              <CategorySelect tradeId={trade.id} category={category} rules={rules} signature={sigs[i]} hideLabel compact={groups.length > 6} />
            </div>
          </td>
        ))
      )}
    </motion.tr>
  )
})

// ─── Summary widgets (compact ring tiles) ───────────────────────────────
// Number that counts up to its value (and re-counts whenever it changes).
function CountUp({ value, decimals = 0, suffix = '', delay = 0 }) {
  const reduce = useReducedMotion()
  const mv = useMotionValue(reduce ? value : 0)
  const text = useTransform(mv, (v) => `${v.toFixed(decimals)}${suffix}`)
  useEffect(() => {
    if (reduce) {
      mv.set(value)
      return undefined
    }
    const controls = animate(mv, value, { duration: 0.9, ease: 'easeOut', delay })
    return () => controls.stop()
  }, [value, reduce, mv, delay])
  return <motion.span>{text}</motion.span>
}

const RING = 15 // radius
const CIRC = 2 * Math.PI * RING

// One tile: a progress ring (draws itself in, glows on hover) with the
// main number counted up inside it, label + small caption on the right.
function RingTile({ label, icon: Icon, caption, value, decimals = 0, suffix = '', pct, color, empty = false, index = 0 }) {
  const reduce = useReducedMotion()
  const clamped = Math.max(0, Math.min(100, pct || 0))
  return (
    <motion.div
      initial="rest"
      animate="rest"
      whileHover="hover"
      variants={{
        rest: { opacity: 1, y: 0, scale: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' },
        hover: { y: -2, scale: 1.03, boxShadow: `0 6px 16px color-mix(in srgb, ${color} 32%, transparent)` },
      }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      className="relative flex shrink-0 items-center gap-1 overflow-hidden rounded-lg border py-0.5 pl-0.5 pr-2"
      style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)' }}
    >
      {/* entrance: pop in, staggered */}
      <motion.span
        aria-hidden
        className="absolute inset-0"
        initial={{ opacity: 0.9 }}
        animate={{ opacity: 0 }}
        transition={{ delay: index * 0.05, duration: 0.5 }}
        style={{ backgroundColor: `color-mix(in srgb, ${color} 18%, transparent)` }}
      />
      <motion.div
        className="relative flex h-[24px] w-[24px] shrink-0 items-center justify-center"
        initial={reduce ? false : { scale: 0.4, rotate: -90, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18, delay: index * 0.05 }}
      >
        <motion.svg
          width="24"
          height="24"
          viewBox="0 0 36 36"
          className="absolute inset-0 -rotate-90"
          variants={{ rest: { scale: 1, filter: 'drop-shadow(0 0 0 transparent)' }, hover: { scale: 1.08, filter: `drop-shadow(0 0 3px ${color})` } }}
        >
          <circle cx="18" cy="18" r={RING} fill="none" strokeWidth="3.5" style={{ stroke: 'color-mix(in srgb, var(--ta-slate) 28%, transparent)' }} />
          <motion.circle
            cx="18"
            cy="18"
            r={RING}
            fill="none"
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            initial={{ strokeDashoffset: reduce ? CIRC * (1 - clamped / 100) : CIRC }}
            animate={{ strokeDashoffset: CIRC * (1 - clamped / 100) }}
            transition={{ duration: reduce ? 0 : 1, ease: 'easeOut', delay: index * 0.05 }}
            style={{ stroke: color }}
          />
        </motion.svg>
        <span className="relative text-[7px] font-extrabold leading-none" style={{ color: 'var(--ta-ink)' }}>
          {empty ? '—' : <CountUp value={value} decimals={decimals} suffix={suffix} delay={index * 0.05} />}
        </span>
      </motion.div>

      <div className="relative flex min-w-0 flex-col leading-tight">
        <span className="flex items-center gap-0.5 text-[7.5px] font-bold uppercase tracking-wide" style={{ color: 'var(--ta-slate)' }}>
          {Icon && (
            <motion.span
              className="flex"
              variants={{ rest: { rotate: 0, scale: 1 }, hover: { rotate: [0, -14, 10, 0], scale: 1.2, transition: { duration: 0.5 } } }}
              style={{ color }}
            >
              {isValidElement(Icon) ? Icon : <Icon size={8} />}
            </motion.span>
          )}
          <span className="truncate">{label}</span>
        </span>
        {caption && <span className="truncate text-[7px]" style={{ color: 'var(--ta-slate)' }}>{caption}</span>}
      </div>
    </motion.div>
  )
}

// ─── The view ───────────────────────────────────────────────────────────
export default function DeepAnalysis() {
  const trades = useTradeAnalysisStore((s) => s.trades)
  const rules = useTradeAnalysisStore((s) => s.validationRules)
  const categories = useTradeAnalysisStore((s) => s.validationCategories)
  const filters = useTradeAnalysisStore((s) => s.filters)
  const editingTradeId = useTradeAnalysisStore((s) => s.editingTradeId)

  // Categories (in order) with only their ACTIVE rules, same as the
  // Add-Validation popup offers.
  const groups = useMemo(
    () =>
      [...categories]
        .sort((a, b) => a.order - b.order)
        .map((category) => ({
          category,
          rules: rules.filter((r) => r.categoryId === category.id && r.active).sort((a, b) => a.order - b.order),
        })),
    [categories, rules]
  )
  const totalActive = useMemo(() => groups.reduce((n, g) => n + g.rules.length, 0), [groups])

  const filtered = useMemo(
    () =>
      applyFilters(trades, filters).sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1
        return (b.createdAt || 0) - (a.createdAt || 0)
      }),
    [trades, filters]
  )

  // Per-entry signature key ("101|01|…", one segment per category) + score.
  const rows = useMemo(
    () =>
      filtered.map((trade) => {
        const ids = new Set(trade.validationRuleIds || [])
        const sigs = groups.map(({ rules: catRules }) => catRules.map((r) => (ids.has(r.id) ? '1' : '0')).join(''))
        const checked = sigs.reduce((n, sg) => n + sg.split('').filter((c) => c === '1').length, 0)
        return { trade, sigs, sigKey: sigs.join('|'), checked, pct: totalActive ? (checked / totalActive) * 100 : 0 }
      }),
    [filtered, groups, totalActive]
  )

  const stats = useMemo(() => {
    const n = rows.length
    const avg = n && totalActive ? rows.reduce((s, r) => s + r.pct, 0) / n : 0
    const full = rows.filter((r) => totalActive > 0 && r.checked === totalActive).length
    const none = rows.filter((r) => r.checked === 0).length
    const perCategory = groups.map(({ category, rules: catRules }, gi) => {
      if (!n || catRules.length === 0) return { category, pct: 0 }
      const sum = rows.reduce((s, r) => s + r.sigs[gi].split('').filter((c) => c === '1').length, 0)
      return { category, pct: (sum / (n * catRules.length)) * 100 }
    })
    const target = rows.filter((r) => r.trade.status === 'Target Hit').length
    const sl = rows.filter((r) => r.trade.status === 'SL Hit').length
    const winRate = target + sl ? (target / (target + sl)) * 100 : null
    return { n, avg, full, none, perCategory, target, sl, winRate }
  }, [rows, groups, totalActive])

  if (trades.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <motion.span animate={{ y: [0, -6, 0] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} className="text-3xl">📈</motion.span>
        <p className="text-xs font-semibold" style={{ color: 'var(--ta-ink)' }}>No trades logged yet</p>
        <p className="max-w-[240px] text-[11px]" style={{ color: 'var(--ta-slate)' }}>
          Go back and add your first entry — it will show up here with its validation checklist.
        </p>
      </div>
    )
  }

  const valCols = groups.length === 0 ? [{ key: 'none', name: 'Validation' }] : groups.map(({ category }) => ({ key: category.id, name: category.name, icon: category.icon }))

  return (
    <div className="flex h-full w-full flex-col">
      {/* Summary strip — compact ring widgets */}
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b px-2 py-1" style={{ borderColor: 'color-mix(in srgb, var(--ta-slate) 35%, transparent)' }}>
        <RingTile index={0} label="Entries" icon={ListChecks} caption={stats.n !== trades.length ? `of ${trades.length} (filtered)` : 'all trades'} value={stats.n} pct={trades.length ? (stats.n / trades.length) * 100 : 0} color="#2563eb" />
        <RingTile
          index={1}
          label="Win rate"
          icon={Trophy}
          caption={stats.winRate == null ? 'no resolved trades' : `${stats.target}W · ${stats.sl}L`}
          value={stats.winRate ?? 0}
          suffix="%"
          pct={stats.winRate ?? 0}
          empty={stats.winRate == null}
          color={stats.winRate == null ? 'var(--ta-slate)' : stats.winRate >= 50 ? '#16a34a' : '#dc2626'}
        />
        <RingTile index={2} label="Target hit" icon={Target} caption={`${stats.n ? Math.round((stats.target / stats.n) * 100) : 0}% of entries`} value={stats.target} pct={stats.n ? (stats.target / stats.n) * 100 : 0} color="#16a34a" />
        <RingTile index={3} label="SL hit" icon={CircleDot} caption={`${stats.n ? Math.round((stats.sl / stats.n) * 100) : 0}% of entries`} value={stats.sl} pct={stats.n ? (stats.sl / stats.n) * 100 : 0} color="#dc2626" />
        <RingTile index={4} label="Avg validation" icon={Gauge} caption={`${totalActive} active rules`} value={stats.avg} suffix="%" pct={stats.avg} color={scoreColor(stats.avg)} />
        <RingTile index={5} label="Fully validated" icon={CheckCheck} caption={`of ${stats.n} entries`} value={stats.full} pct={stats.n ? (stats.full / stats.n) * 100 : 0} color="#16a34a" />
        <RingTile index={6} label="Not validated" icon={Eraser} caption={`of ${stats.n} entries`} value={stats.none} pct={stats.n ? (stats.none / stats.n) * 100 : 0} color={stats.none ? '#dc2626' : 'var(--ta-slate)'} />
        {stats.perCategory.map(({ category, pct }, i) => (
          <RingTile
            key={category.id}
            index={7 + i}
            label={category.name}
            icon={<CategoryIcon name={category.icon} size={10} />}
            caption="avg checked"
            value={pct}
            suffix="%"
            pct={pct}
            color={scoreColor(pct)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <span className="text-3xl">🔍</span>
          <p className="text-xs font-semibold" style={{ color: 'var(--ta-ink)' }}>No trades match these filters</p>
          <p className="max-w-[240px] text-[11px]" style={{ color: 'var(--ta-slate)' }}>Try widening a filter, or clear them all from the Filters button above.</p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr style={{ backgroundColor: 'var(--ta-surface)' }}>
                {BASE_COLS.map((c, i) => (
                  <th
                    key={c.label}
                    scope="col"
                    className={TH}
                    style={{ borderBottom: '2px solid var(--ta-slate)', backgroundColor: 'var(--ta-surface)' }}
                  >
                    <TableHeaderIcon icon={c.icon} label={c.label} hue={c.hue} anim={c.anim} align={c.align} index={i} />
                  </th>
                ))}
                {totalActive > 0 && (
                  <th
                    scope="col"
                    className={TH}
                    style={{ borderBottom: '2px solid var(--ta-slate)', borderLeft: '1px solid color-mix(in srgb, var(--ta-slate) 35%, transparent)', backgroundColor: 'var(--ta-surface)' }}
                  >
                    <TableHeaderIcon icon={Gauge} label="Validation score" hue="#eb5e28" anim="swing" index={BASE_COLS.length} />
                  </th>
                )}
                {valCols.map((c) => (
                  <th key={c.key} title={c.name} className={TH} style={{ color: 'var(--ta-ink)', borderBottom: '2px solid var(--ta-accent)', backgroundColor: 'var(--ta-surface)', width: 1, paddingLeft: 2, paddingRight: 2 }}>
                    <span className="flex items-center justify-center gap-1">
                      {c.icon ? <CategoryIcon name={c.icon} size={11} style={{ color: 'var(--ta-accent)' }} /> : <span className="sr-only">{c.name}</span>}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <AnimatePresence initial={false}>
                {rows.map((r, i) => (
                  <DeepRow
                    key={r.trade.id}
                    trade={r.trade}
                    idx={i}
                    groups={groups}
                    sigKey={r.sigKey}
                    total={totalActive}
                    isEditing={r.trade.id === editingTradeId}
                  />
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
