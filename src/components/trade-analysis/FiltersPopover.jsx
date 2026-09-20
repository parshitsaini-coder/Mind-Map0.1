import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { useTradeAnalysisStore } from '../../store/tradeAnalysisStore'
import { INDIAN_STOCKS, FOREX_PAIRS, COMMODITIES } from '../../data/instruments'
import AnimatedMultiSelect from './AnimatedMultiSelect'
import DatePicker from './DatePicker'

const INSTRUMENT_TYPES = ['Equity', 'Forex', 'Commodity']
const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '60m', '75m', '2h', '3h', '4h', '1D', '1W', '1M']
const STATUS_OPTIONS = ['Pending', 'Target Hit', 'SL Hit']

// Every instrument across all three lists, for the pair filter's select —
// deliberately not filtered by the type filter above it, since a user
// might want to isolate one pair regardless of type.
const ALL_PAIRS = [...INDIAN_STOCKS, ...FOREX_PAIRS, ...COMMODITIES]

// Number of filters currently set — drives the badge on the Filters
// button in TradeAnalysis.jsx's top bar. Multi-select fields (arrays)
// count as active when non-empty; the date fields count as active when
// set, same as before.
export const countActiveFilters = (filters) =>
  Object.values(filters).filter((v) => (Array.isArray(v) ? v.length > 0 : Boolean(v))).length

