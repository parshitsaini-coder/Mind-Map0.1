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
import { splitTradesByCurrency, CURRENCY_GROUP_LABEL, symbolForType } from './currency'

// Trade Analysis → "Report" button. Builds a multi-page PDF entirely on
// the client with jsPDF: page 1 is a dashboard of analytics widgets (the
// same numbers the Analysis tab shows, via tradeAnalytics.js), then one
// page per logged trade with every field the entry form captures plus its
// setup (screenshotUrl) and result (resultImageUrl) images side by side.
//
// Visual language: every widget (stat card / table / screenshot box) is a
// bordered, tinted "card" — never a flat unbordered block — and the brand
// accent (the app's default "Classic" theme orange, #eb5e28) is used as a
// thread that ties the header, section markers, table dividers and image
// chips together, while semantic colors (green/red/amber) stay reserved
// for actual win/loss/pending meaning so they're never ambiguous.

const PAGE_W = 595.28 // A4 pt
const PAGE_H = 841.89
const MARGIN = 36

const INK = [15, 23, 42] // slate-900
const SLATE = [100, 116, 139] // slate-500
const LINE = [203, 213, 225] // slate-300 — card/table borders
const DIVIDER = [230, 235, 241] // faint row dividers

const ACCENT = [235, 94, 40] // brand orange (#eb5e28, matches the app's default theme)
const ACCENT_LIGHT = [253, 232, 220] // pale orange tint for chips/card backgrounds
const GREEN = [22, 163, 74]
const GREEN_LIGHT = [220, 252, 231]
const RED = [220, 38, 38]
const RED_LIGHT = [254, 226, 226]
const AMBER = [217, 119, 6]
const AMBER_LIGHT = [254, 243, 199]
const CARD_BG = [248, 250, 252] // slate-50 — neutral card fill

const fmtMoney = (n, symbol = '₹') => `${n < 0 ? '-' : ''}${symbol}${Math.abs(Math.round(n)).toLocaleString('en-IN')}`
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

// Maps a semantic color constant to its {bg, border} widget tint. Card
// callers pass one of GREEN/RED/AMBER/ACCENT/INK (or omit it) by reference,
// so a straight identity check is all that's needed here.
function widgetPalette(color) {
  if (color === GREEN) return { bg: GREEN_LIGHT, border: GREEN }
  if (color === RED) return { bg: RED_LIGHT, border: RED }
  if (color === AMBER) return { bg: AMBER_LIGHT, border: AMBER }
  if (color === ACCENT) return { bg: ACCENT_LIGHT, border: ACCENT }
  return { bg: CARD_BG, border: LINE }
}

// ---- small drawing helpers ------------------------------------------------

function header(doc, title, subtitle) {
  doc.setFillColor(...INK)
  doc.rect(0, 0, PAGE_W, 64, 'F')
  // Brand accent bar — the thread that ties every page back to the app.
  doc.setFillColor(...ACCENT)
  doc.rect(0, 64, PAGE_W, 3, 'F')

  // Small circular badge, top-right, echoing the app's own accent color.
  doc.setFillColor(...ACCENT)
  doc.circle(PAGE_W - MARGIN - 13, 28, 13, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(255, 255, 255)
  doc.text('TA', PAGE_W - MARGIN - 13, 31.5, { align: 'center' })

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
  // Small accent tick before the label, plus a two-tone underline (a short
  // accent-colored run fading into a thin neutral line) instead of one
  // flat gray rule — a cheap way to get a "highlighted" look without
  // true gradients.
  doc.setFillColor(...ACCENT)
  doc.roundedRect(x, y - 8, 3, 10, 1, 1, 'F')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...INK)
  doc.text(text, x + 9, y)

  const accentW = Math.min(34, width)
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(1.25)
  doc.line(x, y + 5, x + accentW, y + 5)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.75)
  doc.line(x + accentW, y + 5, x + width, y + 5)
  return y + 20
}

