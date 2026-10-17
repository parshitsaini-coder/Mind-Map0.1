import { useEffect, useRef } from 'react'

// Pointer effects for the select tool: full-board crosshair guides ("Cross")
// or a glowing laser dot with a fading trail ("Demonstration"). Positions are
// written straight to the DOM so mouse moves never re-render React.
export default function CursorFx({ containerRef, mode }) {
  const vRef = useRef(null)
  const hRef = useRef(null)
  const dotRefs = useRef([])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    let mx = -200
    let my = -200
    let inside = false
    let raf = 0
    const trail = Array.from({ length: 12 }, () => ({ x: -200, y: -200 }))

    const show = (on) => {
      if (mode === 'cross') {
        if (vRef.current) vRef.current.style.opacity = on ? '1' : '0'
        if (hRef.current) hRef.current.style.opacity = on ? '1' : '0'
      }
    }
    const move = (e) => {
      const r = el.getBoundingClientRect()
      mx = e.clientX - r.left
      my = e.clientY - r.top
      inside = true
      if (mode === 'cross') {
        if (vRef.current) vRef.current.style.transform = `translateX(${mx}px)`
        if (hRef.current) hRef.current.style.transform = `translateY(${my}px)`
        show(true)
      }
    }
    const leave = () => {
      inside = false
      show(false)
    }
    el.addEventListener('mousemove', move)
    el.addEventListener('mouseleave', leave)

    const loop = () => {
      if (mode === 'demo') {
        trail.forEach((t, i) => {
          const tx = i === 0 ? mx : trail[i - 1].x
          const ty = i === 0 ? my : trail[i - 1].y
          t.x += (tx - t.x) * 0.45
          t.y += (ty - t.y) * 0.45
          const d = dotRefs.current[i]
          if (d) {
            d.style.transform = `translate(${t.x - 9}px, ${t.y - 9}px) scale(${1 - i * 0.07})`
            d.style.opacity = inside ? String(Math.max(0, 0.9 - i * 0.08)) : '0'
          }
        })
      }
      raf = requestAnimationFrame(loop)
    }
    if (mode === 'demo') raf = requestAnimationFrame(loop)

    return () => {
      el.removeEventListener('mousemove', move)
      el.removeEventListener('mouseleave', leave)
      cancelAnimationFrame(raf)
    }
  }, [containerRef, mode])

  if (mode === 'cross') {
    return (
      <>
        <div ref={vRef} className="pointer-events-none absolute left-0 top-0 h-full w-px opacity-0" style={{ backgroundColor: 'rgba(37,99,235,0.55)' }} />
        <div ref={hRef} className="pointer-events-none absolute left-0 top-0 h-px w-full opacity-0" style={{ backgroundColor: 'rgba(37,99,235,0.55)' }} />
      </>
    )
  }
  return (
    <>
      {Array.from({ length: 12 }, (_, i) => (
        <div
          key={i}
          ref={(n) => {
            dotRefs.current[i] = n
          }}
          className="pointer-events-none absolute left-0 top-0 h-[18px] w-[18px] rounded-full opacity-0"
          style={{ background: 'radial-gradient(circle, #ff2d2d 0%, rgba(255,45,45,0.55) 45%, rgba(255,45,45,0) 72%)' }}
        />
      ))}
    </>
  )
}
