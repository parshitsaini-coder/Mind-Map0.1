// Section — instrument-aware currency. Equity (Step 4's Indian stock
// list) trades in Indian Rupees; Forex and Commodity pairs here are all
// quoted against the US Dollar (see src/data/instruments.js — every
// FOREX_PAIRS entry except USD/INR and EUR/INR settles in USD, and the
// COMMODITIES list — Gold, Silver, Crude, Nat Gas — is priced in USD on
// every major broker/chart). This is intentionally derived from
// `instrumentType` rather than stored on the trade itself: every existing
// trade already has an instrumentType, so this "just works" retroactively
// with zero migration, and it can never drift out of sync with the type
// the trade is actually tagged as.

export const CURRENCY_BY_TYPE = {
  Equity: 'INR',
  Forex: 'USD',
  Commodity: 'USD',
}

export const CURRENCY_SYMBOL = {
  INR: '₹',
  USD: '$',
}

export const currencyForType = (instrumentType) => CURRENCY_BY_TYPE[instrumentType] || 'USD'

export const symbolForType = (instrumentType) => CURRENCY_SYMBOL[currencyForType(instrumentType)]

// Formats a raw number with the right symbol and a leading +/- sign for
// P&L display (e.g. `formatSignedAmount(-450, 'Forex')` -> "-$450").
// Plain (unsigned) price display should just do
// `${symbolForType(type)}${price}` inline instead of using this.
export const formatSignedAmount = (amount, instrumentType) => {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return null
  const n = Number(amount)
  const symbol = symbolForType(instrumentType)
  const sign = n > 0 ? '+' : n < 0 ? '-' : ''
  return `${sign}${symbol}${Math.abs(n)}`
}