// A row of equal-width stat cards, each with a tinted background, a
// border in its own semantic color, and a small color-matched accent
// bar on the left edge — a proper "widget" look instead of a flat block.
function statCards(doc, y, cards) {
  const gap = 10
  const w = (PAGE_W - MARGIN * 2 - gap * (cards.length - 1)) / cards.length
  const h = 56
  cards.forEach((c, i) => {
    const x = MARGIN + i * (w + gap)
    const { bg, border } = widgetPalette(c.color)
    doc.setFillColor(...bg)
    doc.setDrawColor(...border)
    doc.setLineWidth(0.9)
    doc.roundedRect(x, y, w, h, 6, 6, 'FD')

    doc.setFillColor(...border)
    doc.roundedRect(x, y + 8, 3.2, h - 16, 1.6, 1.6, 'F')

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...SLATE)
    doc.text(c.label.toUpperCase(), x + 13, y + 19)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...(c.color || INK))
    doc.text(String(c.value), x + 13, y + 41)
  })
  return y + h + 18
}

// A two-column label/value table, now wrapped in its own bordered,
// rounded card with faint row dividers instead of a flat, borderless
// alternating-stripe block.
function kvTable(doc, x, y, width, rows) {
  const rowH = 17
  const totalH = rows.length * rowH

  doc.setFillColor(255, 255, 255)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.9)
  doc.roundedRect(x, y, width, totalH, 5, 5, 'FD')

  rows.forEach((r, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(...CARD_BG)
      doc.rect(x + 1, y + i * rowH, width - 2, rowH, 'F')
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...SLATE)
    doc.text(String(r[0]), x + 10, y + i * rowH + 11.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...(r[2] || INK))
    doc.text(String(r[1]), x + width - 10, y + i * rowH + 11.5, { align: 'right' })

    if (i < rows.length - 1) {
      doc.setDrawColor(...DIVIDER)
      doc.setLineWidth(0.5)
      doc.line(x + 10, y + (i + 1) * rowH, x + width - 10, y + (i + 1) * rowH)
    }
  })
  return y + totalH
}

