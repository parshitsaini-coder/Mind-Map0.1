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
const NAVY = [11, 18, 32] // header gradient start
const NAVY2 = [33, 48, 78] // header gradient end

// jsPDF's built-in Helvetica has no rupee glyph (it prints blank), so the PDF
// spells it "Rs." — every other symbol passes through unchanged.
const pdfSym = (symbol) => (symbol === '₹' ? 'Rs. ' : symbol)
const fmtMoney = (n, symbol = '₹') => `${n < 0 ? '-' : ''}${pdfSym(symbol)}${Math.abs(Math.round(n)).toLocaleString('en-IN')}`
const fmtSigned = (n, symbol = '₹') => `${n > 0 ? '+' : ''}${fmtMoney(n, symbol)}`
const fmtPct = (n) => (n == null ? '—' : `${n.toFixed(0)}%`)

// Turns any image source (data URL already, or a hosted http(s) URL) into
// a { dataUrl, format, width, height } object jsPDF's addImage can use.
// Hosted images are fetched and re-encoded as a data URL client-side so
// this works the same whether the trade's screenshot lives on Cloudinary,
// Supabase Storage, or was embedded as base64 locally. Returns null
// (instead of throwing) on any failure so one bad/expired image link
// doesn't stop the whole report from generating.
//
// `quality` (see QUALITY_PRESETS below) controls how the image gets
// re-encoded before it goes in the PDF: every image is drawn onto an
// offscreen canvas capped at the preset's max dimension (never upscaled,
// only ever shrunk) and re-exported as JPEG at the preset's compression
// level. This is what actually makes "Low/Standard/High" mean something —
// jsPDF just embeds whatever bytes it's handed, so the size/quality
// trade-off has to happen here, before addImage ever sees the picture.
const QUALITY_PRESETS = {
  low: { maxDim: 480, jpegQuality: 0.45 },
  standard: { maxDim: 900, jpegQuality: 0.72 },
  high: { maxDim: 1600, jpegQuality: 0.92 },
}

function resizeToJpeg(img, dataUrl, preset) {
  const scale = Math.min(1, preset.maxDim / Math.max(img.width, img.height))
  // Nothing to gain by re-encoding a PNG we're not shrinking at the
  // highest quality tier — skip the canvas round-trip and keep the
  // original bytes/format as-is.
  if (scale >= 1 && preset === QUALITY_PRESETS.high) return { dataUrl, width: img.width, height: img.height, format: null }

  const w = Math.max(1, Math.round(img.width * scale))
  const h = Math.max(1, Math.round(img.height * scale))
  try {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    // Flatten onto white first — JPEG has no alpha channel, and a
    // screenshot with transparent corners would otherwise turn black.
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img.el, 0, 0, w, h)
    return { dataUrl: canvas.toDataURL('image/jpeg', preset.jpegQuality), width: w, height: h, format: 'JPEG' }
  } catch {
    // Canvas can throw on a tainted (cross-origin, no CORS headers)
    // image — fall back to embedding the original bytes unresized rather
    // than dropping the picture from the report entirely.
    return { dataUrl, width: img.width, height: img.height, format: null }
  }
}

async function loadImage(url, quality = 'standard') {
  if (!url) return null
  const preset = QUALITY_PRESETS[quality] || QUALITY_PRESETS.standard
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
    const el = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = dataUrl
    })
    const resized = resizeToJpeg({ el, width: el.naturalWidth || 1, height: el.naturalHeight || 1 }, dataUrl, preset)
    let format = resized.format
    if (!format) {
      const match = /^data:image\/(png|jpeg|jpg|webp)/i.exec(dataUrl)
      format = match ? match[1].toUpperCase().replace('JPG', 'JPEG') : 'PNG'
    }
    return { dataUrl: resized.dataUrl, format, width: resized.width, height: resized.height }
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

const lerp = (a, b, t) => Math.round(a + (b - a) * t)

// jsPDF has no gradient fill, so a horizontal gradient is a run of thin
// rects with interpolated colours (overlapping a hair to avoid seams).
function gradientRect(doc, x, y, w, h, c1, c2, steps = 56) {
  const sw = w / steps
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    doc.setFillColor(lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t))
    doc.rect(x + i * sw, y, sw + 0.7, h, 'F')
  }
}

const HEADER_H = 88

