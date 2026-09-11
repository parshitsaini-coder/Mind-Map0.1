import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applyNodeChanges, applyEdgeChanges, addEdge as rfAddEdge } from '@xyflow/react'
import { useUiStore } from './uiStore'
import { runLayout } from '../hooks/useAutoLayout'
import { buildConnectorDemo } from '../utils/connectorDemoData'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { readProjectData, writeProjectData } from './projectsStore'
import { computeCalcUpdates } from '../utils/calcEngine'

let idCounter = 1
const nextId = () => `node_${Date.now()}_${idCounter++}`
const nextGroupId = () => `group_${Date.now()}_${idCounter++}`

// Groups a rapid burst of fine-grained edits (typing a label, dragging a
// color/scale slider, etc.) into a single undo step, instead of pushing a
// snapshot on every keystroke/tick. The first edit in a burst snapshots
// immediately (so Ctrl+Z always has something to go back to); any further
// edits within BURST_WINDOW_MS are absorbed into that same step. Once the
// user pauses for BURST_WINDOW_MS, the next edit starts a fresh step.
const BURST_WINDOW_MS = 700
let burstTimer = null

// How long a deleted node's fade-out plays before it's actually removed
// from the store — matches the global `.react-flow__node` opacity
// transition duration in index.css so the two stay in lockstep.
const DELETE_FADE_MS = 350

const initialNodes = [
  {
    id: 'root',
    type: 'mindNode',
    position: { x: 0, y: 0 },
    data: { label: 'Central Idea', shape: 'oval', color: '#f5cb5c', isRoot: true },
  },
]

const DEFAULT_NODE_W = 130
const DEFAULT_NODE_H = 36
const GROUP_PADDING = 28

// Section — Node Library. Given a parent node and a layout id, returns an
// array of { x, y } positions (one per new node) arranged around/relative
// to the parent — same spirit as the layouts/ folder algorithms, but for
// *placing brand-new sibling nodes* in a shape rather than re-flowing an
// existing tree. Kept as a small pure function so NodeLibraryPanel.jsx can
// also import it to draw a matching live preview.
export function computeNodeLibraryPositions(layout, count, parent) {
  const baseX = parent.position.x
  const baseY = parent.position.y
  const positions = []

  if (layout === 'vertical') {
    const spacingY = 90
    const startY = baseY + 130
    for (let i = 0; i < count; i++) positions.push({ x: baseX, y: startY + i * spacingY })
  } else if (layout === 'circular') {
    const radius = count <= 1 ? 0 : 90 + count * 20
    for (let i = 0; i < count; i++) {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2
      positions.push({
        x: baseX + radius * Math.cos(angle),
        y: baseY + radius * Math.sin(angle) + 130,
      })
    }
  } else if (layout === 'grid') {
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)))
    const spacingX = 180
    const spacingY = 90
    const startX = baseX + 260
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols)
      const col = i % cols
      positions.push({ x: startX + col * spacingX, y: baseY + row * spacingY })
    }
  } else {
    // 'horizontal' (default) — a row of nodes to the right of the parent.
    const spacingX = 190
    const startX = baseX + 260
    for (let i = 0; i < count; i++) positions.push({ x: startX + i * spacingX, y: baseY })
  }

  return positions
}

export const NODE_LIBRARY_LAYOUTS = [
  { id: 'horizontal', label: 'Horizontal' },
  { id: 'vertical', label: 'Vertical' },
  { id: 'circular', label: 'Circular' },
  { id: 'grid', label: 'Grid' },
]

