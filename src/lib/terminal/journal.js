// Bridge: demo-terminal closed trade  ->  an entry for the existing Trade Analysis journal.
// The entry uses ONLY the fields TradeForm/importTrades already produce (Trade Analysis has no
// SL/TP columns, so those go into the notes) — its data shape is left untouched.

const TA_INSTRUMENT = {
  EURUSD: { pair: 'EUR/USD', name: 'Euro / US Dollar', type: 'Forex' },
  GBPUSD: { pair: 'GBP/USD', name: 'British Pound / US Dollar', type: 'Forex' },
  USDJPY: { pair: 'USD/JPY', name: 'US Dollar / Japanese Yen', type: 'Forex' },
  GBPJPY: { pair: 'GBP/JPY', name: 'British Pound / Japanese Yen', type: 'Forex' },
  XAUUSD: { pair: 'XAUUSD', name: 'Gold / US Dollar', type: 'Forex' },
  NIFTY50: { pair: 'NIFTY 50', name: 'Nifty 50', type: 'Index' },
}
const TA_TIMEFRAME = { M1: '1m', M5: '5m', M15: '15m', M30: '30m', H1: '60m', H4: '4h', D1: '1D' }
const REASON_TEXT = { manual: 'closed manually', sl: 'stop loss', tp: 'take profit', stopout: 'stop-out', reverse: 'reversed', ptp: 'partial take profit' }

export const journalKey = (h) => `${h.id}@${h.closeTime}`
export const TA_INSTRUMENT_MAP = TA_INSTRUMENT

// Target Hit / SL Hit are the only outcomes Trade Analysis has, so: profit = Target Hit,
// loss = SL Hit, and a flat trade follows how it ended.
export function journalStatus(h) {
  if (h.pnl > 0) return 'Target Hit'
  if (h.pnl < 0) return 'SL Hit'
  return h.reason === 'tp' ? 'Target Hit' : 'SL Hit'
}

const localDate = (sec) => {
  const d = new Date(sec * 1000)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function toJournalEntry(h, { timeframeId = 'M15', usdInr = 83 } = {}) {
  const ta = TA_INSTRUMENT[h.symbol] || { pair: h.symbol, name: h.symbol, type: 'Forex' }
  const index = ta.type === 'Index' // index P&L is kept in ₹ in Trade Analysis
  const pnl = index ? Math.round(h.pnl * usdInr * 100) / 100 : h.pnl
  const fmt = (n) => (n == null ? '—' : String(n))
  const side = h.side === 'buy' ? 'Buy' : 'Sell'
  const notes = [
    'Demo terminal trade',
    `${h.lots} lots`,
    `entry ${fmt(h.entry)} → exit ${fmt(h.exit)}`,
    `SL ${fmt(h.sl)} · TP ${fmt(h.tp)}`,
    `${h.pips >= 0 ? '+' : ''}${h.pips} pips`,
    REASON_TEXT[h.reason] || h.reason,
    index ? `P&L converted from $${h.pnl} at ₹${usdInr}/$` : null,
    h.approx ? 'filled while the app was closed (approximate)' : null,
  ].filter(Boolean).join(' · ')
  return {
    name: `Terminal · ${ta.pair} ${side}`,
    date: localDate(h.closeTime),
    pair: ta.pair,
    instrumentName: ta.name,
    instrumentType: ta.type,
    timeframe: TA_TIMEFRAME[h.tf] || TA_TIMEFRAME[timeframeId] || '15m',
    setupTypes: [],
    direction: side,
    price: h.entry,
    pnl,
    notes,
    validationRuleIds: [],
    validationScore: null,
    screenshotUrl: null,
    screenshotHosted: null,
    resultImageUrl: null,
    resultImageHosted: null,
    status: journalStatus(h),
    createdAt: h.closeTime * 1000,
  }
}
