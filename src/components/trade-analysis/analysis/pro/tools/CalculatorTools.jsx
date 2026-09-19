import { useMemo, useState } from 'react'
import { Anchor, Calculator, Coins, DollarSign, GitBranch, Layers, Ruler, Scale, Split, Target } from 'lucide-react'
import {
  atrStop, breakEvenCalc, currencyConvert, fibonacciLevels, lotConverter, marginCalc, pipValue, pivotPoints, positionSize, riskReward,
} from '../../../../../utils/tradeTools'
import { useTradeAnalysisStore } from '../../../../../store/tradeAnalysisStore'
import {
  Card, CardHead, Field, Metric, Pill, SelectField, TableScroll, ToolError, ToolResult,
  Verdict,
} from '../ui'
import { NEG, POS, fmtMoney, fmtNum, fmtPct, signColor } from '../format'

// Tools → Calculators. Each card is a self-contained calculator: inputs on
// top, answer underneath, recomputed on every keystroke. The account-wide
// numbers (size, risk %, leverage) come from the store so they only ever
// have to be typed once.

const DIRECTIONS = [
  { value: 'Long', label: 'Long' },
  { value: 'Short', label: 'Short' },
]

// ── TOOL 1 ───────────────────────────────────────────────────────────
export function PositionSizeTool({ delay }) {
  const toolInputs = useTradeAnalysisStore((s) => s.toolInputs)
  const setToolInput = useTradeAnalysisStore((s) => s.setToolInput)
  const [entry, setEntry] = useState('')
  const [stop, setStop] = useState('')
  const [lot, setLot] = useState('1')

  const r = useMemo(
    () => positionSize({ accountSize: toolInputs.accountSize, riskPercent: toolInputs.riskPercent, entry, stopLoss: stop, lotSize: lot }),
    [toolInputs.accountSize, toolInputs.riskPercent, entry, stop, lot]
  )

  return (
    <Card delay={delay}>
      <CardHead icon={Calculator} title="Position size" hint="How many units keep a stop-out to exactly your intended risk" />
      <div className="grid grid-cols-2 sm:grid-cols-5" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Account" value={toolInputs.accountSize} onChange={(v) => setToolInput('accountSize', v)} placeholder="100000" />
        <Field label="Risk" value={toolInputs.riskPercent} onChange={(v) => setToolInput('riskPercent', v)} suffix="%" step="0.1" />
        <Field label="Entry" value={entry} onChange={setEntry} placeholder="4400" />
        <Field label="Stop loss" value={stop} onChange={setStop} placeholder="4380" />
        <Field label="Lot step" value={lot} onChange={setLot} hint="Smallest tradeable increment — 1 for shares, 0.01 for micro lots" />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <>
            <ToolResult
              items={[
                { label: 'Units to buy', raw: r.units, format: (v) => fmtNum(v, r.units % 1 === 0 ? 0 : 2), big: true, color: 'var(--ta-accent)' },
                { label: 'Risk amount', raw: r.riskAmount, format: (v) => fmtNum(v, 0) },
                { label: 'Stop distance', raw: r.stopDistance, format: (v) => fmtNum(v, 2), sub: fmtPct(r.stopDistancePct, 2) },
                { label: 'Position value', raw: r.positionValue, format: (v) => fmtNum(v, 0), sub: `${fmtPct(r.positionPctOfAccount, 0)} of account` },
              ]}
            />
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <Pill color={r.direction === 'Long' ? POS : NEG}>{r.direction}</Pill>
              <Pill color="var(--ta-slate)">Actual risk {fmtPct(r.actualRiskPct, 2)}</Pill>
              {r.needsLeverage && <Pill color={NEG}>Needs {fmtNum(r.leverageNeeded, 1)}× leverage</Pill>}
            </div>
            {r.rawUnits !== r.units && (
              <Verdict>
                Rounded down from {fmtNum(r.rawUnits, 2)} to fit the lot step, so actual risk lands slightly under
                target rather than over it.
              </Verdict>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

// ── TOOL 2 ───────────────────────────────────────────────────────────
export function RiskRewardTool({ delay, actualWinRate }) {
  const [entry, setEntry] = useState('')
  const [stop, setStop] = useState('')
  const [target, setTarget] = useState('')
  const [wr, setWr] = useState(actualWinRate != null ? actualWinRate.toFixed(0) : '')

  const r = useMemo(() => riskReward({ entry, stopLoss: stop, target, winRatePct: wr }), [entry, stop, target, wr])

  return (
    <Card delay={delay}>
      <CardHead icon={Target} title="Risk / reward" hint="Reward ratio, plus the win rate it needs just to break even" />
      <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Entry" value={entry} onChange={setEntry} placeholder="4400" />
        <Field label="Stop loss" value={stop} onChange={setStop} placeholder="4380" />
        <Field label="Target" value={target} onChange={setTarget} placeholder="4460" />
        <Field
          label="Win rate"
          value={wr}
          onChange={setWr}
          suffix="%"
          hint={actualWinRate != null ? `Your realised win rate is ${actualWinRate.toFixed(0)}%` : 'Optional'}
        />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <>
            <ToolResult
              columns="grid-cols-2 sm:grid-cols-4"
              items={[
                { label: 'Reward ratio', value: `1 : ${fmtNum(r.rr, 2)}`, big: true, color: r.rr >= 2 ? POS : r.rr < 1 ? NEG : 'var(--ta-accent)' },
                { label: 'Break-even win rate', raw: r.breakEvenWinRate, format: (v) => `${v.toFixed(1)}%`, hint: 'The win rate this ratio needs just to stop losing money' },
                { label: 'Risk', raw: r.risk, format: (v) => fmtNum(v, 2), sub: fmtPct(r.riskPct, 2), color: NEG },
                { label: 'Reward', raw: r.reward, format: (v) => fmtNum(v, 2), sub: fmtPct(r.rewardPct, 2), color: POS },
              ]}
            />
            {r.warning && <div className="mt-1"><ToolError>{r.warning}</ToolError></div>}
            {r.expectancyR != null && (
              <Verdict tone={r.profitable ? 'good' : 'bad'}>
                At a {wr}% win rate this setup returns {fmtNum(r.expectancyR, 2)}R per trade —{' '}
                {r.profitable ? 'positive, so it is worth taking repeatedly.' : 'negative, so repeating it loses money even when individual trades win.'}
              </Verdict>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

// ── TOOL 3 ───────────────────────────────────────────────────────────
export function PipValueTool({ delay }) {
  const toolInputs = useTradeAnalysisStore((s) => s.toolInputs)
  const setToolInput = useTradeAnalysisStore((s) => s.setToolInput)
  const [pair, setPair] = useState('EURUSD')
  const [lots, setLots] = useState('1')

  const r = useMemo(
    () => pipValue({ pair, lots, quoteToAccountRate: toolInputs.usdInrRate }),
    [pair, lots, toolInputs.usdInrRate]
  )

  return (
    <Card delay={delay}>
      <CardHead icon={DollarSign} title="Pip value" hint="What one pip is worth at a given lot size. JPY pairs use a 0.01 pip; everything else 0.0001." />
      <div className="grid grid-cols-3" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Pair" value={pair} onChange={setPair} type="text" placeholder="EURUSD" />
        <Field label="Lots" value={lots} onChange={setLots} step="0.01" />
        <Field
          label="Quote → account"
          value={toolInputs.usdInrRate}
          onChange={(v) => setToolInput('usdInrRate', v)}
          placeholder="1"
          hint="Leave blank if the quote currency is already your account currency"
        />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <>
            <ToolResult
              columns="grid-cols-3"
              items={[
                { label: 'Per pip (quote)', raw: r.pipInQuote, format: (v) => fmtNum(v, 2), big: true, color: 'var(--ta-accent)' },
                { label: 'Per pip (account)', raw: r.pipInAccount, format: (v) => fmtNum(v, 2) },
                { label: 'Units', raw: r.units, format: (v) => fmtNum(v, 0), sub: r.lotLabel },
              ]}
            />
            <Verdict>{r.note}</Verdict>
          </>
        )}
      </div>
    </Card>
  )
}

// ── TOOL 4 ───────────────────────────────────────────────────────────
export function MarginTool({ delay }) {
  const toolInputs = useTradeAnalysisStore((s) => s.toolInputs)
  const setToolInput = useTradeAnalysisStore((s) => s.setToolInput)
  const [pv, setPv] = useState('')

  const r = useMemo(
    () => marginCalc({ positionValue: pv, leverage: toolInputs.leverage, accountSize: toolInputs.accountSize }),
    [pv, toolInputs.leverage, toolInputs.accountSize]
  )

  return (
    <Card delay={delay}>
      <CardHead icon={Scale} title="Margin & leverage" />
      <div className="grid grid-cols-3" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Position value" value={pv} onChange={setPv} placeholder="100000" />
        <Field label="Leverage" value={toolInputs.leverage} onChange={(v) => setToolInput('leverage', v)} suffix=":1" />
        <Field label="Account" value={toolInputs.accountSize} onChange={(v) => setToolInput('accountSize', v)} placeholder="100000" />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <>
            <ToolResult
              columns="grid-cols-2 sm:grid-cols-4"
              items={[
                { label: 'Margin required', raw: r.marginRequired, format: (v) => fmtNum(v, 0), big: true, color: 'var(--ta-accent)' },
                { label: 'Margin rate', raw: r.marginPct, format: (v) => `${v.toFixed(2)}%` },
                { label: 'Free margin', raw: r.freeMargin, format: (v) => fmtNum(v, 0), color: signColor(r.freeMargin) },
                { label: 'Margin level', value: fmtPct(r.marginLevelPct, 0), color: r.marginCallRisk ? NEG : POS },
              ]}
            />
            {r.marginCallRisk && (
              <Verdict tone="bad">
                Margin level under 200% leaves little room — most brokers issue a call near 100% and force-close near 50%.
              </Verdict>
            )}
          </>
        )}
      </div>
    </Card>
  )
}

// ── TOOL 5 ───────────────────────────────────────────────────────────
export function BreakEvenTool({ delay }) {
  const toolInputs = useTradeAnalysisStore((s) => s.toolInputs)
  const setToolInput = useTradeAnalysisStore((s) => s.setToolInput)
  const [entry, setEntry] = useState('')
  const [qty, setQty] = useState('')
  const [dir, setDir] = useState('Long')

  const r = useMemo(
    () => breakEvenCalc({ entry, quantity: qty, costPerTrade: toolInputs.costPerTrade, taxPct: toolInputs.taxPct, direction: dir }),
    [entry, qty, toolInputs.costPerTrade, toolInputs.taxPct, dir]
  )

  return (
    <Card delay={delay}>
      <CardHead icon={Split} title="Break-even after costs" hint="Where price must go before the trade stops losing money to fees and tax" />
      <div className="grid grid-cols-2 sm:grid-cols-5" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Entry" value={entry} onChange={setEntry} placeholder="2800" />
        <Field label="Quantity" value={qty} onChange={setQty} placeholder="100" />
        <Field label="Cost / leg" value={toolInputs.costPerTrade} onChange={(v) => setToolInput('costPerTrade', v)} placeholder="20" />
        <Field label="Tax / turnover" value={toolInputs.taxPct} onChange={(v) => setToolInput('taxPct', v)} suffix="%" step="0.001" />
        <SelectField label="Side" value={dir} onChange={setDir} options={DIRECTIONS} />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <ToolResult
            columns="grid-cols-2 sm:grid-cols-4"
            items={[
              { label: 'Break-even price', raw: r.breakEvenPrice, format: (v) => fmtNum(v, 2), big: true, color: 'var(--ta-accent)' },
              { label: 'Move needed', raw: r.moveNeeded, format: (v) => fmtNum(v, 2), sub: fmtPct(r.moveNeededPct, 3) },
              { label: 'Total costs', raw: r.totalCosts, format: (v) => fmtNum(v, 2), color: NEG, hint: 'Both legs, plus tax on turnover both ways' },
              { label: 'Cost of position', raw: r.costAsPctOfPosition, format: (v) => `${v.toFixed(3)}%` },
            ]}
          />
        )}
      </div>
    </Card>
  )
}

// ── TOOL 6 ───────────────────────────────────────────────────────────
export function AtrStopTool({ delay }) {
  const [entry, setEntry] = useState('')
  const [atr, setAtr] = useState('')
  const [mult, setMult] = useState('2')
  const [rr, setRr] = useState('2')
  const [dir, setDir] = useState('Long')

  const r = useMemo(
    () => atrStop({ entry, atr, multiplier: mult, direction: dir, rrTarget: rr }),
    [entry, atr, mult, dir, rr]
  )

  return (
    <Card delay={delay}>
      <CardHead icon={Anchor} title="ATR stop & target" hint="Places the stop a multiple of average true range away, so it scales with how much the instrument actually moves" />
      <div className="grid grid-cols-2 sm:grid-cols-5" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Entry" value={entry} onChange={setEntry} placeholder="4400" />
        <Field label="ATR" value={atr} onChange={setAtr} placeholder="12" hint="Read it off your chart for the timeframe you're trading" />
        <Field label="Multiple" value={mult} onChange={setMult} step="0.1" />
        <Field label="Target R" value={rr} onChange={setRr} step="0.5" />
        <SelectField label="Side" value={dir} onChange={setDir} options={DIRECTIONS} />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <>
            <ToolResult
              columns="grid-cols-2 sm:grid-cols-4"
              items={[
                { label: 'Stop', raw: r.stop, format: (v) => fmtNum(v, 2), big: true, color: NEG },
                { label: 'Target', raw: r.target, format: (v) => fmtNum(v, 2), big: true, color: POS },
                { label: 'Stop distance', raw: r.distance, format: (v) => fmtNum(v, 2), sub: fmtPct(r.distancePct, 2) },
                { label: 'Reward', value: `1 : ${fmtNum(r.rr, 1)}` },
              ]}
            />
            {r.tooTight && <Verdict tone="warn">Under 0.5 ATR, ordinary noise will take this stop out before the idea gets a chance.</Verdict>}
          </>
        )}
      </div>
    </Card>
  )
}