function header(doc, title, subtitle, kicker = 'TRADE ANALYSIS') {
  gradientRect(doc, 0, 0, PAGE_W, HEADER_H, NAVY, NAVY2)

  // Soft decorative circles (7% white) — depth without clutter.
  try {
    doc.saveGraphicsState()
    doc.setGState(new doc.GState({ opacity: 0.07 }))
    doc.setFillColor(255, 255, 255)
    doc.circle(PAGE_W - 46, 6, 72, 'F')
    doc.circle(PAGE_W - 150, HEADER_H - 6, 40, 'F')
    doc.restoreGraphicsState()
  } catch {
    /* older jsPDF: skip the decoration */
  }

  // Accent line under the band — the brand thread through every page.
  doc.setFillColor(...ACCENT)
  doc.rect(0, HEADER_H, PAGE_W, 3, 'F')

  // Brand tile, top-right.
  doc.setFillColor(...ACCENT)
  doc.roundedRect(PAGE_W - MARGIN - 36, 26, 36, 36, 8, 8, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(255, 255, 255)
  doc.text('TA', PAGE_W - MARGIN - 18, 48.5, { align: 'center' })

  // Kicker (small caps, tracked) + title + subtitle.
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...ACCENT)
  doc.text(kicker, MARGIN, 27, { charSpace: 1.6 })

  const maxTitleW = PAGE_W - MARGIN * 2 - 56
  let fs = 22
  doc.setFontSize(fs)
  while (fs > 13 && doc.getTextWidth(title) > maxTitleW) {
    fs -= 1
    doc.setFontSize(fs)
  }
  doc.setTextColor(255, 255, 255)
  doc.text(title, MARGIN, 52)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(176, 190, 208)
  const sub = doc.splitTextToSize(subtitle, maxTitleW)[0]
  doc.text(sub, MARGIN, 70)
  doc.setTextColor(...INK)
}

function sectionTitle(doc, text, y, x = MARGIN, width = PAGE_W - MARGIN * 2) {
  doc.setFillColor(...ACCENT)
  doc.roundedRect(x, y - 9, 3.5, 12, 1.2, 1.2, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11.5)
  doc.setTextColor(...INK)
  doc.text(text, x + 10, y)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.7)
  doc.line(x, y + 7, x + width, y + 7)
  return y + 24
}

// A card: faint offset "shadow", white body, hairline border.
function card(doc, x, y, w, h, fill = [255, 255, 255]) {
  doc.setFillColor(226, 232, 240)
  doc.roundedRect(x + 0.8, y + 1.6, w, h, 7, 7, 'F')
  doc.setFillColor(...fill)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.8)
  doc.roundedRect(x, y, w, h, 7, 7, 'FD')
}

const smallCaps = (doc, text, x, y, opts = {}) => {
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.8)
  doc.setTextColor(...SLATE)
  doc.text(String(text).toUpperCase(), x, y, { charSpace: 0.9, ...opts })
}

// A row of equal KPI cards: tracked label, big numeral, tinted top tab.
function statCards(doc, y, cards) {
  const gap = 10
  const w = (PAGE_W - MARGIN * 2 - gap * (cards.length - 1)) / cards.length
  const h = 62
  cards.forEach((c, i) => {
    const x = MARGIN + i * (w + gap)
    const { border } = widgetPalette(c.color)
    card(doc, x, y, w, h)
    doc.setFillColor(...border)
    doc.roundedRect(x + 10, y, w - 20, 3.2, 1.6, 1.6, 'F')
    smallCaps(doc, c.label, x + 12, y + 21)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(21)
    doc.setTextColor(...(c.color || INK))
    doc.text(String(c.value), x + 12, y + 48)
  })
  return y + h + 16
}

