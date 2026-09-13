import { jsPDF } from 'jspdf'
import {
  getKpis,
  getPnlStats,
  getStatusCounts,
  getDirectionCounts,
  getWinRateByDirection,
  getTopStocks,
  getTimeframeUsage,
  getQuickStats,
} from './tradeAnalytics'

// Trade Analysis → "Report" button. Builds a multi-page PDF entirely on
// the client with jsPDF: page 1 is a dashboard of analytics widgets (the
// same numbers the Analysis tab shows, via tradeAnalytics.js), then one
// page per logged trade with every field the entry form captures plus its
// setup (screenshotUrl) and result (resultImageUrl) images side by side.

const PAGE_W = 595.28 // A4 pt
const PAGE_H = 841.89
const MARGIN = 36

const INK = [30, 41, 59] // slate-800
const SLATE = [100, 116, 139] // slate-500
const LINE = [226, 232, 240] // slate-200
const ACCENT = [37, 99, 235] // blue-600
const GREEN = [22, 163, 74]
const RED = [220, 38, 38]
const AMBER = [217, 119, 6]
const CARD_BG = [248, 250, 252]

const fmtMoney = (n) => `${n < 0 ? '-' : ''}₹${Math.abs(Math.round(n)).toLocaleString('en-IN')}`
const fmtPct = (n) => (n == null ? '—' : `${n.toFixed(0)}%`)

// Turns any image source (data URL already, or a hosted http(s) URL) into
// a { dataUrl, format, width, height } object jsPDF's addImage can use.
// Hosted images are fetched and re-encoded as a data URL client-side so
// this works the same whether the trade's screenshot lives on Cloudinary,
// Supabase Storage, or was embedded as base64 locally. Returns null
// (instead of throwing) on any failure so one bad/expired image link
// doesn't stop the whole report from generating.
async function loadImage(url) {
  if (!url) return null
  try {
    let dataUrl = url
    if (!url.startsWith('data:')) {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`fetch failed (${res.status})`)
      const blob = await res.blob()
      dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    }
    const match = /^data:image\/(png|jpeg|jpg|webp)/i.exec(dataUrl)
    const format = match ? match[1].toUpperCase().replace('JPG', 'JPEG') : 'PNG'
    const { width, height } = await new Promise((resolve) => {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 })
      img.onerror = () => resolve({ width: 1, height: 1 })
      img.src = dataUrl
    })
    return { dataUrl, format, width, height }
  } catch {
    return null
  }
}

function statusColor(status) {
  if (status === 'Target Hit') return GREEN
  if (status === 'SL Hit') return RED
  return AMBER
}

// ---- small drawing helpers ------------------------------------------------

function header(doc, title, subtitle) {
  doc.setFillColor(...INK)
  doc.rect(0, 0, PAGE_W, 64, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(17)
  doc.text(title, MARGIN, 32)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(203, 213, 225)
  doc.text(subtitle, MARGIN, 48)
  doc.setTextColor(...INK)
}

function sectionTitle(doc, text, y, x = MARGIN, width = PAGE_W - MARGIN * 2) {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text(text, x, y)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.75)
  doc.line(x, y + 4, x + width, y + 4)
  return y + 20
}

// A row of equal-width stat cards, each with a label and a big value.
function statCards(doc, y, cards) {
  const gap = 10
  const w = (PAGE_W - MARGIN * 2 - gap * (cards.length - 1)) / cards.length
  const h = 52
  cards.forEach((c, i) => {
    const x = MARGIN + i * (w + gap)
    doc.setFillColor(...CARD_BG)
    doc.roundedRect(x, y, w, h, 5, 5, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...SLATE)
    doc.text(c.label.toUpperCase(), x + 8, y + 16)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...(c.color || INK))
    doc.text(String(c.value), x + 8, y + 37)
  })
  return y + h + 18
}

// A simple two-column label/value table (for breakdown lists).
function kvTable(doc, x, y, width, rows) {
  const rowH = 16
  rows.forEach((r, i) => {
    if (i % 2 === 0) {
      doc.setFillColor(...CARD_BG)
      doc.rect(x, y + i * rowH, width, rowH, 'F')
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...INK)
    doc.text(String(r[0]), x + 6, y + i * rowH + 11)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...(r[2] || INK))
    doc.text(String(r[1]), x + width - 6, y + i * rowH + 11, { align: 'right' })
  })
  return y + rows.length * rowH
}

function footer(doc, pageLabel) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...SLATE)
  doc.text(pageLabel, PAGE_W / 2, PAGE_H - 16, { align: 'center' })
}

// ---- page 1: analytics dashboard ------------------------------------------

