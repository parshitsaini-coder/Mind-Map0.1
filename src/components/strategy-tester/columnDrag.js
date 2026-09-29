import { flushSync } from 'react-dom'

// Drag-to-reorder for Strategy Tester columns (within one strategy).
//
// The table is a real <table>, so a "column" is one <th> plus one <td> per
// row, all tagged with data-field-id. While dragging, nothing goes through
// React: the dragged column's cells get a translateX that follows the
// pointer, and the columns it passes slide out of the way with a CSS
// transition (.st-col-shift in index.css). On release the dragged column
// eases into its slot, and only then is the new order committed to the store
// (inside flushSync, so the DOM re-orders and the temporary transforms are
// cleared in the same frame — no flicker).

const THRESHOLD = 5 // px of movement before a press becomes a drag (keeps click-to-rename working)
const SETTLE_MS = 210
const EDGE = 56 // px from the scroller's edge where auto-scroll kicks in
const MAX_SCROLL_SPEED = 18

export function beginColumnDrag(e, { fieldIds, fieldId, scroller, onReorder }) {
  if (e.button !== 0 || e.pointerType === 'touch') return // touch keeps native horizontal scrolling
  if (e.target.closest('input, textarea, .st-resizer, [data-no-drag]')) return
  if (!scroller || fieldIds.length < 2) return
  const table = scroller.querySelector('table')
  const from = fieldIds.indexOf(fieldId)
  if (!table || from < 0) return

  const startClientX = e.clientX
  const startScroll = scroller.scrollLeft
  let lastClientX = startClientX
  let dragging = false
  let ended = false
  let slots = [] // { id, left, width } in content space, in current order
  let cells = {} // id -> [th, td, td, …]
  let curJ = from
  let curDx = 0
  let raf = 0
  let swallowClick = null

  const cellsOf = (id) => Array.from(table.querySelectorAll(`[data-field-id="${id}"]`))

  const start = () => {
    dragging = true
    slots = fieldIds.map((id) => {
      const th = table.querySelector(`th[data-field-id="${id}"]`)
      const r = th.getBoundingClientRect()
      return { id, left: r.left + scroller.scrollLeft, width: r.width }
    })
    cells = Object.fromEntries(fieldIds.map((id) => [id, cellsOf(id)]))
    for (const id of fieldIds) {
      const cls = id === fieldId ? 'st-col-drag' : 'st-col-shift'
      cells[id].forEach((c) => c.classList.add(cls))
    }
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    window.getSelection()?.removeAllRanges()
    // The mouse-up that ends a drag also produces a click on the header
    // (e.g. the rename button) — swallow that one click.
    swallowClick = (ev) => {
      ev.stopPropagation()
      ev.preventDefault()
    }
    window.addEventListener('click', swallowClick, true)
    raf = requestAnimationFrame(tick)
    update()
  }

  const setShifts = (j) => {
    const w = slots[from].width
    fieldIds.forEach((id, k) => {
      if (k === from) return
      let shift = 0
      if (from < j && k > from && k <= j) shift = -w
      else if (from > j && k >= j && k < from) shift = w
      const t = shift ? `translateX(${shift}px)` : ''
      cells[id].forEach((c) => (c.style.transform = t))
    })
  }

  const update = () => {
    const me = slots[from]
    const last = slots[slots.length - 1]
    const minDx = slots[0].left - me.left
    const maxDx = last.left + last.width - (me.left + me.width)
    const raw = lastClientX + scroller.scrollLeft - (startClientX + startScroll)
    curDx = Math.max(minDx, Math.min(maxDx, raw))
    cells[fieldId].forEach((c) => (c.style.transform = `translateX(${curDx}px)`))

    const center = me.left + me.width / 2 + curDx
    let j = slots.length - 1
    for (let k = 0; k < slots.length; k++) {
      if (center < slots[k].left + slots[k].width) {
        j = k
        break
      }
    }
    if (j !== curJ) {
      curJ = j
      setShifts(j)
    }
  }

  // Edge auto-scroll so a column can be carried past the visible area.
  const tick = () => {
    if (!dragging || ended) return
    const r = scroller.getBoundingClientRect()
    let speed = 0
    if (lastClientX > r.right - EDGE) speed = Math.min(1, (lastClientX - (r.right - EDGE)) / EDGE) * MAX_SCROLL_SPEED
    else if (lastClientX < r.left + EDGE) speed = -Math.min(1, (r.left + EDGE - lastClientX) / EDGE) * MAX_SCROLL_SPEED
    if (speed) {
      const before = scroller.scrollLeft
      scroller.scrollLeft = before + speed
      if (scroller.scrollLeft !== before) update()
    }
    raf = requestAnimationFrame(tick)
  }

  const cleanup = () => {
    for (const id of fieldIds) {
      ;(cells[id] || []).forEach((c) => {
        c.style.transform = ''
        c.classList.remove('st-col-drag', 'st-col-shift', 'st-col-settle')
      })
    }
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    setTimeout(() => window.removeEventListener('click', swallowClick, true), 0)
  }

  const finish = (commit) => {
    if (ended) return
    ended = true
    cancelAnimationFrame(raf)
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('pointercancel', onCancel)
    window.removeEventListener('keydown', onKey)
    if (!dragging) return

    const j = commit ? curJ : from
    // Where the dragged column ends up once the order changes.
    const order = fieldIds.filter((id) => id !== fieldId)
    order.splice(j, 0, fieldId)
    let newLeft = slots[0].left
    for (const id of order) {
      if (id === fieldId) break
      newLeft += slots.find((s) => s.id === id).width
    }
    const finalDx = newLeft - slots[from].left
    cells[fieldId].forEach((c) => {
      c.classList.add('st-col-settle')
      c.style.transform = `translateX(${finalDx}px)`
    })
    if (!commit) fieldIds.forEach((id) => id !== fieldId && cells[id].forEach((c) => (c.style.transform = '')))

    setTimeout(() => {
      if (j !== from) flushSync(() => onReorder(from, j))
      cleanup()
    }, SETTLE_MS)
  }

  const onMove = (ev) => {
    lastClientX = ev.clientX
    if (!dragging) {
      if (Math.abs(ev.clientX - startClientX) < THRESHOLD) return
      start()
      return
    }
    update()
  }
  const onUp = () => finish(true)
  const onCancel = () => finish(false)
  const onKey = (ev) => {
    if (ev.key === 'Escape') finish(false)
  }

  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', onUp)
  window.addEventListener('pointercancel', onCancel)
  window.addEventListener('keydown', onKey)
}