// Step 7 of trade-analysis-master-prompt.md — the Filters popover behind
// the top bar's Filters button. Anchored dropdown (not a full modal),
// same lightweight open/close animation as TradeForm's pair combobox
// popover. Every field writes straight to the store's `filters` object;
// TradesTable.jsx reads that same object to filter the rows live.
export default function FiltersPopover({ open, onClose }) {
  const filters = useTradeAnalysisStore((s) => s.filters)
  const validationRules = useTradeAnalysisStore((s) => s.validationRules)
  const validationCategories = useTradeAnalysisStore((s) => s.validationCategories)
  const activeCount = countActiveFilters(filters)

  // Step E of trade-analysis-validation-v3-master-prompt.md — group the
  // rule options by category (in category order) instead of one flat,
  // unordered list, and prefix each label with its category so the
  // dropdown reads as sections even though AnimatedSelect only supports a
  // flat option list.
  const validationRuleOptions = [...validationCategories]
    .sort((a, b) => a.order - b.order)
    .flatMap((cat) =>
      validationRules
        .filter((r) => r.categoryId === cat.id)
        .sort((a, b) => a.order - b.order)
        .map((r) => ({ value: r.id, label: `${cat.name} · ${r.label}` }))
    )

  const setFilter = (key, value) => useTradeAnalysisStore.getState().setFilter(key, value || null)
  const toggleFilterValue = (key, value) => useTradeAnalysisStore.getState().toggleFilterValue(key, value)

  const fieldLabelCls = 'text-[10px] font-medium uppercase tracking-wide'
  const inputCls =
    'w-full rounded-md border bg-white/70 px-2 py-1.5 text-[11px] outline-none transition-colors focus:ring-1'

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Click-outside catcher — transparent, sits below the popover
              but above everything else in the overlay. */}
          <div className="fixed inset-0 z-[65]" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.99 }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
            onClick={(e) => e.stopPropagation()}
            className="ta-glass-popover absolute right-0 top-full z-[66] mt-1.5 flex w-72 flex-col gap-3 rounded-lg border p-3 shadow-xl"
            style={{ backgroundColor: 'var(--ta-surface)', borderColor: 'var(--ta-slate)' }}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: 'var(--ta-ink)' }}>
                Filters
              </p>
              <motion.button
                whileTap={{ scale: 0.88 }}
                onClick={onClose}
                className="flex h-5 w-5 items-center justify-center rounded-md hover:bg-black/5"
                style={{ color: 'var(--ta-slate)' }}
                title="Close"
              >
                <X size={13} />
              </motion.button>
            </div>

            {/* Pair */}
            <label className="flex flex-col gap-1">
              <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Pair</span>
              <AnimatedMultiSelect
                values={filters.pair || []}
                onToggle={(v) => toggleFilterValue('pair', v)}
                inputCls={inputCls}
                placeholder="All pairs"
                searchable
                searchPlaceholder="Search pair..."
                options={ALL_PAIRS.map((i) => ({ value: i.symbol, label: i.symbol }))}
              />
            </label>

            {/* Type */}
            <div className="flex flex-col gap-1">
              <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Type</span>
              <div className="grid grid-cols-4 gap-1">
                {['All', ...INSTRUMENT_TYPES].map((t) => {
                  const isAll = t === 'All'
                  const active = isAll ? (filters.instrumentType || []).length === 0 : (filters.instrumentType || []).includes(t)
                  return (
                    <motion.button
                      key={t}
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => (isAll ? setFilter('instrumentType', []) : toggleFilterValue('instrumentType', t))}
                      className="rounded-md border py-1 text-[9.5px] font-medium transition-colors"
                      style={
                        active
                          ? { backgroundColor: 'var(--ta-accent)', borderColor: 'var(--ta-accent)', color: '#fffcf2' }
                          : { borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }
                      }
                    >
                      {t}
                    </motion.button>
                  )
                })}
              </div>
            </div>

            {/* Timeframe */}
            <label className="flex flex-col gap-1">
              <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Time frame</span>
              <AnimatedMultiSelect
                values={filters.timeframe || []}
                onToggle={(v) => toggleFilterValue('timeframe', v)}
                inputCls={inputCls}
                placeholder="All time frames"
                options={TIMEFRAMES.map((tf) => ({ value: tf, label: tf }))}
              />
            </label>

            {/* Direction */}
            <div className="flex flex-col gap-1">
              <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Direction</span>
              <div className="grid grid-cols-3 gap-1">
                {['All', 'Buy', 'Sell'].map((d) => {
                  const isAll = d === 'All'
                  const active = isAll ? (filters.direction || []).length === 0 : (filters.direction || []).includes(d)
                  const activeColor = d === 'Buy' ? '#16a34a' : d === 'Sell' ? '#dc2626' : 'var(--ta-accent)'
                  return (
                    <motion.button
                      key={d}
                      type="button"
                      whileTap={{ scale: 0.94 }}
                      onClick={() => (isAll ? setFilter('direction', []) : toggleFilterValue('direction', d))}
                      className="rounded-md border py-1 text-[9.5px] font-semibold transition-colors"
                      style={
                        active
                          ? { backgroundColor: activeColor, borderColor: activeColor, color: '#ffffff' }
                          : { borderColor: 'var(--ta-slate)', color: 'var(--ta-ink)' }
                      }
                    >
                      {d}
                    </motion.button>
                  )
                })}
              </div>
            </div>

            {/* Status */}
            <label className="flex flex-col gap-1">
              <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Status</span>
              <AnimatedMultiSelect
                values={filters.status || []}
                onToggle={(v) => toggleFilterValue('status', v)}
                inputCls={inputCls}
                placeholder="All statuses"
                options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
              />
            </label>

            {/* Validation rule */}
            <label className="flex flex-col gap-1">
              <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Validation rule met</span>
              <AnimatedMultiSelect
                values={filters.validationRuleId || []}
                onToggle={(v) => toggleFilterValue('validationRuleId', v)}
                inputCls={inputCls}
                disabled={validationRuleOptions.length === 0}
                placeholder={validationRuleOptions.length === 0 ? 'No rules yet' : 'Any rule'}
                options={validationRuleOptions}
              />
            </label>

            {/* Date range */}
            <div className="flex flex-col gap-1">
              <span className={fieldLabelCls} style={{ color: 'var(--ta-slate)' }}>Date range</span>
              <div className="grid grid-cols-2 gap-1.5">
                <DatePicker
                  value={filters.dateFrom || ''}
                  onChange={(v) => setFilter('dateFrom', v)}
                  inputCls={inputCls}
                  align="left"
                  placeholder="From"
                />
                <DatePicker
                  value={filters.dateTo || ''}
                  onChange={(v) => setFilter('dateTo', v)}
                  inputCls={inputCls}
                  align="right"
                  placeholder="To"
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-2" style={{ borderColor: 'var(--ta-slate)' }}>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => useTradeAnalysisStore.getState().clearFilters()}
                disabled={activeCount === 0}
                className="text-[10.5px] font-medium underline-offset-2 hover:underline disabled:opacity-40 disabled:no-underline"
                style={{ color: 'var(--ta-slate)' }}
              >
                Clear filters{activeCount > 0 ? ` (${activeCount})` : ''}
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-[10.5px] font-semibold text-white transition-colors hover:brightness-110"
                style={{ backgroundColor: 'var(--ta-accent)' }}
              >
                Done
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
