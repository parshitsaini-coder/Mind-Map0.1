import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Sparkles, X, Plus, Trash2 } from 'lucide-react'
import { useUiStore } from '../../store/uiStore'
import { useMapStore } from '../../store/mapStore'
import { STYLE_CATEGORIES, NODE_STYLE_PRESETS } from '../../utils/nodeStyles'
import CustomStyleBuilder from './CustomStyleBuilder'

// Live swatch preview — renders with the exact same background/border/glow/
// animation rules as the real canvas node (CustomNode.jsx), so what you see
// in the gallery is exactly what lands on the map. No static screenshots,
// no separate "preview" styling to keep in sync by hand.
function PresetSwatch({ preset, onApply }) {
  const border = preset.customBorder
  const glowShadow = preset.glowColor ? `0 0 10px 2px ${preset.glowColor}55` : null

  return (
    <button
      onClick={() => onApply(preset)}
      className="group flex flex-col items-center gap-2 rounded-lg border border-transparent p-2.5 text-left transition-colors hover:border-[var(--color-sage)] hover:bg-white/60"
    >
      <span
        className={`flex h-9 w-full items-center justify-center rounded-md px-2 text-[11px] font-medium shadow-sm ${preset.animationClass || ''}`}
        style={{
          background: preset.customBg || preset.color || '#fff',
          backgroundSize: preset.bgSize,
          borderColor: border?.color || 'rgba(0,0,0,0.12)',
          borderWidth: border?.width ?? 1,
          borderStyle: border?.style || 'solid',
          boxShadow: glowShadow || undefined,
          '--sonar-color': preset.glowColor ? `${preset.glowColor}8c` : undefined,
          color: preset.textColor || '#242423',
        }}
      >
        Node
      </span>
      <span className="text-center text-[10px] leading-tight text-[var(--color-slate)] group-hover:text-[var(--color-ink)]">
        {preset.name}
      </span>
    </button>
  )
}

function AddStyleTile({ onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--color-slate)] p-2.5 text-[var(--color-slate)] transition-colors hover:border-[var(--color-accent)] hover:bg-white/60 hover:text-[var(--color-accent)]"
    >
      <span className="flex h-9 w-full items-center justify-center rounded-md">
        <Plus size={18} />
      </span>
      <span className="text-center text-[10px] leading-tight">Add custom style</span>
    </button>
  )
}

// Same live preview as PresetSwatch, plus a small delete button (shown on
// hover) since — unlike the built-in gallery — custom styles are the
// user's own and need a way to be removed again.
function CustomPresetSwatch({ preset, onApply, onDelete }) {
  const border = preset.customBorder
  const glowShadow = preset.glowColor ? `0 0 10px 2px ${preset.glowColor}55` : null

  return (
    <div className="group/tile relative flex flex-col items-center gap-2 rounded-lg border border-transparent p-2.5 transition-colors hover:border-[var(--color-sage)] hover:bg-white/60">
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete(preset.id)
        }}
        title="Delete custom style"
        className="absolute right-1 top-1 hidden rounded p-0.5 text-[var(--color-slate)] hover:bg-[var(--color-sage)] hover:text-[#c1443c] group-hover/tile:block"
      >
        <Trash2 size={11} />
      </button>
      <button onClick={() => onApply(preset)} className="flex w-full flex-col items-center gap-2 text-left">
        <span
          className={`flex h-9 w-full items-center justify-center rounded-md px-2 text-[11px] font-medium shadow-sm ${preset.animationClass || ''}`}
          style={{
            background: preset.customBg || preset.color || '#fff',
            backgroundSize: preset.bgSize,
            borderColor: border?.color || 'rgba(0,0,0,0.12)',
            borderWidth: border?.width ?? 1,
            borderStyle: border?.style || 'solid',
            boxShadow: glowShadow || undefined,
            '--sonar-color': preset.glowColor ? `${preset.glowColor}8c` : undefined,
            color: preset.textColor || '#242423',
          }}
        >
          Node
        </span>
        <span className="text-center text-[10px] leading-tight text-[var(--color-slate)] group-hover/tile:text-[var(--color-ink)]">
          {preset.name}
        </span>
      </button>
    </div>
  )
}

