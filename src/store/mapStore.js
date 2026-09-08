import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applyNodeChanges, applyEdgeChanges, addEdge as rfAddEdge } from '@xyflow/react'
import { useUiStore } from './uiStore'
import { runLayout } from '../hooks/useAutoLayout'
import { buildConnectorDemo } from '../utils/connectorDemoData'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { readProjectData, writeProjectData } from './projectsStore'

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

export const useMapStore = create(
  persist(
    (set, get) => ({
      nodes: initialNodes,
      edges: [],
      groups: [],
      history: { past: [], future: [] },
      activityLog: [],
      cloudStatus: 'idle', // 'idle' | 'saving' | 'saved' | 'error'
      activeProjectId: null,

      // Multi-project support — swap the whole canvas over to a different
      // project's saved data. Called by the Tabs bar / Projects dashboard
      // whenever the active project changes. Does NOT push an undo snapshot
      // (switching projects isn't something you'd want to Ctrl+Z through)
      // and resets the undo/redo history, since it belongs to the project
      // being left.
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
        if (error || !data) return
        get().pushSnapshot()
        set({ nodes: data.nodes?.length ? data.nodes : initialNodes, edges: data.edges || [] })
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

      addChildNode: (parentId) => {
        const parent = get().nodes.find((n) => n.id === parentId)
        if (!parent) return
        get().pushSnapshot()
        const id = nextId()
        const newNode = {
          id,
          type: 'mindNode',
          position: {
            x: parent.position.x + 220,
            y: parent.position.y + (Math.random() * 80 - 40),
          },
          data: { label: 'New Node', shape: 'rectangle', color: '#e8eddf' },
        }
        const newEdge = {
          id: `e_${parentId}_${id}`,
          source: parentId,
          target: id,
          type: 'mindEdge',
          animated: true,
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

      updateNodeData: (id, patch) => {
        get().pushSnapshotBurst()
        set({
          nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
        })
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

      deleteNode: (id) => {
        const node = get().nodes.find((n) => n.id === id)
        get().pushSnapshot()
        set({
          nodes: get().nodes.filter((n) => n.id !== id),
          edges: get().edges.filter((e) => e.source !== id && e.target !== id),
        })
        get().logActivity(`🗑️ Deleted "${node?.data?.label || id}"`)
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
      setConnectorScale: (scale) => {
        const allEdges = get().edges
        if (!allEdges.length) return 0
        get().pushSnapshotBurst()
        const selectedIds = allEdges.filter((e) => e.selected).map((e) => e.id)
        const targetIds = selectedIds.length ? selectedIds : allEdges.map((e) => e.id)
        const idSet = new Set(targetIds)
        set({
          edges: get().edges.map((e) => {
            if (!idSet.has(e.id)) return e
            const baseWidth = e.data?.baseStrokeWidth ?? e.data?.strokeWidth ?? 2
            return {
              ...e,
              type: e.type || 'demoEdge',
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
        const selectedIds = allEdges.filter((e) => e.selected).map((e) => e.id)
        const targetIds = selectedIds.length ? selectedIds : allEdges.map((e) => e.id)
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
              },
            }
          }),
        })
        get().logActivity(
          `🎨 Applied "${style.label}" line style to ${targetIds.length} connector${targetIds.length > 1 ? 's' : ''}`
        )
        return targetIds.length
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
              },
            }
          }),
        })
        get().logActivity(`🎨 Applied "${preset.name}" style to ${targetIds.length} node${targetIds.length > 1 ? 's' : ''}`)
        return targetIds.length
      },
    }),
    { name: 'mindmap-storage', partialize: (state) => ({ nodes: state.nodes, edges: state.edges, groups: state.groups, activityLog: state.activityLog }) }
  )
)
