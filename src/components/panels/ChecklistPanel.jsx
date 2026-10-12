import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ListChecks, X, Plus, Pencil, Trash2, Check, ChevronDown, ChevronUp, ChevronRight, Square, CheckSquare } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useMapStore } from '../../store/mapStore'
import { useChecklistStore } from '../../store/checklistStore'

// Small text input that swaps for a save/cancel pair — used for both the
// "create a new checklist" prompt and inline checklist-name editing, so
// naming a checklist never relies on a native window.prompt().
function InlineNameForm({ initialValue = '', placeholder, onSubmit, onCancel, autoFocus = true }) {
  const [value, setValue] = useState(initialValue)
  const commit = () => {
    const trimmed = value.trim()
    if (trimmed) onSubmit(trimmed)
    else onCancel()
  }
  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') onCancel()
        }}
        placeholder={placeholder}
        className="w-full rounded-md border border-[var(--color-sage)] bg-white px-1.5 py-1 text-[11px] outline-none focus:border-[var(--color-accent)]"
      />
      <button
        onClick={commit}
        className="shrink-0 rounded-md p-1 text-white"
        style={{ backgroundColor: 'var(--color-accent)' }}
        title="Save"
      >
        <Check size={11} />
      </button>
      <button
        onClick={onCancel}
        className="shrink-0 rounded-md p-1 text-[var(--color-slate)] hover:text-[var(--color-ink)]"
        title="Cancel"
      >
        <X size={11} />
      </button>
    </div>
  )
}