// ── TOOL 7 ───────────────────────────────────────────────────────────
const PIVOT_METHODS = [
  { value: 'classic', label: 'Classic' },
  { value: 'fibonacci', label: 'Fibonacci' },
  { value: 'camarilla', label: 'Camarilla' },
  { value: 'woodie', label: 'Woodie' },
]

export function PivotTool({ delay }) {
  const [high, setHigh] = useState('')
  const [low, setLow] = useState('')
  const [close, setClose] = useState('')
  const [open, setOpen] = useState('')
  const [method, setMethod] = useState('classic')

  const r = useMemo(() => pivotPoints({ high, low, close, open }), [high, low, close, open])
  const levels = r.ok ? r[method] : null

  const order = ['r4', 'r3', 'r2', 'r1', 'p', 's1', 's2', 's3', 's4']

  return (
    <Card delay={delay}>
      <CardHead icon={Layers} title="Pivot points" hint="Support and resistance from the previous period's high, low and close" />
      <div className="grid grid-cols-2 sm:grid-cols-5" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="High" value={high} onChange={setHigh} placeholder="4450" />
        <Field label="Low" value={low} onChange={setLow} placeholder="4380" />
        <Field label="Close" value={close} onChange={setClose} placeholder="4420" />
        <Field label="Open" value={open} onChange={setOpen} placeholder="optional" hint="Only used by the Woodie method" />
        <SelectField label="Method" value={method} onChange={setMethod} options={PIVOT_METHODS} />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <TableScroll maxHeight={210}>
            <table className="ta-table">
              <thead>
                <tr>
                  <th>Level</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">From pivot</th>
                </tr>
              </thead>
              <tbody>
                {order
                  .filter((k) => levels[k] != null)
                  .map((k) => {
                    const isPivot = k === 'p'
                    const isRes = k.startsWith('r')
                    return (
                      <tr key={k} style={isPivot ? { backgroundColor: 'color-mix(in srgb, var(--ta-accent) 12%, transparent)' } : undefined}>
                        <td className="font-bold uppercase" style={{ color: isPivot ? 'var(--ta-accent)' : isRes ? NEG : POS }}>
                          {k === 'p' ? 'Pivot' : k}
                        </td>
                        <td className="text-right font-semibold">{fmtNum(levels[k], 2)}</td>
                        <td className="text-right" style={{ color: 'var(--ta-slate)' }}>
                          {isPivot ? '—' : fmtNum(levels[k] - levels.p, 2)}
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </TableScroll>
        )}
      </div>
      {r.ok && method === 'woodie' && !r.usedOpenForWoodie && (
        <Verdict>Woodie normally weights the open. Without one, the close is used in its place.</Verdict>
      )}
    </Card>
  )
}

// ── TOOL 8 ───────────────────────────────────────────────────────────
export function FibonacciTool({ delay }) {
  const [high, setHigh] = useState('')
  const [low, setLow] = useState('')
  const [dir, setDir] = useState('Up')

  const r = useMemo(() => fibonacciLevels({ swingHigh: high, swingLow: low, direction: dir }), [high, low, dir])

  return (
    <Card delay={delay}>
      <CardHead icon={GitBranch} title="Fibonacci levels" hint="Retracements within the swing and extensions beyond it" />
      <div className="grid grid-cols-3" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Swing high" value={high} onChange={setHigh} placeholder="4450" />
        <Field label="Swing low" value={low} onChange={setLow} placeholder="4380" />
        <SelectField label="Swing direction" value={dir} onChange={setDir} options={[{ value: 'Up', label: 'Up (retrace down)' }, { value: 'Down', label: 'Down (retrace up)' }]} />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 'var(--tad-gap)' }}>
            <TableScroll maxHeight={190}>
              <table className="ta-table">
                <thead>
                  <tr>
                    <th>Retracement</th>
                    <th className="text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {r.retracements.map((l) => (
                    <tr key={l.ratio} style={l.golden ? { backgroundColor: 'color-mix(in srgb, var(--ta-accent) 12%, transparent)' } : undefined}>
                      <td className="font-semibold" style={{ color: l.golden ? 'var(--ta-accent)' : undefined }}>{l.label}</td>
                      <td className="text-right">{fmtNum(l.price, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
            <TableScroll maxHeight={190}>
              <table className="ta-table">
                <thead>
                  <tr>
                    <th>Extension</th>
                    <th className="text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {r.extensions.map((l) => (
                    <tr key={l.ratio} style={l.golden ? { backgroundColor: 'color-mix(in srgb, var(--ta-accent) 12%, transparent)' } : undefined}>
                      <td className="font-semibold" style={{ color: l.golden ? 'var(--ta-accent)' : undefined }}>{l.label}</td>
                      <td className="text-right">{fmtNum(l.price, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </div>
        )}
      </div>
      {r.ok && (
        <Verdict>
          The 50–61.8% band ({fmtNum(r.goldenZone.from, 2)} – {fmtNum(r.goldenZone.to, 2)}) is where most
          continuation entries are taken.
        </Verdict>
      )}
    </Card>
  )
}

// ── TOOL 9 ───────────────────────────────────────────────────────────
export function CurrencyTool({ delay }) {
  const toolInputs = useTradeAnalysisStore((s) => s.toolInputs)
  const setToolInput = useTradeAnalysisStore((s) => s.setToolInput)
  const [amount, setAmount] = useState('')
  const [from, setFrom] = useState('USD')

  const to = from === 'USD' ? 'INR' : 'USD'
  const r = useMemo(
    () => currencyConvert({ amount, rate: toolInputs.usdInrRate, from, to }),
    [amount, toolInputs.usdInrRate, from, to]
  )

  return (
    <Card delay={delay}>
      <CardHead
        icon={Coins}
        title="Currency converter"
        hint="Uses a rate you set. There is no live feed here on purpose — a stale hard-coded rate would be worse than a number you endorse."
      />
      <div className="grid grid-cols-3" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Amount" value={amount} onChange={setAmount} placeholder="1000" />
        <Field label="USD → INR rate" value={toolInputs.usdInrRate} onChange={(v) => setToolInput('usdInrRate', v)} placeholder="88.50" step="0.01" />
        <SelectField label="Direction" value={from} onChange={setFrom} options={[{ value: 'USD', label: 'USD → INR' }, { value: 'INR', label: 'INR → USD' }]} />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <ToolResult
            columns="grid-cols-3"
            items={[
              { label: `Result (${to})`, raw: r.converted, format: (v) => fmtMoney(v, to === 'INR' ? '₹' : '$'), big: true, color: 'var(--ta-accent)' },
              { label: 'Rate used', raw: r.rate, format: (v) => fmtNum(v, 2) },
              { label: 'Inverse', raw: r.inverseRate, format: (v) => fmtNum(v, 4) },
            ]}
          />
        )}
      </div>
    </Card>
  )
}

