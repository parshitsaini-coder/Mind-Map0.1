import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { createPortal } from 'react-dom'
import {
  X, DatabaseBackup, Download, Upload, Check, Brain, CandlestickChart, PenSquare, FlaskConical,
  FileJson, ShieldCheck, Loader2, CircleAlert, CalendarClock,
} from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import {
  currentStats, downloadFullBackup, readFullBackup, importFullBackup, getLastBackupAt,
} from '../../utils/fullBackup'

// Black + cream popup (same look as the Share trades popup). Left: what to
// put in the backup file → Download. Right/below: drop a backup file → pick
// what to bring back → Import (adds only, never overwrites).

const SPRING = { type: 'spring', stiffness: 380, damping: 30 }
const stagger = { show: { transition: { staggerChildren: 0.06, delayChildren: 0.12 } } }
const rise = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: SPRING } }

const ITEMS = [
  { key: 'maps', label: 'Mind maps', icon: Brain, count: (s) => `${s.maps} map${s.maps === 1 ? '' : 's'} · ${s.nodes} nodes`, always: true },
  { key: 'trades', label: 'Trade Analysis', icon: CandlestickChart, count: (s) => `${s.trades} trade${s.trades === 1 ? '' : 's'} + validation rules` },
  { key: 'whiteboard', label: 'Whiteboard', icon: PenSquare, count: (s) => `${s.whiteboard} drawing${s.whiteboard === 1 ? '' : 's'}` },
  { key: 'strategy', label: 'Strategy Tester', icon: FlaskConical, count: (s) => `${s.strategies} strateg${s.strategies === 1 ? 'y' : 'ies'} + entries` },
]
const STAT_KEY = { maps: 'maps', trades: 'trades', whiteboard: 'whiteboard', strategy: 'strategies' }