export const useMapStore = create(
  persist(
    (set, get) => ({
      nodes: initialNodes,
      edges: [],
      groups: [],
      history: { past: [], future: [] },
      activityLog: [],
      // Section — Custom Style Library. User-built styles saved from the
      // Style Library's "Custom" tab (CustomStyleBuilder.jsx), stored
      // alongside the built-in NODE_STYLE_PRESETS so they show up in the
      // same gallery / apply the same way via applyNodeStyle.
      customNodeStyles: [],
      customConnectorStyles: [],
      // Section — Copy/Paste a node. Right-click "Copy" (NodeContextMenu)
      // snapshots a node's full data (label, size, colors, fonts, shape,
      // icon/emoji, motion — everything CustomNode.jsx renders) plus the
      // style of whichever connector feeds into it, so "Paste" elsewhere
      // can recreate both the node's look and its connector's look
      // together. Deliberately NOT persisted/undo-tracked itself — it's
      // just an in-memory clipboard, same as a system copy/paste buffer.
      nodeClipboard: null,
      // Section — "Copy all" (right-click → Copy all connected). Unlike
      // nodeClipboard above (one node, visual fields only), this holds an
      // entire connected cluster of nodes — every node reachable from the
      // one right-clicked by following connectors in either direction —
      // with their FULL data (notes, checklists, tasks, everything) plus
      // every edge between them, so a whole self-contained chain (like a
      // TP/SL calculation row) can be duplicated as one unit elsewhere.
      nodeGroupClipboard: null,
      cloudStatus: 'idle', // 'idle' | 'saving' | 'saved' | 'error'
      activeProjectId: null,

      // Multi-project support — swap the whole canvas over to a different
      // project's saved data. Called by the Tabs bar / Projects dashboard
      // whenever the active project changes. Does NOT push an undo snapshot
      // (switching projects isn't something you'd want to Ctrl+Z through)
      // and resets the undo/redo history, since it belongs to the project
      // being left.
      // Section — JSON backup import. Replaces the live canvas with data
      // from an exported .json backup file (see exportShareLink.js's
      // sibling, exportImportBackup.js). Pushes an undo snapshot first so
      // importing over the wrong map can still be undone with Ctrl+Z.
      loadMapData: ({ nodes, edges, groups, activityLog }) => {
        get().pushSnapshot()
        set({
          nodes: nodes?.length ? nodes : initialNodes,
          edges: edges || [],
          groups: groups || [],
          activityLog: activityLog || [],
        })
      },

      loadProject: (projectId) => {
        const data = readProjectData(projectId)
        set({
          activeProjectId: projectId,
          nodes: data?.nodes?.length ? data.nodes : initialNodes,
          edges: data?.edges || [],
          groups: data?.groups || [],
          activityLog: data?.activityLog || [],
          history: { past: [], future: [] },
        })
      },

      // Persists the current canvas into the given project's local storage
      // slot. Called (debounced) from App.jsx on every canvas change, and
      // right before switching away from a project.
      saveProject: (projectId) => {
        if (!projectId) return
        const { nodes, edges, groups, activityLog } = get()
        writeProjectData(projectId, { nodes, edges, groups, activityLog })
      },

      // Section — online account sync (Supabase). Pulls the signed-in
      // user's last-saved map down from the cloud, replacing whatever is
      // currently on the canvas (their local map stays in undo history).
      loadFromCloud: async (userId) => {
        if (!isSupabaseConfigured || !userId) return
        const { data, error } = await supabase
          .from('maps')
          .select('nodes, edges')
          .eq('user_id', userId)
          .maybeSingle()
        if (error) return

        const cloudNodes = data?.nodes || []
        const cloudEdges = data?.edges || []
        const cloudIsEmpty = cloudNodes.length === 0 && cloudEdges.length === 0
        const { nodes: localNodes, edges: localEdges } = get()
        // "Blank" locally means still just the single default root node with
        // no connections — anything more than that is real work.
        const localHasData = localNodes.length > 1 || localEdges.length > 0

        // Same guard as trade-analysis sync: don't let the very first sync
        // (or a not-yet-created cloud row) wipe out a real local map with
        // an empty cloud row — push the local map up instead.
        if (cloudIsEmpty && localHasData) {
          get().saveToCloud(userId)
          return
        }

        get().pushSnapshot()
        set({ nodes: cloudNodes.length ? cloudNodes : initialNodes, edges: cloudEdges })
      },

      // Debounced auto-save target (called from App.jsx whenever the map
      // changes while someone is signed in). Upserts one row per user.
      saveToCloud: async (userId) => {
        if (!isSupabaseConfigured || !userId) return
        set({ cloudStatus: 'saving' })
        const { nodes, edges } = get()
        const { error } = await supabase
          .from('maps')
          .upsert({ user_id: userId, nodes, edges, updated_at: new Date().toISOString() })
        set({ cloudStatus: error ? 'error' : 'saved' })
      },

      // Section 4.7 — local activity log. Called from the actions below.
      logActivity: (message) => {
        set((s) => ({
          activityLog: [{ id: `a_${Date.now()}_${idCounter++}`, ts: Date.now(), message }, ...s.activityLog].slice(0, 100),
        }))
      },

      // Section 4.7 — comments & @mentions on a node.
      addComment: (nodeId, author, text) => {
        if (!text?.trim()) return
        const mentions = [...text.matchAll(/@(\w+)/g)].map((m) => m[1])
        const comment = { id: `c_${Date.now()}`, author: author || 'You', text, mentions, ts: Date.now() }
        set({
          nodes: get().nodes.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, comments: [...(n.data.comments || []), comment] } } : n
          ),
        })
        const node = get().nodes.find((n) => n.id === nodeId)
        get().logActivity(`💬 ${author || 'You'} commented on "${node?.data?.label}"${mentions.length ? ` mentioning ${mentions.map((m) => '@' + m).join(', ')}` : ''}`)
      },

      // Section 4.7 — team workspaces/folders: named local saves of the whole map.
      saveWorkspace: (name) => {
        const key = 'mindmap-workspaces'
        const existing = JSON.parse(localStorage.getItem(key) || '[]')
        const workspace = { name, nodes: get().nodes, edges: get().edges, savedAt: Date.now() }
        const updated = [workspace, ...existing.filter((w) => w.name !== name)].slice(0, 30)
        localStorage.setItem(key, JSON.stringify(updated))
        get().logActivity(`📁 Saved workspace "${name}"`)
      },
      loadWorkspace: (name) => {
        const key = 'mindmap-workspaces'
        const existing = JSON.parse(localStorage.getItem(key) || '[]')
        const workspace = existing.find((w) => w.name === name)
        if (!workspace) return
        get().pushSnapshot()
        set({ nodes: workspace.nodes, edges: workspace.edges })
        get().logActivity(`📂 Loaded workspace "${name}"`)
      },

      // Section 4.6 — undo/redo (Ctrl+Z / Ctrl+Y). Snapshots are taken before
      // structural changes (add/delete/layout/group) and at drag-end, not on
      // every intermediate event, to keep the stack meaningful.
      pushSnapshot: () => {
        const { nodes, edges, history } = get()
        set({
          history: {
            past: [...history.past.slice(-49), { nodes, edges }],
            future: [],
          },
        })
      },

      // Same idea as pushSnapshot, but for content edits that fire many
      // times in quick succession (typing a label, dragging a color/scale
      // control). Only snapshots at the *start* of a burst; see
      // BURST_WINDOW_MS comment above.
      pushSnapshotBurst: () => {
        if (!burstTimer) get().pushSnapshot()
        clearTimeout(burstTimer)
        burstTimer = setTimeout(() => {
          burstTimer = null
        }, BURST_WINDOW_MS)
      },
      undo: () => {
        const { history, nodes, edges } = get()
        if (history.past.length === 0) return
        const previous = history.past[history.past.length - 1]
        set({
          nodes: previous.nodes,
          edges: previous.edges,
          history: {
            past: history.past.slice(0, -1),
            future: [{ nodes, edges }, ...history.future].slice(0, 50),
          },
        })
      },
      redo: () => {
        const { history, nodes, edges } = get()
        if (history.future.length === 0) return
        const next = history.future[0]
        set({
          nodes: next.nodes,
          edges: next.edges,
          history: {
            past: [...history.past, { nodes, edges }].slice(-50),
            future: history.future.slice(1),
          },
        })
      },

      onNodesChange: (changes) => {
        // Snapshot once at the end of a drag (not on every intermediate move).
        const dragEnd = changes.some((c) => c.type === 'position' && c.dragging === false)
        if (dragEnd) get().pushSnapshot()
        set({ nodes: applyNodeChanges(changes, get().nodes) })
      },
      onEdgesChange: (changes) => set({ edges: applyEdgeChanges(changes, get().edges) }),
      onConnect: (connection) => {
        // Relationship mode (toolbar toggle) creates a dashed cross-branch
        // relationship edge instead of a normal parent-child tree edge —
        // useful for linking nodes that aren't in the same branch.
        get().pushSnapshot()
        const relationshipMode = useUiStore.getState().relationshipMode
        set({
          edges: rfAddEdge(
            {
              ...connection,
              type: relationshipMode ? 'crossEdge' : 'mindEdge',
              animated: !relationshipMode,
            },
            get().edges
          ),
        })
      },

      // Section 4.6 — expand/collapse branches.
      toggleCollapse: (id) => {
        get().pushSnapshot()
        set({
          nodes: get().nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, collapsed: !n.data.collapsed } } : n
          ),
        })
      },

      // Hide / unhide a node from the Outline View. Hiding a node removes
      // it (and its descendants) from the canvas via computeHidden, same
      // mechanism as collapse, but tracked with its own flag so it's
      // independent of the expand/collapse state.
      toggleHidden: (id) => {
        get().pushSnapshot()
        set({
          nodes: get().nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, hidden: !n.data.hidden } } : n
          ),
        })
      },

      // Delete a single connector/edge — used by ConnectorCalcMenu.jsx's
      // right-click "Delete connector" option.
      deleteEdge: (id) => {
        get().pushSnapshot()
        set({ edges: get().edges.filter((e) => e.id !== id) })
      },

      // Lock / unlock a node from its right-click context menu. Locking
      // sets both `data.locked` (read by CustomNode.jsx to block the
      // double-click-to-rename editor and by NodeContextMenu.jsx to grey
      // out "Delete node") and the node's own top-level `draggable` flag
      // (the actual property React Flow checks before letting a drag
      // start) — so a locked node stays exactly where it is, keeps its
      // label, and can't be deleted until it's unlocked again.
      toggleNodeLock: (id) => {
        get().pushSnapshot()
        set({
          nodes: get().nodes.map((n) => {
            if (n.id !== id) return n
            const locked = !n.data?.locked
            return { ...n, draggable: !locked, data: { ...n.data, locked } }
          }),
        })
      },

      // Section 4.6 — search & replace across node labels.
      replaceInLabels: (query, replacement) => {
        if (!query) return
        get().pushSnapshot()
        set({
          nodes: get().nodes.map((n) =>
            n.data?.label?.includes(query)
              ? { ...n, data: { ...n.data, label: n.data.label.split(query).join(replacement) } }
              : n
          ),
        })
        get().logActivity(`🔎 Replaced "${query}" with "${replacement}"`)
      },

      // Section 4.1 — multiple central topics / multi-map support on one canvas.
      addCentralTopic: () => {
        get().pushSnapshot()
        const roots = get().nodes.filter((n) => n.data?.isRoot)
        const id = nextId()
        const offset = roots.length
        const newNode = {
          id,
          type: 'mindNode',
          position: { x: offset * 60, y: (offset + 1) * 260 },
          data: { label: 'New Central Topic', shape: 'oval', color: '#f5cb5c', isRoot: true },
        }
        set({ nodes: [...get().nodes, newNode] })
        get().logActivity('🎯 Added a new central topic')
        return id
      },

      // Section 4.1 — boundary/frame grouping. Draws a dashed box/circle
      // around currently-selected nodes.
      addGroupFromSelection: (shape = 'box') => {
        const selected = get().nodes.filter((n) => n.selected && n.type !== 'boundaryGroup')
        if (selected.length < 2) return null
        get().pushSnapshot()

        const xs = selected.map((n) => n.position.x)
        const ys = selected.map((n) => n.position.y)
        const xEnds = selected.map((n) => n.position.x + (n.measured?.width ?? DEFAULT_NODE_W))
        const yEnds = selected.map((n) => n.position.y + (n.measured?.height ?? DEFAULT_NODE_H))

        const minX = Math.min(...xs) - GROUP_PADDING
        const minY = Math.min(...ys) - GROUP_PADDING
        const maxX = Math.max(...xEnds) + GROUP_PADDING
        const maxY = Math.max(...yEnds) + GROUP_PADDING

        const id = nextGroupId()
        const groupNode = {
          id,
          type: 'boundaryGroup',
          position: { x: minX, y: minY },
          data: {
            width: maxX - minX,
            height: maxY - minY,
            shape,
            label: 'Group',
            color: '#333533',
          },
          draggable: false,
          selectable: true,
          zIndex: -1,
        }
        // Insert at the start so it renders (and stacks) behind regular nodes.
        set({ nodes: [groupNode, ...get().nodes] })
        get().logActivity('⬚ Grouped nodes into a boundary')
        return id
      },

      renameGroup: (id, label) => {
        set({
          nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, label } } : n)),
        })
      },

      // Section 4.2 — apply a layout algorithm to every node's position.
      // The visual "smooth repositioning transition" is handled by a CSS
      // transition class toggled in MindMapCanvas around this call.
      applyLayout: (layoutId, direction) => {
        get().pushSnapshot()
        const dir = direction || useUiStore.getState().treeDirection
        set({ nodes: runLayout(layoutId, get().nodes, get().edges, dir) })
        get().logActivity(`🔀 Switched layout to "${layoutId}"`)
      },

      // `fromHandle: 'bottom'` is used by the node's bottom-center "+" (as
      // opposed to the default top-right "+", which grows the tree to the
      // right via the normal left/right handles) — it places the new node
      // straight below the parent and wires the edge through the bottom
      // (source) / top (target) handle pair added in CustomNode.jsx.
      addChildNode: (parentId, { fromHandle } = {}) => {
        const parent = get().nodes.find((n) => n.id === parentId)
        if (!parent) return
        get().pushSnapshot()
        const id = nextId()
        const newNode = {
          id,
          type: 'mindNode',
          position:
            fromHandle === 'bottom'
              ? { x: parent.position.x, y: parent.position.y + 130 }
              : { x: parent.position.x + 220, y: parent.position.y + (Math.random() * 80 - 40) },
          data: { label: 'New Node', shape: 'rectangle', color: '#e8eddf' },
        }
        const newEdge = {
          id: `e_${parentId}_${id}`,
          source: parentId,
          target: id,
          type: 'mindEdge',
          animated: true,
          ...(fromHandle === 'bottom' ? { sourceHandle: 'bottom', targetHandle: 'top' } : {}),
        }
        set({ nodes: [...get().nodes, newNode], edges: [...get().edges, newEdge] })
        get().logActivity(`➕ Added "${newNode.data.label}" under "${parent.data.label}"`)
        return id
      },

      // Section 4.6 — Enter = add sibling (a new child of the same parent).
      addSiblingNode: (nodeId) => {
        const parentEdge = get().edges.find((e) => e.target === nodeId && e.type !== 'crossEdge')
        if (!parentEdge) return get().addFloatingNode()
        return get().addChildNode(parentEdge.source)
      },

      // Section — Node Library (toolbar → "Node Library" icon). Bulk-creates
      // `count` new sibling nodes under `parentId`, arranged in the chosen
      // layout shape (see computeNodeLibraryPositions above), all sharing
      // the same style options picked in the panel (background color, text
      // color, font size). One undo snapshot for the whole batch, so
      // Ctrl+Z removes everything the panel just added in one step.
      addNodeLayoutBatch: (parentId, { layout = 'horizontal', count = 4, fontSize, color, textColor } = {}) => {
        const parent = get().nodes.find((n) => n.id === parentId)
        if (!parent) return []
        const safeCount = Math.max(1, Math.min(24, Math.round(count) || 1))
        get().pushSnapshot()

        const positions = computeNodeLibraryPositions(layout, safeCount, parent)
        const newNodes = []
        const newEdges = []
        for (let i = 0; i < safeCount; i++) {
          const id = nextId()
          newNodes.push({
            id,
            type: 'mindNode',
            position: positions[i],
            data: {
              label: `New Node ${i + 1}`,
              shape: 'rectangle',
              color: color || '#e8eddf',
              ...(textColor ? { textColor } : {}),
              ...(fontSize ? { fontSize } : {}),
            },
          })
          newEdges.push({
            id: `e_${parentId}_${id}`,
            source: parentId,
            target: id,
            type: 'mindEdge',
            animated: true,
          })
        }

        set({ nodes: [...get().nodes, ...newNodes], edges: [...get().edges, ...newEdges] })
        get().logActivity(`📚 Added ${safeCount} nodes (${layout} layout) under "${parent.data?.label || parentId}"`)
        return newNodes.map((n) => n.id)
      },

      addFloatingNode: () => {
        get().pushSnapshot()
        const id = nextId()
        const newNode = {
          id,
          type: 'mindNode',
          position: { x: Math.random() * 300, y: Math.random() * 300 + 200 },
          data: { label: 'Floating Note', shape: 'cloud', color: '#cfdbd5' },
        }
        set({ nodes: [...get().nodes, newNode] })
        return id
      },

      // Section — Node Linking / Backlinks. A "link" is a one-way pointer
      // stored as an id in the *source* node's data.links array; backlinks
      // (which nodes point AT a given node) are derived on the fly by
      // scanning every node's data.links rather than stored separately, so
      // there's a single source of truth and no risk of the two getting
      // out of sync.
      linkNode: (fromId, toId) => {
        if (!toId || fromId === toId) return
        get().pushSnapshot()
        set({
          nodes: get().nodes.map((n) => {
            if (n.id !== fromId) return n
            const links = n.data.links || []
            if (links.includes(toId)) return n
            return { ...n, data: { ...n.data, links: [...links, toId] } }
          }),
        })
      },

      unlinkNode: (fromId, toId) => {
        get().pushSnapshot()
        set({
          nodes: get().nodes.map((n) =>
            n.id === fromId
              ? { ...n, data: { ...n.data, links: (n.data.links || []).filter((id) => id !== toId) } }
              : n
          ),
        })
      },

      // Selects exactly one node (clearing any other node/edge selection) —
      // used by the "jump to node" buttons in the Linked Nodes / Backlinks
      // section of the Node Inspector.
      selectNodeOnly: (id) => {
        set({
          nodes: get().nodes.map((n) => ({ ...n, selected: n.id === id })),
          edges: get().edges.map((e) => ({ ...e, selected: false })),
        })
      },

      updateNodeData: (id, patch) => {
        get().pushSnapshotBurst()
        set({
          nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
        })
        get().recalcConnectors()
      },

      // Bulk variant of updateNodeData — applies the same patch to every node
      // whose id is in `ids`. Used by the Node Inspector when multiple nodes
      // are selected at once (Shift-drag box-select or Ctrl/Cmd-click).
      // `patch` can be a plain object (shallow-merged into each node's data)
      // or a function `(data) => partialPatch` when the update needs to read
      // that node's own existing data first (e.g. merging into its badges
      // object without wiping the other badge fields).
      updateNodesData: (ids, patch) => {
        get().pushSnapshotBurst()
        const idSet = new Set(ids)
        set({
          nodes: get().nodes.map((n) => {
            if (!idSet.has(n.id)) return n
            const resolved = typeof patch === 'function' ? patch(n.data) : patch
            return { ...n, data: { ...n.data, ...resolved } }
          }),
        })
        get().recalcConnectors()
      },

      // Section 4.3 — custom branch (edge) color & thickness.
      updateEdgeStyle: (id, patch) => {
        get().pushSnapshotBurst()
        set({
          edges: get().edges.map((e) =>
            e.id === id ? { ...e, style: { ...e.style, ...patch } } : e
          ),
        })
      },

      // Section — Connector Calculations. Right-click a connector →
      // ConnectorCalcMenu.jsx calls this to tag it with a math operator
      // (+, -, *, /) or mark it as the "=" that reads out a result.
      // Clicking the already-active operator again clears it. Recalculates
      // immediately afterwards so an "=" connector's target updates the
      // instant it's set, not on the next unrelated edit.
      setEdgeCalcOp: (edgeId, op) => {
        get().pushSnapshot()
        set({
          edges: get().edges.map((e) =>
            e.id === edgeId ? { ...e, data: { ...e.data, calcOp: e.data?.calcOp === op ? null : op } } : e
          ),
        })
        get().recalcConnectors()
        const edge = get().edges.find((e) => e.id === edgeId)
        if (edge?.data?.calcOp) {
          get().logActivity(`🧮 Set connector operator to "${edge.data.calcOp}"`)
        }
      },

      // Section — Connector Calculations. Walks every "=" connector's
      // operator chain (utils/calcEngine.js) and writes any changed result
      // straight into the target node's label — called after any edit that
      // could affect a calculation (a node's label changing, a connector's
      // operator changing) so results stay live, like a tiny spreadsheet.
      // Sets state directly rather than going through updateNodeData (which
      // would just call this again) and doesn't push its own undo snapshot —
      // the edit that triggered the recalc already owns that undo step.
      recalcConnectors: () => {
        const { nodes, edges } = get()
        const updates = computeCalcUpdates(nodes, edges)
        if (!updates.length) return
        const patchById = new Map(updates.map((u) => [u.id, u.label]))
        set({
          nodes: nodes.map((n) =>
            patchById.has(n.id) ? { ...n, data: { ...n.data, label: patchById.get(n.id) } } : n
          ),
        })
      },

      deleteNode: (id) => {
        const node = get().nodes.find((n) => n.id === id)
        get().pushSnapshot()
        set({
          nodes: get().nodes.filter((n) => n.id !== id),
          edges: get().edges.filter((e) => e.source !== id && e.target !== id),
        })
        get().logActivity(`🗑️ Deleted "${node?.data?.label || id}"`)
      },

      // Same as deleteNode, but fades the node (and its connected edges) out
      // first instead of popping it out of existence instantly — called from
      // the node's own delete button and the right-click "Delete" item.
      // `.react-flow__node`/`.react-flow__edge-path` already carry a global
      // opacity transition (see index.css), so setting opacity: 0 here is
      // all it takes; the actual removal (and its undo snapshot) just waits
      // out that transition.
      deleteNodeAnimated: (id) => {
        const node = get().nodes.find((n) => n.id === id)
        if (node?.data?.locked) return
        set({
          nodes: get().nodes.map((n) =>
            n.id === id ? { ...n, style: { ...n.style, opacity: 0, pointerEvents: 'none' } } : n
          ),
          edges: get().edges.map((e) =>
            e.source === id || e.target === id ? { ...e, style: { ...e.style, opacity: 0 } } : e
          ),
        })
        setTimeout(() => {
          if (get().nodes.some((n) => n.id === id)) get().deleteNode(id)
        }, DELETE_FADE_MS)
      },

      // Right-click context menu — delete a node's entire branch (all of
      // its descendants) but keep the node itself. Walks down the tree
      // edges (ignores crossEdge relationship links, same as the
      // presentation-mode traversal) collecting every descendant id first.
      deleteChildren: (id) => {
        const node = get().nodes.find((n) => n.id === id)
        const edges = get().edges
        const descendantIds = new Set()
        const visit = (parentId) => {
          edges
            .filter((e) => e.source === parentId && e.type !== 'crossEdge')
            .forEach((e) => {
              if (!descendantIds.has(e.target)) {
                descendantIds.add(e.target)
                visit(e.target)
              }
            })
        }
        visit(id)
        if (descendantIds.size === 0) return
        get().pushSnapshot()
        set({
          nodes: get().nodes.filter((n) => !descendantIds.has(n.id)),
          edges: get().edges.filter(
            (e) => !descendantIds.has(e.source) && !descendantIds.has(e.target)
          ),
        })
        get().logActivity(`🗑️ Deleted children of "${node?.data?.label || id}"`)
      },

      // Right-click context menu — clone a node (and give it a fresh id) a
      // little below/right of the original. Doesn't copy any incoming edge,
      // so it starts as a floating duplicate the user can re-attach.
      duplicateNode: (id) => {
        const node = get().nodes.find((n) => n.id === id)
        if (!node) return null
        get().pushSnapshot()
        const newId = nextId()
        const newNode = {
          ...node,
          id: newId,
          selected: false,
          position: { x: node.position.x + 36, y: node.position.y + 36 },
          data: { ...node.data, isRoot: false, label: `${node.data?.label || 'Node'} (copy)` },
        }
        set({ nodes: [...get().nodes, newNode] })
        get().logActivity(`📄 Duplicated "${node.data?.label}"`)
        return newId
      },

      setNodesPositions: (nodes) => set({ nodes }),

      // Section — Copy/Paste a node (right-click menu). Copy grabs this
      // node's full `data` (text, size, colors, shape, icon/emoji, motion
      // class — every visual field CustomNode.jsx reads) plus the style
      // of the connector feeding into it, if any. Excludes purely
      // relational/instance fields (isRoot, links, linkedTradeId, task,
      // notes/attachments, collapsed/locked/hidden state) since those
      // describe THIS node's place in the map, not its look — copying
      // them onto a pasted node elsewhere would carry over things like
      // "locked" or a linked trade that make no sense detached from the
      // original.
      copyNode: (id) => {
        const node = get().nodes.find((n) => n.id === id)
        if (!node) return
        const {
          isRoot, links, linkedTradeId, task, notes, attachments, audioNote, videoEmbed,
          collapsed, locked, hidden, badges, date, checklists,
          ...visualData
        } = node.data || {}
        const incomingEdge = get().edges.find((e) => e.target === id && e.type !== 'crossEdge')
        set({
          nodeClipboard: {
            data: { ...visualData },
            edgeStyle: incomingEdge
              ? { style: incomingEdge.style || null, animated: incomingEdge.animated, data: incomingEdge.data || null }
              : null,
          },
        })
        get().logActivity(`📋 Copied "${node.data?.label}"`)
        useUiStore.getState().showToast?.(`Copied "${node.data?.label}"`)
      },

      // Paste onto `targetId` — creates a brand-new child node under the
      // right-clicked node using the copied visual data, and wires up the
      // new connector with the copied connector's style so both the node
      // AND the line leading to it match the original.
      pasteNodeOnto: (targetId) => {
        const clip = get().nodeClipboard
        const parent = get().nodes.find((n) => n.id === targetId)
        if (!clip || !parent) return null
        get().pushSnapshot()
        const id = nextId()
        const newNode = {
          id,
          type: 'mindNode',
          position: { x: parent.position.x + 220, y: parent.position.y + (Math.random() * 80 - 40) },
          data: { ...clip.data, isRoot: false },
        }
        const newEdge = {
          id: `e_${targetId}_${id}`,
          source: targetId,
          target: id,
          type: 'mindEdge',
          animated: clip.edgeStyle?.animated ?? true,
          style: clip.edgeStyle?.style || undefined,
          data: clip.edgeStyle?.data || undefined,
        }
        set({ nodes: [...get().nodes, newNode], edges: [...get().edges, newEdge] })
        get().logActivity(`📋 Pasted "${newNode.data.label}" under "${parent.data.label}"`)
        return id
      },

      // Section — "Copy all" (right-click → Copy all connected). Walks
      // every edge from `id` in BOTH directions (source→target AND
      // target→source, across mindEdge AND crossEdge alike) so the whole
      // connected cluster the node belongs to — parents, children,
      // siblings-through-a-chain, cross-linked calc nodes, all of it —
      // comes along as one unit. Node data is copied in full (unlike
      // copyNode, nothing is stripped) and positions are stored relative
      // to the clicked node so pasting elsewhere keeps the same internal
      // layout.
      copyConnectedGroup: (id) => {
        const { nodes, edges } = get()
        const anchor = nodes.find((n) => n.id === id)
        if (!anchor) return
        const visited = new Set([id])
        const queue = [id]
        while (queue.length) {
          const current = queue.shift()
          edges.forEach((e) => {
            if (e.source === current && !visited.has(e.target)) {
              visited.add(e.target)
              queue.push(e.target)
            }
            if (e.target === current && !visited.has(e.source)) {
              visited.add(e.source)
              queue.push(e.source)
            }
          })
        }
        const groupNodes = nodes.filter((n) => visited.has(n.id))
        const groupEdges = edges.filter((e) => visited.has(e.source) && visited.has(e.target))

        set({
          nodeGroupClipboard: {
            anchorId: id,
            nodes: groupNodes.map((n) => ({
              id: n.id,
              type: n.type,
              position: { x: n.position.x - anchor.position.x, y: n.position.y - anchor.position.y },
              data: { ...n.data },
              draggable: n.draggable,
            })),
            edges: groupEdges.map((e) => ({
              source: e.source,
              target: e.target,
              type: e.type,
              animated: e.animated,
              style: e.style || null,
              data: e.data || null,
              sourceHandle: e.sourceHandle || null,
              targetHandle: e.targetHandle || null,
              markerEnd: e.markerEnd || null,
              markerStart: e.markerStart || null,
            })),
          },
        })
        get().logActivity(`📚 Copied ${groupNodes.length} connected node${groupNodes.length > 1 ? 's' : ''} (from "${anchor.data?.label || id}")`)
        useUiStore.getState().showToast?.(`Copied ${groupNodes.length} connected nodes — right-click anywhere and choose "Paste all here"`)
      },

      // Paste onto `targetId` — recreates the entire copied cluster with
      // fresh ids (remapping every internal edge to match), positioned
      // relative to the target using the same layout the original cluster
      // had, then wires the cluster's original anchor node in as a new
      // child of `targetId` so the whole thing attaches in one place.
      pasteConnectedGroupOnto: (targetId) => {
        const clip = get().nodeGroupClipboard
        const parent = get().nodes.find((n) => n.id === targetId)
        if (!clip || !parent || !clip.nodes.length) return []
        get().pushSnapshot()

        const idMap = new Map()
        clip.nodes.forEach((n) => idMap.set(n.id, nextId()))

        const newNodes = clip.nodes.map((n) => ({
          id: idMap.get(n.id),
          type: n.type,
          position: { x: parent.position.x + 260 + n.position.x, y: parent.position.y + n.position.y },
          // A pasted copy is never a central topic itself (it's being
          // attached under another node) — everything else about the
          // node's data carries over untouched.
          data: { ...n.data, isRoot: false },
          ...(n.draggable === false ? { draggable: false } : {}),
        }))

        const newEdges = clip.edges.map((e) => ({
          id: `e_${idMap.get(e.source)}_${idMap.get(e.target)}`,
          source: idMap.get(e.source),
          target: idMap.get(e.target),
          type: e.type,
          animated: e.animated,
          style: e.style || undefined,
          data: e.data || undefined,
          sourceHandle: e.sourceHandle || undefined,
          targetHandle: e.targetHandle || undefined,
          markerEnd: e.markerEnd || undefined,
          markerStart: e.markerStart || undefined,
        }))

        const anchorNewId = idMap.get(clip.anchorId)
        if (anchorNewId) {
          newEdges.push({
            id: `e_${targetId}_${anchorNewId}`,
            source: targetId,
            target: anchorNewId,
            type: 'mindEdge',
            animated: true,
          })
        }

        set({ nodes: [...get().nodes, ...newNodes], edges: [...get().edges, ...newEdges] })
        get().logActivity(`📚 Pasted ${newNodes.length} connected nodes under "${parent.data?.label || targetId}"`)
        return newNodes.map((n) => n.id)
      },

      // Section 4.8 — connector line styles showcase (curved, straight,
      // dashed, arrows, icon-in-middle, animated flow…). Swaps the canvas
      // to a generated sample map; current map is pushed to undo history.
      loadConnectorDemo: () => {
        get().pushSnapshot()
        const { nodes, edges } = buildConnectorDemo()
        set({ nodes, edges })
        get().logActivity('🔗 Loaded connector-styles demo map (18 line styles)')
      },

      // Left "Connector Styles" panel — apply one of the predefined line
      // styles (path shape, dash, color, width, arrows, animation, mid-icon).
      // If the user has selected specific edge(s), only those change;
      // otherwise the style is applied to every connector on the canvas so
      // clicking a style always visibly does something.
      // Section — connector scale. Multiplies the thickness of every
      // connector (or just the selected ones, same targeting rule as
      // applyLineStyleToSelectedEdges) against its own original width, so
      // scaling down and back up returns to the same base thickness
      // instead of compounding. Driven by the slider at the top of the
      // Connector Styles panel.
      // Shared targeting rule for the Connector Styles panel (both the line
      // style swatches and the scale slider): most specific selection wins.
      //  1. If specific connector line(s) are selected on the canvas, use
      //     exactly those.
      //  2. Else, if node(s) are selected, target only THAT node's own
      //     outgoing connectors (i.e. the lines to its direct children) —
      //     so selecting one branch's parent node and picking a style only
      //     restyles that branch, not the whole map.
      //  3. Else (nothing selected at all), fall back to every connector,
      //     so clicking a style always visibly does something.
      getConnectorTargetIds: () => {
        const allEdges = get().edges
        const selectedEdgeIds = allEdges.filter((e) => e.selected).map((e) => e.id)
        if (selectedEdgeIds.length) return selectedEdgeIds
        const selectedNodeIds = new Set(get().nodes.filter((n) => n.selected).map((n) => n.id))
        if (selectedNodeIds.size) {
          const childEdgeIds = allEdges.filter((e) => selectedNodeIds.has(e.source)).map((e) => e.id)
          if (childEdgeIds.length) return childEdgeIds
        }
        return allEdges.map((e) => e.id)
      },

      setConnectorScale: (scale) => {
        const allEdges = get().edges
        if (!allEdges.length) return 0
        get().pushSnapshotBurst()
        const targetIds = get().getConnectorTargetIds()
        const idSet = new Set(targetIds)
        set({
          edges: get().edges.map((e) => {
            if (!idSet.has(e.id)) return e
            const baseWidth = e.data?.baseStrokeWidth ?? e.data?.strokeWidth ?? 2
            return {
              ...e,
              type: 'demoEdge',
              data: {
                ...e.data,
                baseStrokeWidth: baseWidth,
                strokeWidth: Math.round(baseWidth * scale * 10) / 10,
              },
            }
          }),
        })
        return targetIds.length
      },

      applyLineStyleToSelectedEdges: (style) => {
        const allEdges = get().edges
        if (!allEdges.length) return 0
        const targetIds = get().getConnectorTargetIds()
        get().pushSnapshot()
        const idSet = new Set(targetIds)
        set({
          edges: get().edges.map((e) => {
            if (!idSet.has(e.id)) return e
            return {
              ...e,
              type: 'demoEdge',
              // Explicitly override the top-level RF `animated` flag too —
              // otherwise an edge originally created with `animated: true`
              // (the default for normal connections) keeps React Flow's own
              // built-in dashed marching-ants CSS even after switching to a
              // "solid" style, since that flag is separate from our custom
              // `data.animated` used by ConnectorDemoEdge.
              animated: !!style.animated,
              markerEnd: style.arrowEnd
                ? { type: 'arrowclosed', color: style.color || '#333533', width: 16, height: 16 }
                : undefined,
              markerStart: style.arrowStart
                ? { type: 'arrowclosed', color: style.color || '#333533', width: 16, height: 16 }
                : undefined,
              data: {
                pathType: style.pathType,
                dash: style.dash,
                strokeWidth: style.strokeWidth || 2,
                color: style.color || '#333533',
                animated: !!style.animated,
                iconMid: style.iconMid || null,
                cap: style.cap,
                glow: !!style.glow,
                gradient: style.gradient || null,
                pulseWidth: !!style.pulseWidth,
                // Preserve any Connector Calculation operator this
                // connector already carried — a line-style pick shouldn't
                // silently wipe out a +/-/×/÷/= calculation.
                calcOp: e.data?.calcOp || null,
              },
            }
          }),
        })
        get().logActivity(
          `🎨 Applied "${style.label}" line style to ${targetIds.length} connector${targetIds.length > 1 ? 's' : ''}`
        )
        return targetIds.length
      },

      // Section — Whiteboard "attach to node". A whiteboard note (text or
      // sticky element, created on the free-form Whiteboard canvas) gets
      // copied onto the target node's own data.whiteboardNotes array. It
      // deliberately lives alongside data.notes/attachments/etc. rather than
      // in a separate store, so it rides along for free with everything
      // that already touches node.data: undo/redo, per-project save, cloud
      // sync, JSON backup/import, and share links.
      attachWhiteboardNote: (nodeId, note) => {
        const node = get().nodes.find((n) => n.id === nodeId)
        if (!node) return
        get().pushSnapshot()
        set({
          nodes: get().nodes.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, whiteboardNotes: [...(n.data.whiteboardNotes || []), note] } }
              : n
          ),
        })
        get().logActivity(`📌 Attached a whiteboard note to "${node.data?.label || nodeId}"`)
      },

      removeWhiteboardNote: (nodeId, noteId) => {
        get().pushSnapshot()
        set({
          nodes: get().nodes.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, whiteboardNotes: (n.data.whiteboardNotes || []).filter((x) => x.id !== noteId) } }
              : n
          ),
        })
      },

      // Section — Checklist Library "apply to node" actions. A checklist's
      // own name/items live in checklistStore (its own persisted store);
      // what's stored here on the node is just which checklists are
      // attached and which of their items are checked *for this node*, so
      // the same checklist template can be applied to many nodes with
      // independent progress. node.data.checklists: [{ checklistId,
      // checkedItemIds: [] }].
      applyChecklistToNode: (nodeId, checklistId) => {
        const node = get().nodes.find((n) => n.id === nodeId)
        if (!node) return
        if ((node.data.checklists || []).some((c) => c.checklistId === checklistId)) return
        get().pushSnapshot()
        set({
          nodes: get().nodes.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: { ...n.data, checklists: [...(n.data.checklists || []), { checklistId, checkedItemIds: [] }] },
                }
              : n
          ),
        })
        get().logActivity(`✅ Applied a checklist to "${node.data?.label || nodeId}"`)
      },

      removeChecklistFromNode: (nodeId, checklistId) => {
        get().pushSnapshot()
        set({
          nodes: get().nodes.map((n) =>
            n.id === nodeId
              ? { ...n, data: { ...n.data, checklists: (n.data.checklists || []).filter((c) => c.checklistId !== checklistId) } }
              : n
          ),
        })
      },

      toggleChecklistItemOnNode: (nodeId, checklistId, itemId) => {
        get().pushSnapshotBurst()
        set({
          nodes: get().nodes.map((n) => {
            if (n.id !== nodeId) return n
            const checklists = (n.data.checklists || []).map((c) => {
              if (c.checklistId !== checklistId) return c
              const isChecked = c.checkedItemIds.includes(itemId)
              return {
                ...c,
                checkedItemIds: isChecked
                  ? c.checkedItemIds.filter((x) => x !== itemId)
                  : [...c.checkedItemIds, itemId],
              }
            })
            return { ...n, data: { ...n.data, checklists } }
          }),
        })
      },

      // Section — Style Library. Applies a preset from nodeStyles.js onto
      // the selected node(s), or every node on the canvas if none are
      // selected (same targeting rule as applyLineStyleToSelectedEdges, so
      // the panel always visibly does something). Explicitly clears the
      // fields a preset doesn't set (customBg/glowColor/etc.) so switching
      // from one preset to another never leaves a stale field behind.
      applyNodeStyle: (preset) => {
        const allNodes = get().nodes
        if (!allNodes.length) return 0
        const selectedIds = allNodes.filter((n) => n.selected).map((n) => n.id)
        const targetIds = selectedIds.length ? selectedIds : allNodes.map((n) => n.id)
        get().pushSnapshot()
        const idSet = new Set(targetIds)
        set({
          nodes: get().nodes.map((n) => {
            if (!idSet.has(n.id)) return n
            return {
              ...n,
              data: {
                ...n.data,
                color: preset.color || null,
                customBg: preset.customBg || null,
                bgSize: preset.bgSize || null,
                textColor: preset.textColor || n.data.textColor,
                glowColor: preset.glowColor || null,
                customBorder: preset.customBorder || null,
                animationClass: preset.animationClass || null,
                sizeScale: preset.sizeScale || n.data.sizeScale,
                // Section — Custom Style Library extras. Same "explicitly
                // clear when the preset doesn't set it" rule as the fields
                // above, so switching presets never leaves a stale font
                // size / bold flag / opacity / corner radius behind from a
                // previously-applied style.
                fontSize: preset.fontSize || null,
                fontFamily: preset.fontFamily || null,
                bold: !!preset.bold,
                italic: !!preset.italic,
                underline: !!preset.underline,
                opacity: preset.opacity != null ? preset.opacity : null,
                borderRadius: preset.borderRadius != null ? preset.borderRadius : null,
                numbersOnly: !!preset.numbersOnly,
              },
            }
          }),
        })
        get().logActivity(`🎨 Applied "${preset.name}" style to ${targetIds.length} node${targetIds.length > 1 ? 's' : ''}`)
        return targetIds.length
      },

      // Section — Custom Style Library. Saves a user-built preset (from
      // CustomStyleBuilder.jsx) into customNodeStyles so it shows up
      // under the Style Library's "Custom" tab from then on, same shape
      // as the built-in NODE_STYLE_PRESETS so applyNodeStyle handles it
      // identically either way.
      addCustomNodeStyle: (preset) => {
        set({ customNodeStyles: [...get().customNodeStyles, preset] })
      },

      deleteCustomNodeStyle: (id) => {
        set({ customNodeStyles: get().customNodeStyles.filter((p) => p.id !== id) })
      },

      // Section — Custom Connector Library. Saves a user-built line style
      // (from CustomConnectorBuilder.jsx) into customConnectorStyles so it
      // shows up under the Connector Styles panel's "Custom" section from
      // then on, same shape as CONNECTOR_STYLES so applyLineStyleToSelectedEdges
      // handles it identically either way.
      addCustomConnectorStyle: (style) => {
        set({ customConnectorStyles: [...get().customConnectorStyles, style] })
      },

      deleteCustomConnectorStyle: (id) => {
        set({ customConnectorStyles: get().customConnectorStyles.filter((s) => s.id !== id) })
      },
    }),
    { name: 'mindmap-storage', partialize: (state) => ({ nodes: state.nodes, edges: state.edges, groups: state.groups, activityLog: state.activityLog, customNodeStyles: state.customNodeStyles, customConnectorStyles: state.customConnectorStyles }) }
  )
)