function buildDashboardPage(doc, trades, scopeLabel) {
  const countLine = `${trades.length} trade${trades.length === 1 ? '' : 's'}${scopeLabel ? '' : ' logged'}`
  const subtitle = `Generated ${new Date().toLocaleString('en-IN')} · ${countLine}${scopeLabel ? ` · ${scopeLabel}` : ''}`
  header(doc, 'Trade Analysis Report', subtitle)

  let y = 90
  const kpis = getKpis(trades)
  const pnl = getPnlStats(trades)

  y = sectionTitle(doc, 'Overview', y)
  y = statCards(doc, y, [
    { label: 'Total Trades', value: kpis.total },
    { label: 'Win Rate', value: fmtPct(kpis.winRatePct), color: ACCENT },
    { label: 'Total P&L', value: kpis.tradesWithPnl ? fmtMoney(kpis.totalPnl) : '—', color: kpis.totalPnl >= 0 ? GREEN : RED },
    { label: 'Pending', value: kpis.pending, color: AMBER },
  ])

  y = statCards(doc, y - 8, [
    { label: 'Target Hit', value: kpis.targetHit, color: GREEN },
    { label: 'SL Hit', value: kpis.slHit, color: RED },
    { label: 'Avg P&L / trade', value: pnl.avgPnl == null ? '—' : fmtMoney(pnl.avgPnl) },
    { label: 'Best Trade', value: pnl.bestTrade ? fmtMoney(pnl.bestTrade.pnl) : '—', color: GREEN },
  ])

  const colW = (PAGE_W - MARGIN * 2 - 24) / 2
  const leftX = MARGIN
  const rightX = MARGIN + colW + 24
  let leftY = sectionTitle(doc, 'Status breakdown', y, leftX, colW)
  let rightY = sectionTitle(doc, 'Direction breakdown', y, rightX, colW)

  const status = getStatusCounts(trades)
  leftY = kvTable(doc, leftX, leftY, colW, [
    ['Target Hit', status.targetHit, GREEN],
    ['SL Hit', status.slHit, RED],
    ['Pending', status.pending, AMBER],
  ])

  const dir = getDirectionCounts(trades)
  const dirWr = getWinRateByDirection(trades)
  rightY = kvTable(doc, rightX, rightY, colW, [
    ['Buy trades', `${dir.buy} (${fmtPct(dirWr.Buy.winRatePct)} WR)`],
    ['Sell trades', `${dir.sell} (${fmtPct(dirWr.Sell.winRatePct)} WR)`],
  ])

  y = Math.max(leftY, rightY) + 24

  leftY = sectionTitle(doc, 'Most traded instruments', y, leftX, colW)
  const topStocks = getTopStocks(trades, 5)
  leftY = kvTable(
    doc,
    leftX,
    leftY,
    colW,
    topStocks.length ? topStocks.map((s) => [s.name, `${s.count} trade${s.count === 1 ? '' : 's'}`]) : [['No trades yet', '']]
  )

  rightY = sectionTitle(doc, 'Time frame usage', y, rightX, colW)
  const tfUsage = getTimeframeUsage(trades)
    .slice()
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
  rightY = kvTable(
    doc,
    rightX,
    rightY,
    colW,
    tfUsage.length ? tfUsage.map((t) => [t.name, `${t.count} trade${t.count === 1 ? '' : 's'}`]) : [['No trades yet', '']]
  )

  y = Math.max(leftY, rightY) + 24

  const quick = getQuickStats(trades)
  y = sectionTitle(doc, 'Quick stats', y)
  y = kvTable(doc, MARGIN, y, PAGE_W - MARGIN * 2, [
    ['Avg validation score', quick.avgScorePct == null ? '—' : fmtPct(quick.avgScorePct)],
    ['Most active instrument', quick.mostActive ? `${quick.mostActive.name} (${quick.mostActive.count})` : '—'],
    ['Trades logged this week', quick.weekCount],
    ['Oldest pending trade', quick.oldestPending ? `${quick.oldestPending.name} · ${quick.oldestPending.days}d ago` : '—'],
  ])

  footer(doc, 'Page 1 · Analytics overview')
}

// ---- one page per trade -----------------------------------------------

function ruleLabelMap(validationRules, validationCategories) {
  const catById = new Map(validationCategories.map((c) => [c.id, c.name]))
  const map = new Map()
  validationRules.forEach((r) => map.set(r.id, `${catById.get(r.categoryId) || 'General'} · ${r.label}`))
  return map
}

