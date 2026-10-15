// HAND-WRITTEN sample payloads following the vendors' documented shapes (twelvedata.com/llms-full.txt; Finnhub candle docs).
// They are NOT recorded from live calls (the sandbox has no network). `node tools/probe-providers.mjs` on a machine with keys
// is what proves the real responses match; replace these with recorded ones once that report exists.
export const TD_SERIES = {
  meta: { symbol: 'XAU/USD', interval: '15min', currency_base: 'Gold Spot', currency_quote: 'US Dollar', type: 'Physical Currency' },
  values: [
    { datetime: '2026-10-13 09:00:00', open: '4380.10', high: '4383.50', low: '4379.20', close: '4382.40' },
    { datetime: '2026-10-13 09:15:00', open: '4382.40', high: '4385.00', low: '4381.00', close: '4384.10' },
    { datetime: '2026-10-13 09:30:00', open: '4384.10', high: '4384.60', low: '4380.00', close: '4381.20' },
  ],
  status: 'ok',
}
export const TD_QUOTE_ONE = { symbol: 'EUR/USD', name: 'EUR/USD', exchange: 'Forex', datetime: '2026-10-13', timestamp: 1791885600, open: '1.1650', high: '1.1680', low: '1.1630', close: '1.16620', previous_close: '1.1648', change: '0.0014', percent_change: '0.12', is_market_open: true }
export const TD_QUOTE_MANY = {
  'EUR/USD': TD_QUOTE_ONE,
  'XAU/USD': { symbol: 'XAU/USD', timestamp: 1791885600, open: '4378.0', close: '4382.4', previous_close: '4370.0', is_market_open: true },
  'GBP/USD': { code: 404, message: '**symbol** not found: GBP/USD', status: 'error' },
}
export const TD_ERR_RATE = { code: 429, message: 'You have run out of API credits for the current minute. 9 API credits were used, with the current limit being 8.', status: 'error' }
export const TD_ERR_DAY = { code: 429, message: 'You have run out of API credits for the day. 801 API credits were used, with the current limit being 800.', status: 'error' }
export const TD_ERR_KEY = { code: 401, message: '**apikey** parameter is incorrect or not specified.', status: 'error' }
export const TD_ERR_PLAN = { code: 403, message: 'This symbol is available starting with Grow or Venture plan.', status: 'error' }
export const FH_CANDLES = { c: [67001.5, 67010.2, 67005.0], h: [67005, 67015, 67012], l: [66990, 67000, 66998], o: [66995, 67001.5, 67010.2], s: 'ok', t: [1791885300, 1791885360, 1791885420], v: [12.5, 8.1, 9.9] }
export const FH_NO_DATA = { s: 'no_data' }
export const FH_ERR_PREMIUM = { error: "You don't have access to this resource." }