// One checklist "card" in the library — name (editable), its items
// (editable/deletable/reorderable), an "+ add item" row, and, when a node
// is targeted (nodeId set), an Apply/Remove toggle plus live checkboxes for
// that node's own progress against this checklist.
function ChecklistCard({ checklist, nodeId, appliedInstance }) {
  const [expanded, setExpanded] = useState(true)
  const [renaming, setRenaming] = useState(false)
  const [addingItem, setAddingItem] = useState(false)
  const [editingItemId, setEditingItemId] = useState(null)

  const renameChecklist = useChecklistStore((s) => s.renameChecklist)
  const deleteChecklist = useChecklistStore((s) => s.deleteChecklist)
  const addChecklistItem = useChecklistStore((s) => s.addChecklistItem)
  const updateChecklistItemLabel = useChecklistStore((s) => s.updateChecklistItemLabel)
  const deleteChecklistItem = useChecklistStore((s) => s.deleteChecklistItem)
  const moveChecklistItem = useChecklistStore((s) => s.moveChecklistItem)

  const applyChecklistToNode = useMapStore((s) => s.applyChecklistToNode)
  const removeChecklistFromNode = useMapStore((s) => s.removeChecklistFromNode)
  const toggleChecklistItemOnNode = useMapStore((s) => s.toggleChecklistItemOnNode)

  const isApplied = Boolean(appliedInstance)
  const checkedCount = appliedInstance
    ? appliedInstance.checkedItemIds.filter((id) => checklist.items.some((it) => it.id === id)).length
    : 0

  return (
    <div className="rounded-md border" style={{ borderColor: 'var(--color-sage)', backgroundColor: 'rgba(255,255,255,0.5)' }}>
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button onClick={() => setExpanded((v) => !v)} className="shrink-0 text-[var(--color-slate)]">
          {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        {renaming ? (
          <div className="flex-1">
            <InlineNameForm
              initialValue={checklist.name}
              onSubmit={(name) => {
                renameChecklist(checklist.id, name)
                setRenaming(false)
              }}
              onCancel={() => setRenaming(false)}
            />
          </div>
        ) : (
          <>
            <span className="flex-1 truncate text-[11px] font-semibold text-[var(--color-ink)]">{checklist.name}</span>
            {checklist.items.length > 0 && (
              <span className="shrink-0 text-[9px] text-[var(--color-slate)]">
                {isApplied
                  ? `${checkedCount}/${checklist.items.length}`
                  : `${checklist.items.length} item${checklist.items.length > 1 ? 's' : ''}`}
              </span>
            )}
            <button
              onClick={() => setRenaming(true)}
              className="shrink-0 rounded p-0.5 text-[var(--color-slate)] hover:text-[var(--color-ink)]"
              title="Rename checklist"
            >
              <Pencil size={10} />
            </button>
            <button
              onClick={() => deleteChecklist(checklist.id)}
              className="shrink-0 rounded p-0.5 text-[var(--color-slate)] hover:text-[#c1443c]"
              title="Delete checklist"
            >
              <Trash2 size={10} />
            </button>
          </>
        )}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-0.5 px-2 pb-2">
              {checklist.items.length === 0 && !addingItem && (
                <p className="px-1 py-1 text-[10px] text-[var(--color-slate)]">No checkboxes yet.</p>
              )}
              {checklist.items.map((item, idx) => {
                const checked = isApplied && appliedInstance.checkedItemIds.includes(item.id)
                return (
                  <div
                    key={item.id}
                    className="group flex items-center gap-1 rounded px-1 py-0.5 hover:bg-[var(--color-sage)]/30"
                  >
                    {isApplied ? (
                      <button
                        onClick={() => toggleChecklistItemOnNode(nodeId, checklist.id, item.id)}
                        className="shrink-0"
                        title={checked ? 'Mark unchecked' : 'Mark checked'}
                      >
                        {checked ? (
                          <CheckSquare size={13} color="var(--color-accent)" />
                        ) : (
                          <Square size={13} color="var(--color-slate)" />
                        )}
                      </button>
                    ) : (
                      <Square size={13} className="shrink-0 text-[var(--color-slate)]" />
                    )}
                    {editingItemId === item.id ? (
                      <div className="flex-1">
                        <InlineNameForm
                          initialValue={item.label}
                          onSubmit={(label) => {
                            updateChecklistItemLabel(checklist.id, item.id, label)
                            setEditingItemId(null)
                          }}
                          onCancel={() => setEditingItemId(null)}
                        />
                      </div>
                    ) : (
                      <>
                        <span
                          className={`flex-1 truncate text-[11px] ${
                            checked ? 'text-[var(--color-slate)] line-through' : 'text-[var(--color-ink)]'
                          }`}
                        >
                          {item.label}
                        </span>
                        <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
                          <button
                            onClick={() => moveChecklistItem(checklist.id, item.id, 'up')}
                            disabled={idx === 0}
                            className="rounded p-0.5 text-[var(--color-slate)] hover:text-[var(--color-ink)] disabled:opacity-30"
                            title="Move up"
                          >
                            <ChevronUp size={10} />
                          </button>
                          <button
                            onClick={() => moveChecklistItem(checklist.id, item.id, 'down')}
                            disabled={idx === checklist.items.length - 1}
                            className="rounded p-0.5 text-[var(--color-slate)] hover:text-[var(--color-ink)] disabled:opacity-30"
                            title="Move down"
                          >
                            <ChevronDown size={10} />
                          </button>
                          <button
                            onClick={() => setEditingItemId(item.id)}
                            className="rounded p-0.5 text-[var(--color-slate)] hover:text-[var(--color-ink)]"
                            title="Edit label"
                          >
                            <Pencil size={10} />
                          </button>
                          <button
                            onClick={() => deleteChecklistItem(checklist.id, item.id)}
                            className="rounded p-0.5 text-[var(--color-slate)] hover:text-[#c1443c]"
                            title="Delete checkbox"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}

              {addingItem ? (
                <div className="mt-0.5 pl-5">
                  <InlineNameForm
                    key={checklist.items.length}
                    placeholder="Checkbox name…"
                    onSubmit={(label) => addChecklistItem(checklist.id, label)}
                    onCancel={() => setAddingItem(false)}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setAddingItem(true)}
                  className="mt-0.5 flex w-fit items-center gap-1 pl-5 text-[10px] text-[var(--color-slate)] hover:text-[var(--color-ink)]"
                >
                  <Plus size={11} /> Add checkbox
                </button>
              )}

              {nodeId && (
                <button
                  onClick={() =>
                    isApplied
                      ? removeChecklistFromNode(nodeId, checklist.id)
                      : applyChecklistToNode(nodeId, checklist.id)
                  }
                  className={`mt-1.5 w-full rounded-md px-2 py-1 text-[10px] font-semibold ${
                    isApplied ? 'text-[var(--color-slate)] hover:text-[#c1443c]' : 'text-white'
                  }`}
                  style={{
                    backgroundColor: isApplied ? 'transparent' : 'var(--color-accent)',
                    border: isApplied ? '1px dashed var(--color-slate)' : 'none',
                  }}
                >
                  {isApplied ? 'Remove from this node' : 'Apply to this node'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Right-click a node → "Checklist" (or the toolbar's list-check icon)
// opens this. Build any number of named checklists, each with any number
// of checkboxes — then, when opened for a specific node, apply any of
// them to it and tick items off right here. The checklist templates
// (names + items) live in checklistStore and are shared across the whole
// map; which items are checked is stored per-node (mapStore.js), so the
// same checklist can be reused on many nodes independently.
export default function ChecklistPanel() {
  const open = useUiStore((s) => s.checklistPanelOpen)
  const nodeId = useUiStore((s) => s.checklistPanelNodeId)
  const close = useUiStore((s) => s.closeChecklistPanel)
  const node = useMapStore((s) => (nodeId ? s.nodes.find((n) => n.id === nodeId) : null))
  const checklists = useChecklistStore((s) => s.checklists)
  const addChecklist = useChecklistStore((s) => s.addChecklist)
  const [creating, setCreating] = useState(false)

  const appliedByChecklistId = new Map((node?.data?.checklists || []).map((c) => [c.checklistId, c]))

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="fixed inset-0 top-11 z-30 bg-black/20"
          />
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 268, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="fixed top-11 left-0 bottom-0 z-40 overflow-hidden border-r shadow-xl"
            style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
          >
            <div className="flex h-full w-[268px] flex-col p-3">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
                  <ListChecks size={13} /> Checklists
                </h2>
                <button onClick={close} className="rounded p-0.5 hover:bg-[var(--color-sage)]">
                  <X size={13} />
                </button>
              </div>
              <p className="mb-2 text-[10px] leading-snug text-[var(--color-slate)]">
                {node ? (
                  <>
                    Applying to "<strong>{node.data?.label || 'this node'}</strong>". Build a checklist below, then Apply it.
                  </>
                ) : (
                  "Create and edit your checklists here. Open this from a node's right-click menu to apply one."
                )}
              </p>

              <div className="mb-2 shrink-0">
                {creating ? (
                  <InlineNameForm
                    placeholder="Checklist name…"
                    onSubmit={(name) => {
                      addChecklist(name)
                      setCreating(false)
                    }}
                    onCancel={() => setCreating(false)}
                  />
                ) : (
                  <button
                    onClick={() => setCreating(true)}
                    className="flex w-full items-center justify-center gap-1 rounded-md py-1.5 text-[11px] font-semibold text-white"
                    style={{ backgroundColor: 'var(--color-accent)' }}
                  >
                    <Plus size={12} /> Create checklist
                  </button>
                )}
              </div>

              <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
                {checklists.length === 0 ? (
                  <p className="px-1 py-4 text-center text-[10px] text-[var(--color-slate)]">
                    No checklists yet — create your first one above.
                  </p>
                ) : (
                  checklists.map((c) => (
                    <ChecklistCard
                      key={c.id}
                      checklist={c}
                      nodeId={nodeId}
                      appliedInstance={appliedByChecklistId.get(c.id)}
                    />
                  ))
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}