async function buildTradePage(doc, trade, index, total, ruleLabels) {
  header(doc, trade.instrumentName || trade.pair || 'Trade', `Trade ${index + 1} of ${total} · ${trade.date || '—'}`)

  let y = 88

  // Status pill + core fields row
  const [r, g, b] = statusColor(trade.status)
  doc.setFillColor(r, g, b)
  doc.roundedRect(MARGIN, y, 78, 18, 4, 4, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(trade.status || 'Pending', MARGIN + 39, y + 12.5, { align: 'center' })

  doc.setTextColor(...INK)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  const fieldsLine = `${trade.instrumentType || '—'}  ·  ${trade.timeframe || '—'}  ·  ${trade.direction || '—'}  ·  Entry ${trade.price ?? '—'}`
  doc.text(fieldsLine, MARGIN + 90, y + 12.5)

  y += 34
  y = kvTable(doc, MARGIN, y, PAGE_W - MARGIN * 2, [
    ['Pair', trade.pair || '—'],
    ['P&L', trade.pnl == null ? 'Not logged' : fmtMoney(trade.pnl), trade.pnl == null ? SLATE : trade.pnl >= 0 ? GREEN : RED],
    [
      'Validation score',
      trade.validationScore ? `${trade.validationScore.checked}/${trade.validationScore.total} rules checked` : 'No rules applied',
    ],
  ])
  y += 14

  // Notes
  y = sectionTitle(doc, 'Notes', y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...INK)
  const noteLines = doc.splitTextToSize(trade.notes?.trim() || 'No notes added for this trade.', PAGE_W - MARGIN * 2)
  doc.text(noteLines, MARGIN, y)
  y += noteLines.length * 12 + 14

  // Validation rules checked
  if ((trade.validationRuleIds || []).length) {
    y = sectionTitle(doc, 'Validation rules met', y)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    trade.validationRuleIds.forEach((id) => {
      const label = ruleLabels.get(id) || id
      doc.setTextColor(...GREEN)
      doc.text('✓', MARGIN, y)
      doc.setTextColor(...INK)
      doc.text(label, MARGIN + 12, y)
      y += 13
    })
    y += 8
  }

  // Images — setup (1st/entry screenshot) and result (final outcome),
  // side by side so the whole trade story reads in one glance.
  y = sectionTitle(doc, 'Screenshots', y)
  const boxW = (PAGE_W - MARGIN * 2 - 16) / 2
  const boxH = PAGE_H - y - 60
  const boxes = [
    { x: MARGIN, label: 'SETUP', url: trade.screenshotUrl },
    { x: MARGIN + boxW + 16, label: 'RESULT', url: trade.resultImageUrl },
  ]

  for (const box of boxes) {
    doc.setDrawColor(...LINE)
    doc.setLineWidth(1)
    doc.roundedRect(box.x, y, boxW, boxH, 6, 6)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...SLATE)
    doc.text(box.label, box.x + 8, y + 14)

    const img = await loadImage(box.url)
    const innerX = box.x + 8
    const innerY = y + 20
    const innerW = boxW - 16
    const innerH = boxH - 28
    if (img) {
      const scale = Math.min(innerW / img.width, innerH / img.height)
      const w = img.width * scale
      const h = img.height * scale
      const dx = innerX + (innerW - w) / 2
      const dy = innerY + (innerH - h) / 2
      try {
        doc.addImage(img.dataUrl, img.format, dx, dy, w, h)
      } catch {
        doc.setFontSize(9)
        doc.setTextColor(...SLATE)
        doc.text('Image could not be embedded', innerX + innerW / 2, innerY + innerH / 2, { align: 'center' })
      }
    } else {
      doc.setFontSize(9)
      doc.setTextColor(...SLATE)
      doc.text('No image', innerX + innerW / 2, innerY + innerH / 2, { align: 'center' })
    }
  }

  footer(doc, `Page ${index + 2} · ${trade.instrumentName || trade.pair || 'Trade'}`)
}

// Turns the scoping choices from ReportFiltersModal into the small
// subtitle line shown under the header on page 1, e.g.
// "Sep 1 – Sep 13, 2026 · Forex, Commodity" or "All trades logged".
function describeReportScope({ dateFrom, dateTo, types } = {}) {
  const parts = []
  if (dateFrom || dateTo) {
    const fmt = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    if (dateFrom && dateTo) parts.push(`${fmt(dateFrom)} – ${fmt(dateTo)}`)
    else if (dateFrom) parts.push(`From ${fmt(dateFrom)}`)
    else parts.push(`Up to ${fmt(dateTo)}`)
  }
  if (types && types.length) parts.push(types.join(', '))
  return parts.length ? parts.join(' · ') : null
}

// Public entry point — call from a click handler. Builds the whole PDF
// in memory and triggers a browser download; does not touch the store.
// `reportMeta` (optional) carries the date-range/type selection made in
// ReportFiltersModal purely for display in the header subtitle — the
// actual filtering already happened before `trades` got here.
export async function generateTradeReport(trades, validationRules = [], validationCategories = [], reportMeta) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const ruleLabels = ruleLabelMap(validationRules, validationCategories)

  buildDashboardPage(doc, trades, describeReportScope(reportMeta))

  // Newest first, matching the Table view's default order.
  const sorted = [...trades].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  for (let i = 0; i < sorted.length; i++) {
    doc.addPage()
    // eslint-disable-next-line no-await-in-loop
    await buildTradePage(doc, sorted[i], i, sorted.length, ruleLabels)
  }

  const stamp = new Date().toISOString().slice(0, 10)
  doc.save(`trade-report-${stamp}.pdf`)
}