// Stacked outcome bar: Target Hit / SL Hit / Pending shares of all trades.
function outcomeBar(doc, y, hit, sl, pending) {
  const total = hit + sl + pending
  const x = MARGIN
  const w = PAGE_W - MARGIN * 2
  smallCaps(doc, 'Outcome split', x, y)
  y += 8
  doc.setFillColor(...DIVIDER)
  doc.roundedRect(x, y, w, 8, 4, 4, 'F')
  if (total > 0) {
    const parts = [
      { n: hit, c: GREEN },
      { n: sl, c: RED },
      { n: pending, c: AMBER },
    ].filter((p) => p.n > 0)
    let cx = x
    parts.forEach((p, i) => {
      const pw = (p.n / total) * w
      doc.setFillColor(...p.c)
      const inset = i === parts.length - 1 ? 0 : 1.2 // thin white gap between segments
      doc.rect(cx, y, Math.max(0.5, pw - inset), 8, 'F')
      cx += pw
    })
    // Round the two outer ends by masking the corners in white.
    doc.setFillColor(255, 255, 255)
    doc.rect(x - 1, y - 1, 1.2, 10, 'F')
    doc.rect(x + w - 0.2, y - 1, 1.4, 10, 'F')
  }
  y += 22
  const legend = [
    ['Target Hit', hit, GREEN],
    ['SL Hit', sl, RED],
    ['Pending', pending, AMBER],
  ]
  let lx = x
  legend.forEach(([label, n, c]) => {
    doc.setFillColor(...c)
    doc.circle(lx + 3, y - 2.6, 2.6, 'F')
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...SLATE)
    const pct = total ? ` · ${Math.round((n / total) * 100)}%` : ''
    const t = `${label}  ${n}${pct}`
    doc.text(t, lx + 10, y)
    lx += doc.getTextWidth(t) + 30
  })
  return y + 18
}

// Big P&L card for one currency group: hero total + avg / best / worst.
function pnlHero(doc, x, y, w, title, stats, symbol) {
  const h = 98
  card(doc, x, y, w, h)
  smallCaps(doc, title, x + 14, y + 20)
  const has = stats.tradesWithPnl > 0
  const total = has ? fmtSigned(stats.totalPnl, symbol) : '—'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(...(!has ? SLATE : stats.totalPnl >= 0 ? GREEN : RED))
  doc.text(total, x + 14, y + 48)
  doc.setDrawColor(...DIVIDER)
  doc.setLineWidth(0.6)
  doc.line(x + 14, y + 60, x + w - 14, y + 60)
  const cols = [
    ['Avg / trade', stats.avgPnl == null ? '—' : fmtMoney(stats.avgPnl, symbol), INK],
    ['Best', stats.bestTrade ? fmtMoney(stats.bestTrade.pnl, symbol) : '—', GREEN],
    ['Worst', stats.worstTrade ? fmtMoney(stats.worstTrade.pnl, symbol) : '—', RED],
  ]
  const cw = (w - 28) / 3
  cols.forEach(([label, val, color], i) => {
    smallCaps(doc, label, x + 14 + i * cw, y + 74)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...color)
    doc.text(val, x + 14 + i * cw, y + 89)
  })
  return y + h + 16
}

// Two-column label/value table in a card with faint row dividers.
function kvTable(doc, x, y, width, rows) {
  const rowH = 19
  const totalH = rows.length * rowH
  card(doc, x, y, width, totalH)
  rows.forEach((r, i) => {
    if (i % 2 === 1) {
      doc.setFillColor(...CARD_BG)
      doc.rect(x + 1, y + i * rowH, width - 2, rowH, 'F')
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...SLATE)
    doc.text(String(r[0]), x + 12, y + i * rowH + 12.8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...(r[2] || INK))
    doc.text(String(r[1]), x + width - 12, y + i * rowH + 12.8, { align: 'right' })
    if (i < rows.length - 1) {
      doc.setDrawColor(...DIVIDER)
      doc.setLineWidth(0.5)
      doc.line(x + 12, y + (i + 1) * rowH, x + width - 12, y + (i + 1) * rowH)
    }
  })
  return y + totalH + 4
}

// Rounded pill; returns its width so callers can flow chips in a row.
function chip(doc, x, y, text, { fill, color, h = 17, fs = 8.5, padX = 9, bold = true } = {}) {
  doc.setFont('helvetica', bold ? 'bold' : 'normal')
  doc.setFontSize(fs)
  const w = doc.getTextWidth(text) + padX * 2
  doc.setFillColor(...fill)
  doc.roundedRect(x, y, w, h, h / 2, h / 2, 'F')
  doc.setTextColor(...color)
  doc.text(text, x + w / 2, y + h / 2 + fs * 0.35, { align: 'center' })
  return w
}

// Final pass — "Trade Analysis Report · <label>" left, "Page i of n" right.
function applyFooters(doc, labels) {
  const n = doc.getNumberOfPages()
  for (let i = 1; i <= n; i++) {
    doc.setPage(i)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.6)
    doc.line(MARGIN, PAGE_H - 30, PAGE_W - MARGIN, PAGE_H - 30)
    doc.setFillColor(...ACCENT)
    doc.rect(MARGIN, PAGE_H - 22.5, 5, 5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...INK)
    doc.text('Trade Analysis Report', MARGIN + 11, PAGE_H - 18)
    const tag = labels[i - 1] ? `  ·  ${labels[i - 1]}` : ''
    if (tag) {
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...SLATE)
      doc.text(tag, MARGIN + 11 + doc.getTextWidth('Trade Analysis Report') + 0, PAGE_H - 18)
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...SLATE)
    doc.text(`Page ${i} of ${n}`, PAGE_W - MARGIN, PAGE_H - 18, { align: 'right' })
  }
}