function footer(doc, pageLabel) {
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.6)
  doc.line(MARGIN, PAGE_H - 28, PAGE_W - MARGIN, PAGE_H - 28)
  doc.setFillColor(...ACCENT)
  doc.circle(PAGE_W / 2 - doc.getTextWidth(pageLabel) / 2 - 8, PAGE_H - 17, 1.6, 'F')
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

  let y = 92
  const kpis = getKpis(trades)
  const { INR: equityTrades, USD: fxTrades } = splitTradesByCurrency(trades)
  const equityPnl = getPnlStats(equityTrades)
  const fxPnl = getPnlStats(fxTrades)

  // Overview intentionally excludes any money figure here — Equity (₹)
  // and Forex/Commodity ($) trades can never be summed into one "Total
  // P&L" without the number becoming meaningless, so every P&L figure
  // lives in the currency-scoped "P&L breakdown" section below instead.
  y = sectionTitle(doc, 'Overview', y)
  y = statCards(doc, y, [
    { label: 'Total Trades', value: kpis.total },
    { label: 'Win Rate', value: fmtPct(kpis.winRatePct), color: ACCENT },
    { label: 'Pending', value: kpis.pending, color: AMBER },
  ])

  y = statCards(doc, y - 8, [
    { label: 'Target Hit', value: kpis.targetHit, color: GREEN },
    { label: 'SL Hit', value: kpis.slHit, color: RED },
  ])

  const colW = (PAGE_W - MARGIN * 2 - 24) / 2
  const leftX = MARGIN
  const rightX = MARGIN + colW + 24

  // P&L breakdown — Equity (₹) and Forex/Commodity ($) always shown
  // side by side in their own currency, never summed together.
  let pnlLeftY = sectionTitle(doc, `${CURRENCY_GROUP_LABEL.INR} P&L (₹)`, y, leftX, colW)
  let pnlRightY = sectionTitle(doc, `${CURRENCY_GROUP_LABEL.USD} P&L ($)`, y, rightX, colW)

  pnlLeftY = kvTable(doc, leftX, pnlLeftY, colW, [
    ['Total P&L', equityPnl.tradesWithPnl ? fmtMoney(equityPnl.totalPnl, '₹') : '—', equityPnl.totalPnl >= 0 ? GREEN : RED],
    ['Avg P&L / trade', equityPnl.avgPnl == null ? '—' : fmtMoney(equityPnl.avgPnl, '₹')],
    ['Best trade', equityPnl.bestTrade ? fmtMoney(equityPnl.bestTrade.pnl, '₹') : '—', GREEN],
    ['Worst trade', equityPnl.worstTrade ? fmtMoney(equityPnl.worstTrade.pnl, '₹') : '—', RED],
  ])

  pnlRightY = kvTable(doc, rightX, pnlRightY, colW, [
    ['Total P&L', fxPnl.tradesWithPnl ? fmtMoney(fxPnl.totalPnl, '$') : '—', fxPnl.totalPnl >= 0 ? GREEN : RED],
    ['Avg P&L / trade', fxPnl.avgPnl == null ? '—' : fmtMoney(fxPnl.avgPnl, '$')],
    ['Best trade', fxPnl.bestTrade ? fmtMoney(fxPnl.bestTrade.pnl, '$') : '—', GREEN],
    ['Worst trade', fxPnl.worstTrade ? fmtMoney(fxPnl.worstTrade.pnl, '$') : '—', RED],
  ])

  y = Math.max(pnlLeftY, pnlRightY) + 24

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
    ['P&L', trade.pnl == null ? 'Not logged' : fmtMoney(trade.pnl, symbolForType(trade.instrumentType)), trade.pnl == null ? SLATE : trade.pnl >= 0 ? GREEN : RED],
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
      doc.setFillColor(...GREEN_LIGHT)
      doc.circle(MARGIN + 4, y - 3, 5, 'F')
      doc.setTextColor(...GREEN)
      doc.setFont('helvetica', 'bold')
      doc.text('✓', MARGIN + 1.6, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...INK)
      doc.text(label, MARGIN + 16, y)
      y += 14
    })
    y += 8
  }

  // Images — setup (1st/entry screenshot) and result (final outcome),
  // side by side so the whole trade story reads in one glance. Each box
  // is a bordered card with a tinted, accent-colored label chip.
  y = sectionTitle(doc, 'Screenshots', y)
  const boxW = (PAGE_W - MARGIN * 2 - 16) / 2
  const boxH = PAGE_H - y - 60
  const boxes = [
    { x: MARGIN, label: 'SETUP', url: trade.screenshotUrl },
    { x: MARGIN + boxW + 16, label: 'RESULT', url: trade.resultImageUrl },
  ]

  for (const box of boxes) {
    doc.setFillColor(...CARD_BG)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(1)
    doc.roundedRect(box.x, y, boxW, boxH, 8, 8, 'FD')

    doc.setFillColor(...ACCENT_LIGHT)
    doc.roundedRect(box.x + 8, y + 8, 48, 14, 4, 4, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...ACCENT)
    doc.text(box.label, box.x + 32, y + 17, { align: 'center' })

    const img = await loadImage(box.url)
    const innerX = box.x + 8
    const innerY = y + 30
    const innerW = boxW - 16
    const innerH = boxH - 38
    if (img) {
      const scale = Math.min(innerW / img.width, innerH / img.height)
      const w = img.width * scale
      const h = img.height * scale
      const dx = innerX + (innerW - w) / 2
      const dy = innerY + (innerH - h) / 2
      try {
        doc.addImage(img.dataUrl, img.format, dx, dy, w, h)
        doc.setDrawColor(...LINE)
        doc.setLineWidth(0.75)
        doc.roundedRect(dx, dy, w, h, 3, 3)
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