// ── TOOL 10 ──────────────────────────────────────────────────────────
export function LotConverterTool({ delay }) {
  const [lots, setLots] = useState('1')
  const [upl, setUpl] = useState('100000')
  const r = useMemo(() => lotConverter({ lots, unitsPerLot: upl }), [lots, upl])

  return (
    <Card delay={delay}>
      <CardHead icon={Ruler} title="Lot converter" />
      <div className="grid grid-cols-2" style={{ gap: 'var(--tad-gap)' }}>
        <Field label="Lots" value={lots} onChange={setLots} step="0.01" />
        <Field label="Units per standard lot" value={upl} onChange={setUpl} />
      </div>
      <div className="mt-1.5">
        {!r.ok ? (
          <ToolError>{r.error}</ToolError>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-5" style={{ gap: 'var(--tad-gap)' }}>
            <Metric label="Units" raw={r.units} format={(v) => fmtNum(v, 0)} big color="var(--ta-accent)" />
            <Metric label="Standard" raw={r.standard} format={(v) => fmtNum(v, 3)} />
            <Metric label="Mini" raw={r.mini} format={(v) => fmtNum(v, 2)} />
            <Metric label="Micro" raw={r.micro} format={(v) => fmtNum(v, 1)} />
            <Metric label="Nano" raw={r.nano} format={(v) => fmtNum(v, 0)} />
          </div>
        )}
      </div>
    </Card>
  )
}