// ---- page 1: analytics dashboard ------------------------------------------

function buildDashboardPage(doc, trades, scopeLabel) {
  const countLine = `${trades.length} trade${trades.length === 1 ? '' : 's'}${scopeLabel ? '' : ' logged'}`
  const subtitle = `Generated ${new Date().toLocaleString('en-IN')}  ·  ${countLine}${scopeLabel ? `  ·  ${scopeLabel}` : ''}`
  header(doc, 'Trade Analysis Report', subtitle, 'PERFORMANCE OVERVIEW')

  let y = HEADER_H + 34
  const kpis = getKpis(trades)
  const { INR: equityTrades, USD: fxTrades } = splitTradesByCurrency(trades)
  const equityPnl = getPnlStats(equityTrades)
  const fxPnl = getPnlStats(fxTrades)

  // Money is never summed across currencies — Equity (INR) and
  // Forex/Commodity (USD) each get their own P&L card below.
  y = sectionTitle(doc, 'Overview', y)
  y = statCards(doc, y, [
    { label: 'Total trades', value: kpis.total },
    { label: 'Win rate', value: fmtPct(kpis.winRatePct), color: ACCENT },
    { label: 'Target hit', value: kpis.targetHit, color: GREEN },
    { label: 'SL hit', value: kpis.slHit, color: RED },
    { label: 'Pending', value: kpis.pending, color: AMBER },
  ])
  y = outcomeBar(doc, y, kpis.targetHit, kpis.slHit, kpis.pending)

  const colW = (PAGE_W - MARGIN * 2 - 20) / 2
  const leftX = MARGIN
  const rightX = MARGIN + colW + 20

  y = sectionTitle(doc, 'Profit & loss', y)
  const p1 = pnlHero(doc, leftX, y, colW, `${CURRENCY_GROUP_LABEL.INR} · INR`, equityPnl, '₹')
  pnlHero(doc, rightX, y, colW, `${CURRENCY_GROUP_LABEL.USD} · USD`, fxPnl, '$')
  y = p1 + 6

  let leftY = sectionTitle(doc, 'Direction breakdown', y, leftX, colW)
  let rightY = sectionTitle(doc, 'Most traded instruments', y, rightX, colW)

  const dir = getDirectionCounts(trades)
  const dirWr = getWinRateByDirection(trades)
  leftY = kvTable(doc, leftX, leftY, colW, [
    ['Buy trades', `${dir.buy}  (${fmtPct(dirWr.Buy.winRatePct)} win rate)`],
    ['Sell trades', `${dir.sell}  (${fmtPct(dirWr.Sell.winRatePct)} win rate)`],
  ])

  const topStocks = getTopStocks(trades, 5)
  rightY = kvTable(
    doc,
    rightX,
    rightY,
    colW,
    topStocks.length ? topStocks.map((s) => [s.name, `${s.count} trade${s.count === 1 ? '' : 's'}`]) : [['No trades yet', '']]
  )
  y = Math.max(leftY, rightY) + 18

  leftY = sectionTitle(doc, 'Time frame usage', y, leftX, colW)
  rightY = sectionTitle(doc, 'Quick stats', y, rightX, colW)
  const tfUsage = getTimeframeUsage(trades).slice().sort((a, b) => b.count - a.count).slice(0, 5)
  leftY = kvTable(
    doc,
    leftX,
    leftY,
    colW,
    tfUsage.length ? tfUsage.map((t) => [t.name, `${t.count} trade${t.count === 1 ? '' : 's'}`]) : [['No trades yet', '']]
  )
  const quick = getQuickStats(trades)
  rightY = kvTable(doc, rightX, rightY, colW, [
    ['Avg validation score', quick.avgScorePct == null ? '—' : fmtPct(quick.avgScorePct)],
    ['Most active', quick.mostActive ? `${quick.mostActive.name} (${quick.mostActive.count})` : '—'],
    ['Logged this week', quick.weekCount],
    ['Oldest pending', quick.oldestPending ? `${quick.oldestPending.name} · ${quick.oldestPending.days}d` : '—'],
  ])
}