export default function StyleLibraryPanel() {
  const open = useUiStore((s) => s.styleLibraryOpen)
  const toggleStyleLibrary = useUiStore((s) => s.toggleStyleLibrary)
  const showToast = useUiStore((s) => s.showToast)
  const applyNodeStyle = useMapStore((s) => s.applyNodeStyle)
  const customNodeStyles = useMapStore((s) => s.customNodeStyles)
  const deleteCustomNodeStyle = useMapStore((s) => s.deleteCustomNodeStyle)
  const nodes = useMapStore((s) => s.nodes)
  const [activeCategory, setActiveCategory] = useState('Solid')
  const [builderOpen, setBuilderOpen] = useState(false)

  if (!open) return null

  const selectedCount = nodes.filter((n) => n.selected).length
  const targetLabel = selectedCount > 0 ? `${selectedCount} selected node${selectedCount > 1 ? 's' : ''}` : `all ${nodes.length} nodes`

  const handleApply = (preset) => {
    const count = applyNodeStyle(preset)
    showToast(`Applied "${preset.name}" to ${count} node${count > 1 ? 's' : ''}`)
    toggleStyleLibrary()
  }

  const presetsInCategory = activeCategory === 'Custom' ? customNodeStyles : NODE_STYLE_PRESETS.filter((p) => p.category === activeCategory)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/40 p-6"
        onClick={(e) => e.target === e.currentTarget && toggleStyleLibrary()}
      >
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          className="mt-8 w-full max-w-3xl rounded-xl p-5 shadow-2xl"
          style={{ backgroundColor: '#f5f5f0' }}
        >
          <div className="mb-1 flex items-start justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles size={16} color="var(--color-accent)" />
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                Style Library
              </h2>
            </div>
            <button onClick={toggleStyleLibrary} className="rounded p-0.5 hover:bg-[var(--color-sage)]">
              <X size={15} />
            </button>
          </div>
          <p className="mb-3 text-[10.5px] text-[var(--color-slate)]">
            {NODE_STYLE_PRESETS.length} ready-made styles — colors, gradients, glow/neon, outlines, and live
            animated motion. Applies to <strong>{targetLabel}</strong>
            {selectedCount === 0 && ' (select node(s) first to target just those)'}.
          </p>

          <div className="mb-3 flex flex-wrap gap-1 border-b pb-2" style={{ borderColor: 'var(--color-sage)' }}>
            {STYLE_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                  activeCategory === cat
                    ? 'bg-[var(--color-ink)] text-[var(--color-cream)]'
                    : 'text-[var(--color-slate)] hover:bg-[var(--color-sage)]/50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="grid max-h-[52vh] grid-cols-3 gap-1 overflow-y-auto pr-1 sm:grid-cols-4"
            >
              {activeCategory === 'Custom' && <AddStyleTile onClick={() => setBuilderOpen(true)} />}
              {activeCategory === 'Custom'
                ? presetsInCategory.map((preset) => (
                    <CustomPresetSwatch key={preset.id} preset={preset} onApply={handleApply} onDelete={deleteCustomNodeStyle} />
                  ))
                : presetsInCategory.map((preset) => <PresetSwatch key={preset.id} preset={preset} onApply={handleApply} />)}
              {activeCategory === 'Custom' && presetsInCategory.length === 0 && (
                <p className="col-span-3 mt-2 text-[10.5px] text-[var(--color-slate)] sm:col-span-4">
                  No custom styles yet — click "Add custom style" to build one: background, text color, border, glow,
                  motion, and node size, all in one place.
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </motion.div>
      {builderOpen && <CustomStyleBuilder onClose={() => setBuilderOpen(false)} />}
    </AnimatePresence>
  )
}
