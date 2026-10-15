import { INSTRUMENTS as I } from '../src/lib/terminal/instruments.js'
import { validateOrder, checkTriggers, closePortion, priceFromPips, fillPrice } from '../src/lib/terminal/trading.js'
let fail = 0
const check = (n, ok, x = '') => { if (!ok) fail++; console.log(`${ok ? '✓' : '✗'} ${n} ${ok ? '' : x}`) }
const rates = { USDJPY: 150, USDINR: 83 }
const q = { bid: 1.1, ask: 1.1002 }
const base = { inst: I.EURUSD, quote: q, balance: 10000, positions: [], quotes: { EURUSD: q }, leverage: 100, rates }

check('priceFromPips buy SL 20p', priceFromPips('buy', 1.1002, 20, 'sl', I.EURUSD) === 1.0982)
check('priceFromPips buy TP 40p', priceFromPips('buy', 1.1002, 40, 'tp', I.EURUSD) === 1.1042)
check('priceFromPips sell SL 20p', priceFromPips('sell', 1.1, 20, 'sl', I.EURUSD) === 1.102)
check('fill: buy=ask, sell=bid', fillPrice('buy', q) === 1.1002 && fillPrice('sell', q) === 1.1)

check('valid order passes', validateOrder({ ...base, side: 'buy', lots: 1, sl: 1.098, tp: 1.105 }) === null)
check('buy SL above price rejected', /below/.test(validateOrder({ ...base, side: 'buy', lots: 1, sl: 1.11 }) || ''))
check('sell TP above price rejected', /below/.test(validateOrder({ ...base, side: 'sell', lots: 1, tp: 1.2 }) || ''))
check('bad lot step rejected', validateOrder({ ...base, side: 'buy', lots: 0.015 }) !== null)
// margin: 10 lots EURUSD @1.1002 1:100 = $11,002 > $10,000
check('insufficient margin rejected', /Not enough margin/.test(validateOrder({ ...base, side: 'buy', lots: 10 }) || ''))
check('9 lots ($9,901 margin) accepted', validateOrder({ ...base, side: 'buy', lots: 9 }) === null)
// existing position uses up free margin
const pos = [{ id: 'a', symbol: 'EURUSD', side: 'buy', lots: 9, entry: 1.1002 }]
check('2nd order blocked when margin used', /Not enough margin/.test(validateOrder({ ...base, positions: pos, side: 'buy', lots: 1 }) || ''))

const b = { side: 'buy', sl: 1.098, tp: 1.105 }
check('buy: no trigger inside range', checkTriggers(b, { bid: 1.1, ask: 1.1002 }) === null)
check('buy: SL hit at bid<=sl, fills at sl', JSON.stringify(checkTriggers(b, { bid: 1.0979, ask: 1.0981 })) === '{"reason":"sl","price":1.098}')
check('buy: TP hit at bid>=tp', checkTriggers(b, { bid: 1.1051, ask: 1.1053 })?.reason === 'tp')
const sl = { side: 'sell', sl: 1.102, tp: 1.095 }
check('sell: SL hit uses ASK >= sl', checkTriggers(sl, { bid: 1.1019, ask: 1.1021 })?.reason === 'sl')
check('sell: TP hit uses ASK <= tp', checkTriggers(sl, { bid: 1.0947, ask: 1.0949 })?.reason === 'tp')
check('sell: bid alone below sl does not trigger', checkTriggers(sl, { bid: 1.1021, ask: 1.1019 }) === null)

const p = { id: 'x', symbol: 'EURUSD', side: 'buy', lots: 1, entry: 1.1002, openTime: 1 }
const full = closePortion(p, undefined, 1.1012, I.EURUSD, rates, 'manual', 5)
check('full close +10 pips = +$100, nothing left', full.trade.pnl === 100 && full.trade.pips === 10 && full.remaining === null, JSON.stringify(full))
const part = closePortion(p, 0.4, 1.1012, I.EURUSD, rates, 'manual', 5)
check('partial 0.4 lot = +$40, 0.6 left', part.trade.pnl === 40 && part.remaining.lots === 0.6, JSON.stringify(part))
const loss = closePortion({ ...p, side: 'sell', entry: 1.1 }, 0.5, 1.101, I.EURUSD, rates, 'sl', 5)
check('sell 0.5 lot, price +10p = -$50', loss.trade.pnl === -50 && loss.trade.pips === -10)
console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED'); process.exit(fail ? 1 : 0)
