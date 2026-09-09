import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Section — Whiteboard. A free-form infinite canvas, separate from the mind
// map tree, where text boxes, sticky notes, and freehand pen strokes can be
// placed anywhere. Notes created here can be "attached" to any mind-map node
// (see attachWhiteboardNote in mapStore.js), which is how a whiteboard note
// ends up living with a node — the whiteboard itself stays a scratch space
// independent of the map's own undo/persistence.

let elIdCounter = 1
const nextElementId = () => `wbel_${Date.now()}_${elIdCounter++}`

const MAX_HISTORY = 40
const BURST_WINDOW_MS = 600
let burstTimer = null

export const WHITEBOARD_COLORS = [
  '#f5cb5c', // accent yellow
  '#f6a8b8', // pink
  '#a8d8f6', // sky blue
  '#b7e3a8', // mint green
  '#d3b8f6', // lavender
  '#f6c9a8', // peach
  '#242423', // ink (mainly for pen)
  '#ffffff', // white
]

const initialState = {
  isOpen: false,
  elements: [], // { id, type: 'text'|'sticky'|'path', x, y, width, height, content, color, fontSize, points, strokeWidth }
  selectedId: null,
  tool: 'select', // 'select' | 'text' | 'sticky' | 'pen' | 'eraser'
  color: WHITEBOARD_COLORS[0],
  strokeWidth: 3,
  pan: { x: 0, y: 0 },
  zoom: 1,
  history: { past: [], future: [] },
}

export const useWhiteboardStore = create(
  persist(
    (set, get) => ({
      ...initialState,

      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false, selectedId: null, tool: 'select' }),

      setTool: (tool) => set({ tool, selectedId: tool === 'select' ? get().selectedId : null }),
      setColor: (color) => set({ color }),
      setStrokeWidth: (strokeWidth) => set({ strokeWidth }),
      setPan: (pan) => set({ pan }),
      setZoom: (zoom) => set({ zoom: Math.min(3, Math.max(0.25, zoom)) }),
      resetView: () => set({ pan: { x: 0, y: 0 }, zoom: 1 }),
      selectElement: (selectedId) => set({ selectedId }),

      // Snapshots the whole element list — used for every discrete action
      // (add/delete/clear) and once at the start of a drag/resize/typing
      // burst, mirroring the pattern in mapStore.js.
      pushSnapshot: () => {
        const { elements, history } = get()
        set({ history: { past: [...history.past.slice(-MAX_HISTORY), elements], future: [] } })
      },
      pushSnapshotBurst: () => {
        if (!burstTimer) get().pushSnapshot()
        clearTimeout(burstTimer)
        burstTimer = setTimeout(() => {
          burstTimer = null
        }, BURST_WINDOW_MS)
      },
      undo: () => {
        const { history, elements } = get()
        if (!history.past.length) return
        const previous = history.past[history.past.length - 1]
        set({
          elements: previous,
          selectedId: null,
          history: { past: history.past.slice(0, -1), future: [elements, ...history.future].slice(0, MAX_HISTORY) },
        })
      },
      redo: () => {
        const { history, elements } = get()
        if (!history.future.length) return
        const next = history.future[0]
        set({
          elements: next,
          selectedId: null,
          history: { past: [...history.past, elements].slice(-MAX_HISTORY), future: history.future.slice(1) },
        })
      },

      addElement: (el) => {
        get().pushSnapshot()
        const id = nextElementId()
        set({ elements: [...get().elements, { id, ...el }], selectedId: id })
        return id
      },

      // Content/color/font edits — bursty (typing), so only snapshots once
      // per pause rather than on every keystroke.
      updateElementBurst: (id, patch) => {
        get().pushSnapshotBurst()
        set({ elements: get().elements.map((e) => (e.id === id ? { ...e, ...patch } : e)) })
      },

      // Raw position/size setters used *during* an active drag/resize — no
      // history push per call. The caller pushes one snapshot at drag-start.
      setElementPosition: (id, x, y) => set({ elements: get().elements.map((e) => (e.id === id ? { ...e, x, y } : e)) }),
      setElementSize: (id, width, height) =>
        set({ elements: get().elements.map((e) => (e.id === id ? { ...e, width, height } : e)) }),
      setElementPoints: (id, points) =>
        set({ elements: get().elements.map((e) => (e.id === id ? { ...e, points } : e)) }),
      appendPointToPath: (id, point) =>
        set({ elements: get().elements.map((e) => (e.id === id ? { ...e, points: [...e.points, point] } : e)) }),
      setElementColor: (id, color) => {
        get().pushSnapshotBurst()
        set({ elements: get().elements.map((e) => (e.id === id ? { ...e, color } : e)) })
      },
      bumpFontSize: (id, delta) => {
        get().pushSnapshotBurst()
        set({
          elements: get().elements.map((e) =>
            e.id === id ? { ...e, fontSize: Math.min(36, Math.max(10, (e.fontSize || 14) + delta)) } : e
          ),
        })
      },

      deleteElement: (id) => {
        if (!get().elements.some((e) => e.id === id)) return
        get().pushSnapshot()
        set({ elements: get().elements.filter((e) => e.id !== id), selectedId: null })
      },

      clearBoard: () => {
        if (!get().elements.length) return
        get().pushSnapshot()
        set({ elements: [], selectedId: null })
      },
    }),
    {
      name: 'mindmap-whiteboard-storage',
      // Only the actual drawing survives a refresh — open/selection/tool
      // state and undo history are transient per-session concerns.
      partialize: (state) => ({ elements: state.elements, color: state.color, strokeWidth: state.strokeWidth }),
    }
  )
)
