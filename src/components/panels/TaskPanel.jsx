import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckSquare, Square, List, GanttChartSquare } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { useUiStore } from '../../store/uiStore'

const PRIORITY_COLOR = (p) => {
  if (!p) return '#cfdbd5'
  if (p <= 3) return '#8fbf9f'
  if (p <= 6) return '#f5cb5c'
  return '#e07856'
}

function daysBetween(a, b) {
  return (b.getTime() - a.getTime()) / 86400000
}

function focusNode(id) {
  useMapStore.setState((s) => ({
    nodes: s.nodes.map((n) => ({ ...n, selected: n.id === id })),
  }))
  useUiStore.getState().setActivePanel('inspector')
}

export default function TaskPanel() {
  const nodes = useMapStore((s) => s.nodes)
  const updateNodeData = useMapStore((s) => s.updateNodeData)
  const [view, setView] = useState('list')

  const taskNodes = nodes.filter((n) => n.data?.task)

  if (taskNodes.length === 0) {
    return (
      <p className="text-xs text-[#333533]">
        No tasks yet. Select a node, open its inspector, and enable the "To-do" marker to turn it
        into a task.
      </p>
    )
  }

  const toggleDone = (n) => updateNodeData(n.id, { task: { ...n.data.task, done: !n.data.task.done } })

  const dated = taskNodes.filter((n) => n.data.task.dueDate)
  const today = new Date()
  const maxDate = dated.length
    ? new Date(Math.max(...dated.map((n) => new Date(n.data.task.dueDate).getTime())))
    : new Date(today.getTime() + 30 * 86400000)
  const totalDays = Math.max(1, daysBetween(today, maxDate))

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        <button
          onClick={() => setView('list')}
          className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] ${
            view === 'list' ? 'border-[#f5cb5c] bg-[#f5cb5c]/30' : 'border-[#cfdbd5]'
          }`}
        >
          <List size={10} /> List
        </button>
        <button
          onClick={() => setView('gantt')}
          className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] ${
            view === 'gantt' ? 'border-[#f5cb5c] bg-[#f5cb5c]/30' : 'border-[#cfdbd5]'
          }`}
        >
          <GanttChartSquare size={10} /> Gantt
        </button>
      </div>

      {view === 'list' ? (
        <ul className="flex flex-col gap-1">
          <AnimatePresence initial={false}>
            {taskNodes.map((n) => (
              <motion.li
                key={n.id}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                whileHover={{ scale: 1.02 }}
                transition={{ duration: 0.16 }}
                className="flex items-center gap-1.5 rounded-md bg-[#cfdbd5]/25 px-1.5 py-1 text-[10px]"
              >
                <button onClick={() => toggleDone(n)}>
                  {n.data.task.done ? <CheckSquare size={13} /> : <Square size={13} />}
                </button>
                <button
                  onClick={() => focusNode(n.id)}
                  className={`flex-1 truncate text-left ${n.data.task.done ? 'line-through opacity-60' : ''}`}
                >
                  {n.data.label}
                </button>
                {n.data.task.assignee && (
                  <span
                    title={n.data.task.assignee}
                    className="flex h-4 w-4 items-center justify-center rounded-full bg-[#f5cb5c] text-[8px] font-bold"
                  >
                    {n.data.task.assignee[0].toUpperCase()}
                  </span>
                )}
                {n.data.task.dueDate && (
                  <span className="shrink-0 text-[9px] text-[#333533]">{n.data.task.dueDate}</span>
                )}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <div className="flex flex-col gap-1.5">
          <p className="text-[9px] text-[#333533]">
            Today → {maxDate.toISOString().slice(0, 10)}
          </p>
          {taskNodes.map((n) => {
            const due = n.data.task.dueDate ? new Date(n.data.task.dueDate) : null
            const widthPct = due ? Math.max(4, Math.min(100, (daysBetween(today, due) / totalDays) * 100)) : 8
            const progress = n.data.badges?.progress ?? (n.data.task.done ? 100 : 0)
            return (
              <button key={n.id} onClick={() => focusNode(n.id)} className="text-left">
                <p className="mb-0.5 truncate text-[10px]">{n.data.label}</p>
                <div className="h-3 w-full rounded-full bg-[#cfdbd5]/40">
                  <div
                    className="h-3 rounded-full"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: PRIORITY_COLOR(n.data.badges?.priority),
                      backgroundImage: `linear-gradient(90deg, #242423 ${progress}%, transparent ${progress}%)`,
                      backgroundBlendMode: 'overlay',
                    }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