function Check3({ on }) {
  return (
    <motion.span
      animate={{ backgroundColor: on ? '#111111' : 'rgba(0,0,0,0)', scale: on ? [1, 1.18, 1] : 1 }}
      transition={{ duration: 0.22 }}
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border"
      style={{ borderColor: '#111' }}
    >
      <AnimatePresence initial={false}>
        {on && (
          <motion.span initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={SPRING}>
            <Check size={11} strokeWidth={3.5} color="#f6ecd0" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.span>
  )
}

function Row({ item, on, onToggle, countText, disabled, late }) {
  const Icon = item.icon
  return (
    <motion.button
      {...(late ? { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: SPRING } : { variants: rise })}
      type="button"
      disabled={disabled}
      onClick={onToggle}
      whileHover={disabled ? undefined : { x: 3 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      className="flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left disabled:opacity-40"
      style={{ borderColor: on ? '#111' : 'rgba(17,17,17,0.18)', backgroundColor: on ? 'rgba(17,17,17,0.05)' : 'transparent' }}
    >
      <Check3 on={on} />
      <Icon size={15} color="#111" />
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-semibold" style={{ color: '#111' }}>{item.label}</span>
        <span className="block text-[10px]" style={{ color: '#6b655a' }}>{countText}</span>
      </span>
    </motion.button>
  )
}

function ago(ts) {
  if (!ts) return null
  const days = Math.floor((Date.now() - ts) / 86400000)
  if (days <= 0) return 'aaj'
  return `${days} din pehle`
}

function Body({ onClose }) {
  const showToast = useUiStore((s) => s.showToast)
  const [stats] = useState(() => currentStats())
  const [inc, setInc] = useState({ maps: true, trades: true, whiteboard: true, strategy: true })
  const [busy, setBusy] = useState(false)
  const [doneDl, setDoneDl] = useState(null)
  const [last, setLast] = useState(() => getLastBackupAt())
  const [file, setFile] = useState(null) // { name, parsed, summary }
  const [impInc, setImpInc] = useState({ maps: true, trades: true, whiteboard: true, strategy: true })
  const [err, setErr] = useState('')
  const [dragging, setDragging] = useState(false)
  const [doneImp, setDoneImp] = useState(null)
  const fileRef = useRef(null)

  const stale = last && Date.now() - last > 7 * 86400000
  const toggle = (k) => setInc((s) => (k === 'maps' ? s : { ...s, [k]: !s[k] }))

  const handleDownload = async () => {
    setBusy(true)
    await new Promise((r) => setTimeout(r, 350)) // let the spinner show
    try {
      const r = downloadFullBackup(inc)
      setDoneDl(r)
      setLast(Date.now())
      showToast(`Backup downloaded — ${r.mapCount} maps.`)
    } catch (e) {
      showToast(`Backup failed: ${e.message}`)
    }
    setBusy(false)
  }

  const pickFile = async (f) => {
    setErr('')
    setDoneImp(null)
    if (!f) return
    try {
      const r = await readFullBackup(f)
      setFile({ name: f.name, ...r })
      setImpInc({ maps: r.summary.maps > 0, trades: r.summary.trades > 0, whiteboard: r.summary.whiteboard > 0, strategy: r.summary.strategies > 0 })
    } catch (e) {
      setFile(null)
      setErr(e.message)
    }
  }

  const handleImport = async () => {
    if (!file) return
    setBusy(true)
    await new Promise((r) => setTimeout(r, 350))
    const done = importFullBackup(file.parsed, impInc)
    setBusy(false)
    setDoneImp(done)
    setFile(null)
    showToast(`Import done — ${done.maps} maps, ${done.trades} trades, ${done.whiteboard} drawings, ${done.strategies} strategies added.`)
  }

  const anyImp = Object.values(impInc).some(Boolean)

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      transition={SPRING}
      onClick={(e) => e.stopPropagation()}
      className="relative flex max-h-[88vh] w-full max-w-[460px] flex-col overflow-clip rounded-2xl border shadow-2xl"
      style={{ backgroundColor: '#fbf4df', borderColor: '#111', color: '#111' }}
    >
      {/* Header */}
      <div className="relative shrink-0 overflow-clip px-4 py-3" style={{ background: 'linear-gradient(135deg, #0b0b0b, #2a2620)' }}>
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 w-1/3"
          style={{ background: 'linear-gradient(100deg, transparent, rgba(246,236,208,0.16), transparent)' }}
          animate={{ x: ['-120%', '420%'] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.4 }}
        />
        <div className="relative flex items-center gap-2.5">
          <motion.span
            initial={{ rotate: -20, scale: 0.6 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={SPRING}
            className="flex h-8 w-8 items-center justify-center rounded-xl"
            style={{ backgroundColor: '#f6ecd0' }}
          >
            <DatabaseBackup size={17} color="#111" />
          </motion.span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold" style={{ color: '#f6ecd0' }}>Backup &amp; Restore</p>
            <p className="text-[10px]" style={{ color: 'rgba(246,236,208,0.65)' }}>Saari mind maps ki ek file apne PC par</p>
          </div>
          <motion.button whileHover={{ rotate: 90, scale: 1.1 }} whileTap={{ scale: 0.85 }} onClick={onClose} aria-label="Close" className="rounded-md p-1">
            <X size={16} color="#f6ecd0" />
          </motion.button>
        </div>
      </div>

      <motion.div variants={stagger} initial="hidden" animate="show" className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {/* Weekly reminder */}
        <motion.div variants={rise} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[10.5px]" style={{ backgroundColor: stale || !last ? 'rgba(217,119,6,0.14)' : 'rgba(17,17,17,0.06)' }}>
          <CalendarClock size={14} />
          <span className="flex-1">
            {last ? <>Aakhri backup: <b>{ago(last)}</b>{stale ? ' — hafta ho gaya, naya download karo.' : '.'}</> : <>Abhi tak koi backup download nahi kiya. Har hafte ek karna achha rehta hai.</>}
          </span>
        </motion.div>

        {/* Download */}
        <motion.div variants={rise} className="flex items-center gap-1.5">
          <Download size={13} />
          <span className="text-[11px] font-bold uppercase tracking-wide">Download backup</span>
        </motion.div>
        <div className="flex flex-col gap-1.5">
          {ITEMS.map((it) => (
            <Row key={it.key} item={it} on={inc[it.key]} disabled={it.always} onToggle={() => toggle(it.key)} countText={it.count(stats)} />
          ))}
        </div>
        <motion.button
          variants={rise}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleDownload}
          disabled={busy}
          className="relative flex items-center justify-center gap-2 overflow-clip rounded-xl py-2.5 text-[12px] font-bold disabled:opacity-70"
          style={{ background: 'linear-gradient(135deg, #0b0b0b, #2a2620)', color: '#f6ecd0' }}
        >
          <motion.span aria-hidden className="pointer-events-none absolute inset-y-0 w-1/4" style={{ background: 'linear-gradient(100deg, transparent, rgba(246,236,208,0.2), transparent)' }} animate={{ x: ['-150%', '500%'] }} transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.2 }} />
          {busy && !file ? <Loader2 size={14} className="animate-spin" /> : <FileJson size={14} />}
          {busy && !file ? 'Bana raha hoon…' : 'Download backup (.json)'}
        </motion.button>
        <AnimatePresence>
          {doneDl && (
            <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-1.5 text-[10.5px] font-semibold" style={{ color: '#15803d' }}>
              <ShieldCheck size={13} /> Download ho gaya — {doneDl.mapCount} maps, {(doneDl.bytes / 1024).toFixed(0)} KB. File ko safe jagah rakhna.
            </motion.p>
          )}
        </AnimatePresence>

        <div className="h-px" style={{ backgroundColor: 'rgba(17,17,17,0.18)' }} />

        {/* Import */}
        <motion.div variants={rise} className="flex items-center gap-1.5">
          <Upload size={13} />
          <span className="text-[11px] font-bold uppercase tracking-wide">Backup wapas add karo</span>
        </motion.div>
        <motion.div
          variants={rise}
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); pickFile(e.dataTransfer.files?.[0]) }}
          onClick={() => fileRef.current?.click()}
          animate={{ scale: dragging ? 1.02 : 1, borderColor: dragging ? '#111' : 'rgba(17,17,17,0.35)' }}
          className="flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed px-3 py-4 text-center"
        >
          <motion.span animate={{ y: dragging ? -3 : [0, -3, 0] }} transition={dragging ? {} : { duration: 2.2, repeat: Infinity }}>
            <Upload size={18} />
          </motion.span>
          <span className="text-[11px] font-semibold">{file ? file.name : 'Backup file yahan drop karo ya click karo'}</span>
          <span className="text-[9.5px]" style={{ color: '#6b655a' }}>Sirf add hota hai — jo pehle se hai wo kabhi overwrite ya delete nahi hota</span>
          <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; pickFile(f) }} />
        </motion.div>

        <AnimatePresence>
          {err && (
            <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-1.5 text-[10.5px] font-semibold" style={{ color: '#b91c1c' }}>
              <CircleAlert size={13} /> {err}
            </motion.p>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {file && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="flex flex-col gap-1.5 overflow-hidden">
              <p className="text-[10.5px]" style={{ color: '#6b655a' }}>File me ye mila — jo chahiye wahi chuno:</p>
              {ITEMS.map((it) => {
                const n = file.summary[STAT_KEY[it.key]]
                if (!n) return null
                const label = it.key === 'maps' ? `${n} map${n === 1 ? '' : 's'} · ${file.summary.nodes} nodes` : it.count({ ...file.summary })
                return <Row late key={it.key} item={it} on={impInc[it.key]} onToggle={() => setImpInc((s) => ({ ...s, [it.key]: !s[it.key] }))} countText={label} />
              })}
              <motion.button
                whileHover={{ scale: 1.015 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleImport}
                disabled={busy || !anyImp}
                className="mt-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-[12px] font-bold disabled:opacity-50"
                style={{ backgroundColor: '#111', color: '#f6ecd0' }}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {busy ? 'Add ho raha hai…' : 'Add to my data'}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {doneImp && (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING} className="flex items-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold" style={{ backgroundColor: 'rgba(21,128,61,0.12)', color: '#15803d' }}>
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ ...SPRING, delay: 0.1 }}><Check size={16} strokeWidth={3} /></motion.span>
              Add ho gaya: {doneImp.maps} maps, {doneImp.trades} trades, {doneImp.whiteboard} drawings, {doneImp.strategies} strategies. Maps ab "Your Mind Maps" me dikhenge.
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

export default function BackupModal() {
  const open = useUiStore((s) => s.backupModalOpen)
  const toggle = useUiStore((s) => s.toggleBackupModal)

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => e.key === 'Escape' && toggle()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, toggle])

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="backup-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={toggle}
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
        >
          <Body onClose={toggle} />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
