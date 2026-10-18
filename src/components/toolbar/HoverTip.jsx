import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'

// One shared, animated tooltip for every element carrying `data-tip="…"`.
// • Portal + fixed position → never clipped by the scrolling toolbar.
// • Glides from icon to icon (spring), blur/scale pop on first show, soft glow + arrow.
// • "Undo (Ctrl+Z)" → name + key chip; "Name — details" → name + second line.
// • Stays inside the viewport; hides on click, scroll, Esc and touch.

const parse = (raw) => {
  const kb = /\(([^)]+)\)\s*$/.exec(raw)
  let rest = kb ? raw.slice(0, kb.index).trim() : raw
  let hint = ''
  const i = rest.indexOf(' — ')
  if (i > -1) {
    hint = rest.slice(i + 3)
    rest = rest.slice(0, i)
  }
  return { name: rest, hint, kb: kb ? kb[1] : '' }
}

export default function HoverTip() {
  const [tip, setTip] = useState(null) // { raw, rect }
  const [pos, setPos] = useState({ x: 0, y: 0, arrow: 0 })
  const boxRef = useRef(null)
  const timer = useRef(0)
  const lastHide = useRef(0)
  const current = useRef(null)

  useEffect(() => {
    const hide = () => {
      clearTimeout(timer.current)
      if (current.current) lastHide.current = Date.now()
      current.current = null
      setTip(null)
    }
    const over = (e) => {
      const el = e.target.closest?.('[data-tip]')
      if (!el) return current.current && hide()
      if (el === current.current) return
      clearTimeout(timer.current)
      const show = () => {
        current.current = el
        setTip({ raw: el.getAttribute('data-tip'), rect: el.getBoundingClientRect() })
      }
      // instant when sliding between neighbouring icons, short delay for the first one
      if (current.current || Date.now() - lastHide.current < 350) show()
      else timer.current = setTimeout(show, 260)
    }
    const key = (e) => e.key === 'Escape' && hide()
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerdown', hide, true)
    window.addEventListener('scroll', hide, true)
    window.addEventListener('keydown', key)
    window.addEventListener('blur', hide)
    return () => {
      clearTimeout(timer.current)
      document.removeEventListener('pointerover', over)
      document.removeEventListener('pointerdown', hide, true)
      window.removeEventListener('scroll', hide, true)
      window.removeEventListener('keydown', key)
      window.removeEventListener('blur', hide)
    }
  }, [])

  useLayoutEffect(() => {
    if (!tip || !boxRef.current) return
    const w = boxRef.current.offsetWidth
    const cx = tip.rect.left + tip.rect.width / 2
    const x = Math.max(8, Math.min(cx - w / 2, window.innerWidth - w - 8))
    setPos({ x, y: tip.rect.bottom + 9, arrow: cx - x })
  }, [tip])

  const p = tip ? parse(tip.raw) : null
  return createPortal(
    <AnimatePresence>
      {tip && p && (
        <motion.div
          key="wb-hovertip"
          ref={boxRef}
          role="tooltip"
          initial={{ opacity: 0, scale: 0.85, filter: 'blur(5px)', left: pos.x, top: pos.y - 6 }}
          animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', left: pos.x, top: pos.y }}
          exit={{ opacity: 0, scale: 0.92, filter: 'blur(3px)', transition: { duration: 0.1 } }}
          transition={{ type: 'spring', stiffness: 480, damping: 30, mass: 0.7 }}
          style={{ position: 'fixed', zIndex: 400, pointerEvents: 'none', transformOrigin: `${pos.arrow}px 0` }}
          className="max-w-[280px]"
        >
          <span
            className="absolute -top-1 h-2.5 w-2.5 rotate-45 rounded-[2px]"
            style={{ left: pos.arrow - 5, background: '#111827', borderTop: '1px solid rgba(255,255,255,0.14)', borderLeft: '1px solid rgba(255,255,255,0.14)' }}
          />
          <div
            className="relative overflow-hidden rounded-xl px-3 py-1.5"
            style={{
              background: 'linear-gradient(135deg, #0b1220 0%, #1e293b 100%)',
              boxShadow: '0 10px 28px rgba(2,6,23,0.45), 0 0 0 1px rgba(255,255,255,0.1), 0 0 18px color-mix(in srgb, var(--color-accent) 35%, transparent)',
            }}
          >
            <motion.span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/2 skew-x-[-20deg]"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent)' }}
              initial={{ x: '-60%' }}
              animate={{ x: '420%' }}
              transition={{ duration: 0.7, ease: 'easeOut', delay: 0.05 }}
            />
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={tip.raw} initial={{ opacity: 0, y: 3 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }} className="relative">
                <div className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: 'var(--color-accent)', boxShadow: '0 0 8px var(--color-accent)' }} />
                  <span className="whitespace-nowrap text-[11.5px] font-semibold leading-tight text-white">{p.name}</span>
                  {p.kb && (
                    <kbd className="rounded border border-white/20 bg-white/10 px-1.5 py-px font-mono text-[9.5px] leading-tight text-slate-200">{p.kb}</kbd>
                  )}
                </div>
                {p.hint && <p className="mt-0.5 pl-3.5 text-[10px] leading-snug text-slate-300">{p.hint}</p>}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
