import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { INDICATORS, defaultParams, cleanParams } from '../lib/terminal/indicators'
import { sanitizeDrawings } from '../lib/terminal/drawings'
import { SYMBOLS, TIMEFRAMES } from '../lib/terminal/instruments'

// Chart tools: indicators, drawings and chart layout. Kept apart from the trading
// store so the two stay small; persisted on their own (cloud sync joins in Phase 7).
// `tool`, `selectedId` and `measure` are live-only.
export const MAX_INDICATORS = 8
export const MAX_DRAWINGS = 200
const PALETTE = ['#38bdf8', '#f59e0b', '#a78bfa', '#22c55e', '#f472b6', '#fb923c', '#e5e7eb', '#ef4444']
const newId = () => `i${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

export const DEFAULT_CELLS = [
  { symbol: 'EURUSD', timeframe: 'M15' },
  { symbol: 'GBPUSD', timeframe: 'H1' },
  { symbol: 'USDJPY', timeframe: 'M5' },
]

const okCell = (c) => c && SYMBOLS.includes(c.symbol) && TIMEFRAMES.some((t) => t.id === c.timeframe)

export const useChartToolsStore = create(
  persist(
    (set, get) => ({
      indicators: [],
      drawings: {}, // symbol -> Drawing[]
      layout: 1, // 1 | 2 | 4 charts (desktop only)
      cells: DEFAULT_CELLS, // chart #2..#4 (chart #1 follows the main symbol/timeframe)

      // live-only
      tool: 'cursor',
      selectedId: null,
      measure: null,
      drawColor: '#38bdf8', // colour for the next drawing
      setDrawColor: (drawColor) => set({ drawColor }),

      // ── indicators ──
      addIndicator: (type) => {
        const s = get()
        if (!INDICATORS[type]) return { ok: false, error: 'Unknown indicator' }
        if (s.indicators.length >= MAX_INDICATORS) return { ok: false, error: `Up to ${MAX_INDICATORS} indicators at once` }
        const used = new Set(s.indicators.map((i) => i.color))
        const color = INDICATORS[type].color && !used.has(INDICATORS[type].color) ? INDICATORS[type].color : PALETTE.find((c) => !used.has(c)) || PALETTE[0]
        set({ indicators: [...s.indicators, { id: newId(), type, params: defaultParams(type), color, visible: true }] })
        return { ok: true }
      },
      updateIndicator: (id, patch) =>
        set((s) => ({
          indicators: s.indicators.map((i) => (i.id === id ? { ...i, ...patch, ...(patch.params ? { params: cleanParams(i.type, patch.params) } : {}) } : i)),
        })),
      removeIndicator: (id) => set((s) => ({ indicators: s.indicators.filter((i) => i.id !== id) })),
      clearIndicators: () => set({ indicators: [] }),

      // ── drawings ──
      addDrawing: (symbol, d) => {
        const list = get().drawings[symbol] || []
        if (list.length >= MAX_DRAWINGS) return { ok: false, error: `Up to ${MAX_DRAWINGS} drawings per symbol` }
        set((s) => ({ drawings: { ...s.drawings, [symbol]: [...list, d] }, selectedId: d.id }))
        return { ok: true }
      },
      updateDrawing: (symbol, id, patch) =>
        set((s) => ({ drawings: { ...s.drawings, [symbol]: (s.drawings[symbol] || []).map((d) => (d.id === id ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d)) } })),
      removeDrawing: (symbol, id) =>
        set((s) => ({ drawings: { ...s.drawings, [symbol]: (s.drawings[symbol] || []).filter((d) => d.id !== id) }, selectedId: s.selectedId === id ? null : s.selectedId })),
      clearDrawings: (symbol) => set((s) => ({ drawings: { ...s.drawings, [symbol]: [] }, selectedId: null })),

      // ── interaction ──
      setTool: (tool) => set({ tool, selectedId: null, measure: null }),
      select: (selectedId) => set({ selectedId }),
      setMeasure: (measure) => set({ measure }),

      // ── layout ──
      setLayout: (layout) => set({ layout: [1, 2, 4].includes(layout) ? layout : 1 }),
      setCell: (i, patch) => set((s) => ({ cells: s.cells.map((c, k) => (k === i ? { ...c, ...patch } : c)) })),
    }),
    {
      name: 'mindmap-terminal-chart-tools',
      version: 1,
      partialize: (s) => ({ indicators: s.indicators, drawings: s.drawings, layout: s.layout, cells: s.cells }),
      // Never trust stored data: drop anything malformed instead of crashing the chart.
      merge: (saved, cur) => {
        const p = saved || {}
        const drawings = {}
        for (const [sym, list] of Object.entries(p.drawings || {})) if (SYMBOLS.includes(sym)) drawings[sym] = sanitizeDrawings(list)
        return {
          ...cur,
          indicators: (Array.isArray(p.indicators) ? p.indicators : [])
            .filter((i) => i && INDICATORS[i.type] && typeof i.id === 'string')
            .slice(0, MAX_INDICATORS)
            .map((i) => ({ id: i.id, type: i.type, params: cleanParams(i.type, i.params), color: typeof i.color === 'string' ? i.color : '#38bdf8', visible: i.visible !== false })),
          drawings,
          layout: [1, 2, 4].includes(p.layout) ? p.layout : 1,
          cells: Array.isArray(p.cells) && p.cells.length === 3 && p.cells.every(okCell) ? p.cells : DEFAULT_CELLS,
        }
      },
    },
  ),
)