// ---- one page per trade -----------------------------------------------

function ruleLabelMap(validationRules, validationCategories) {
  const catById = new Map(validationCategories.map((c) => [c.id, c.name]))
  const map = new Map()
  validationRules.forEach((r) => map.set(r.id, `${catById.get(r.categoryId) || 'General'} · ${r.label}`))
  return map
}

const ellipsize = (doc, text, maxW) => {
  if (doc.getTextWidth(text) <= maxW) return text
  let t = text
  while (t.length > 3 && doc.getTextWidth(`${t}…`) > maxW) t = t.slice(0, -1)
  return `${t}…`
}

async function buildTradePage(doc, trade, index, total, ruleLabels, quality) {
  header(doc, trade.instrumentName || trade.pair || 'Trade', `Trade ${index + 1} of ${total}  ·  ${trade.date || '—'}  ·  ${trade.pair || ''}`, 'TRADE DETAIL')

  let y = HEADER_H + 24
  const inner = PAGE_W - MARGIN * 2

  // Left: direction + status + setup chips. Right: P&L hero figure.
  const isBuy = trade.direction === 'Buy'
  let cx = MARGIN
  cx += chip(doc, cx, y, (trade.direction || '—').toUpperCase(), { fill: isBuy ? GREEN : RED, color: [255, 255, 255], fs: 8 }) + 6
  const [sr, sg, sb] = statusColor(trade.status)
  const statusLight = trade.status === 'Target Hit' ? GREEN_LIGHT : trade.status === 'SL Hit' ? RED_LIGHT : AMBER_LIGHT
  cx += chip(doc, cx, y, trade.status || 'Pending', { fill: statusLight, color: [sr, sg, sb], fs: 8.5 }) + 6
  for (const name of trade.setupTypes || []) {
    if (cx > MARGIN + inner * 0.62) break
    cx += chip(doc, cx, y, name, { fill: ACCENT_LIGHT, color: [180, 70, 20], fs: 8, bold: false }) + 5
  }

  const sym = symbolForType(trade.instrumentType)
  smallCaps(doc, 'Profit / loss', PAGE_W - MARGIN, y - 2, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  if (trade.pnl == null) {
    doc.setFontSize(12)
    doc.setTextColor(...SLATE)
    doc.text('Not logged', PAGE_W - MARGIN, y + 18, { align: 'right' })
  } else {
    doc.setFontSize(24)
    doc.setTextColor(...(trade.pnl >= 0 ? GREEN : RED))
    doc.text(fmtSigned(trade.pnl, sym), PAGE_W - MARGIN, y + 22, { align: 'right' })
  }
  y += 40

  // Four metric tiles.
  const score = trade.validationScore
  const tiles = [
    ['Instrument type', trade.instrumentType || '—'],
    ['Time frame', trade.timeframe || '—'],
    ['Entry price', trade.price != null && trade.price !== '' ? `${pdfSym(sym)}${trade.price}` : '—'],
    ['Validation', score ? `${score.checked} / ${score.total} rules` : 'None applied'],
  ]
  const tg = 8
  const tw = (inner - tg * (tiles.length - 1)) / tiles.length
  tiles.forEach(([label, value], i) => {
    const tx = MARGIN + i * (tw + tg)
    doc.setFillColor(...CARD_BG)
    doc.setDrawColor(...LINE)
    doc.setLineWidth(0.7)
    doc.roundedRect(tx, y, tw, 40, 6, 6, 'FD')
    smallCaps(doc, label, tx + 10, y + 15)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...INK)
    doc.text(ellipsize(doc, String(value), tw - 20), tx + 10, y + 31)
  })
  y += 40 + 22

  // Notes — card with an accent spine.
  y = sectionTitle(doc, 'Notes', y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  let noteLines = doc.splitTextToSize(trade.notes?.trim() || 'No notes added for this trade.', inner - 28)
  if (noteLines.length > 10) noteLines = [...noteLines.slice(0, 9), `${noteLines[9].slice(0, 80)}…`]
  const noteH = noteLines.length * 12.5 + 18
  doc.setFillColor(...CARD_BG)
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.7)
  doc.roundedRect(MARGIN, y - 4, inner, noteH, 6, 6, 'FD')
  doc.setFillColor(...ACCENT)
  doc.roundedRect(MARGIN, y - 4, 3.5, noteH, 1.5, 1.5, 'F')
  doc.setTextColor(...(trade.notes?.trim() ? INK : SLATE))
  doc.text(noteLines, MARGIN + 16, y + 10)
  y += noteH + 16

  // Validation rules met — wrapped green chips with a drawn tick.
  const ruleIds = trade.validationRuleIds || []
  if (ruleIds.length) {
    y = sectionTitle(doc, 'Validation rules met', y)
    let rx = MARGIN
    let ry = y - 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    for (const id of ruleIds) {
      const label = ellipsize(doc, ruleLabels.get(id) || id, 230)
      const w = doc.getTextWidth(label) + 28
      if (rx + w > MARGIN + inner) {
        rx = MARGIN
        ry += 22
      }
      doc.setFillColor(...GREEN_LIGHT)
      doc.roundedRect(rx, ry, w, 17, 8.5, 8.5, 'F')
      doc.setDrawColor(...GREEN)
      doc.setLineWidth(1.3)
      doc.line(rx + 7, ry + 8.8, rx + 9.4, ry + 11.4)
      doc.line(rx + 9.4, ry + 11.4, rx + 14, ry + 5.8)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(...INK)
      doc.text(label, rx + 20, ry + 11.6)
      rx += w + 6
    }
    y = ry + 17 + 18
  }

  // Images — Setup + Result always; Order details / Final P&L join them
  // (2x2 grid) only when this trade has them.
  y = sectionTitle(doc, 'Screenshots', y)
  const imageBoxes = [
    { label: 'SETUP', url: trade.screenshotUrl },
    { label: 'RESULT', url: trade.resultImageUrl },
    ...(trade.orderImageUrl ? [{ label: 'ORDER DETAILS', url: trade.orderImageUrl }] : []),
    ...(trade.pnlImageUrl ? [{ label: 'FINAL P&L', url: trade.pnlImageUrl }] : []),
  ]
  const gap = 14
  const boxW = (inner - gap) / 2
  const rows = Math.ceil(imageBoxes.length / 2)
  const availH = PAGE_H - y - 48
  const boxH = Math.max(110, (availH - gap * (rows - 1)) / rows)
  const boxes = imageBoxes.map((bx, i) => ({
    ...bx,
    x: MARGIN + (i % 2) * (boxW + gap),
    y: y + Math.floor(i / 2) * (boxH + gap),
  }))

  for (const box of boxes) {
    card(doc, box.x, box.y, boxW, boxH, CARD_BG)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.2)
    const chipW = doc.getTextWidth(box.label) + 20
    doc.setFillColor(...ACCENT)
    doc.roundedRect(box.x + 9, box.y + 9, chipW, 14, 7, 7, 'F')
    doc.setTextColor(255, 255, 255)
    doc.text(box.label, box.x + 9 + chipW / 2, box.y + 18.8, { align: 'center', charSpace: 0.6 })

    const img = await loadImage(box.url, quality)
    const innerX = box.x + 9
    const innerY = box.y + 32
    const innerW = boxW - 18
    const innerH = boxH - 41
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
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...SLATE)
        doc.text('Image could not be embedded', innerX + innerW / 2, innerY + innerH / 2, { align: 'center' })
      }
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...SLATE)
      doc.text('No image', innerX + innerW / 2, innerY + innerH / 2, { align: 'center' })
    }
  }
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
// actual filtering already happened before `trades` got here. `quality`
// ('low' | 'standard' | 'high', default 'standard') controls how the
// setup/result screenshots get compressed — see QUALITY_PRESETS above.
export async function generateTradeReport(trades, validationRules = [], validationCategories = [], reportMeta, quality = 'standard') {
  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
  const ruleLabels = ruleLabelMap(validationRules, validationCategories)

  const footerLabels = ['Performance overview']
  buildDashboardPage(doc, trades, describeReportScope(reportMeta))

  // Newest first, matching the Table view's default order.
  const sorted = [...trades].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
  for (let i = 0; i < sorted.length; i++) {
    doc.addPage()
    // eslint-disable-next-line no-await-in-loop
    await buildTradePage(doc, sorted[i], i, sorted.length, ruleLabels, quality)
    footerLabels.push(sorted[i].instrumentName || sorted[i].pair || 'Trade')
  }
  applyFooters(doc, footerLabels)

  const stamp = new Date().toISOString().slice(0, 10)
  doc.save(`trade-report-${stamp}.pdf`)
}
