import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Spline, Waves, Plus, Trash2, Wand2 } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { useUiStore } from '../../store/uiStore'
import { CONNECTOR_STYLES, CONNECTOR_STYLE_CATEGORIES } from '../../utils/connectorDemoData'
import { ICONS } from '../../theme/iconSet'
import CustomConnectorBuilder from './CustomConnectorBuilder'

// Small inline preview so people can see what a style looks like before
// applying it, without leaving the panel or opening the demo map.
let previewCounter = 0
function StylePreview({ style }) {
  const color = style.color || 'var(--color-slate)'
  const width = style.strokeWidth || 2
  let d = 'M4 12 H56'
  if (style.pathType === 'step') d = 'M4 12 H26 V6 H56'
  else if (style.pathType === 'smoothstep') d = 'M4 12 H22 Q26 12 26 8 V10 Q26 6 30 6 H56'
  else if (style.pathType === 'bezier' || style.pathType === 'simplebezier') d = 'M4 12 C 22 2, 38 22, 56 12'

  const IconComp = style.iconMid ? ICONS[style.iconMid] : null
  // Each swatch needs its own gradient id — several "Gradient Flow"/
  // "Rainbow Arrow" previews render side by side, so a shared id would
  // make every one of them paint with whichever def was declared last.
  const [gradientId] = useState(() => `preview-gradient-${++previewCounter}`)
  const strokeColor = style.gradient ? `url(#${gradientId})` : color
  const effectClass = [style.animated ? 'connector-preview-animated' : '', style.glow ? 'connector-glow-pulse' : '', style.pulseWidth ? 'connector-width-pulse' : '']
    .filter(Boolean)
    .join(' ')

  return (
    <svg viewBox="0 0 60 24" className="h-6 w-14 shrink-0">
      {style.gradient && (
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={style.gradient[0]} />
            <stop offset="100%" stopColor={style.gradient[1]} />
          </linearGradient>
        </defs>
      )}
      <path
        d={d}
        fill="none"
        stroke={strokeColor}
        strokeWidth={width}
        strokeDasharray={style.dash || undefined}
        strokeLinecap={style.cap || undefined}
        className={effectClass}
        style={{
          '--glow-color': style.color || 'var(--color-accent)',
          '--pulse-min': Math.max(1, width - 1.5) + 'px',
          '--pulse-max': width + 3 + 'px',
        }}
      />
      {style.arrowEnd && (
        <polygon points="56,12 49,9 49,15" fill={style.gradient ? style.gradient[1] : color} />
      )}
      {style.arrowStart && (
        <polygon points="4,12 11,9 11,15" fill={style.gradient ? style.gradient[0] : color} />
      )}
      {IconComp && (
        <foreignObject x="22" y="2" width="16" height="16">
          <div
            className="flex h-4 w-4 items-center justify-center rounded-full border shadow"
            style={{ backgroundColor: 'var(--color-cream)', borderColor: color }}
          >
            <IconComp size={9} color="var(--color-ink)" />
          </div>
        </foreignObject>
      )}
    </svg>
  )
}

export default function ConnectorStylesPanel() {
  const open = useUiStore((s) => s.connectorPanelOpen)
  const toggle = useUiStore((s) => s.toggleConnectorPanel)
  const showToast = useUiStore((s) => s.showToast)
  const applyLineStyleToSelectedEdges = useMapStore((s) => s.applyLineStyleToSelectedEdges)
  const setConnectorScale = useMapStore((s) => s.setConnectorScale)
  const edges = useMapStore((s) => s.edges)
  const selectedCount = edges.filter((e) => e.selected).length
  const customConnectorStyles = useMapStore((s) => s.customConnectorStyles)
  const deleteCustomConnectorStyle = useMapStore((s) => s.deleteCustomConnectorStyle)

  // Local slider value only — the store keeps each edge's own base width,
  // so this doesn't need to track any particular edge's current scale.
  const [scale, setScale] = useState(1)
  const [builderOpen, setBuilderOpen] = useState(false)

  const handleApply = (style) => {
    const count = applyLineStyleToSelectedEdges(style)
    if (!count) {
      showToast('Add at least one connector line first')
    } else if (selectedCount > 0) {
      showToast(`Applied "${style.label}" to ${count} selected connector${count > 1 ? 's' : ''}`)
    } else {
      showToast(`Applied "${style.label}" to all ${count} connector${count > 1 ? 's' : ''}`)
    }
  }

  const handleScaleChange = (value) => {
    setScale(value)
    setConnectorScale(value)
  }

  const groupedStyles = CONNECTOR_STYLE_CATEGORIES.map((cat) => ({
    ...cat,
    styles: CONNECTOR_STYLES.filter((style) => (style.category || 'line') === cat.key),
  })).filter((group) => group.styles.length)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={toggle}
            className="fixed inset-0 top-11 z-30 bg-black/30 sm:hidden"
          />
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="fixed top-11 left-0 bottom-0 z-40 h-auto shrink-0 overflow-hidden border-r shadow-xl sm:static sm:z-auto sm:h-full sm:shadow-none"
            style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
          >
            <div className="flex h-full w-[240px] flex-col p-3">
              <div className="mb-1 flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>
                  <Spline size={13} /> Connector Styles
                </h2>
                <button onClick={toggle} className="rounded p-0.5 hover:bg-[var(--color-sage)]">
                  <X size={13} />
                </button>
              </div>
              <p className="mb-2 text-[10px] leading-snug text-[var(--color-slate)]">
                {selectedCount > 0
                  ? `${selectedCount} line${selectedCount > 1 ? 's' : ''} selected — pick a style to apply.`
                  : 'Pick a style to apply it to every connector — or select specific line(s), or a node (to target just its own child connectors), first to apply it just to those.'}
              </p>

              <div className="mb-3 rounded-md border border-[var(--color-sage)] px-2 py-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: 'var(--color-ink)' }}>
                    <Waves size={11} /> Connector Scale
                  </span>
                  <span className="text-[10px] text-[var(--color-slate)]">{scale.toFixed(2)}×</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="3"
                  step="0.25"
                  value={scale}
                  onChange={(e) => handleScaleChange(Number(e.target.value))}
                  className="w-full accent-[var(--color-accent)]"
                />
                <p className="mt-1 text-[9px] leading-snug text-[var(--color-slate)]">
                  Scales line thickness relative to each connector's own width.
                </p>
              </div>

              <div className="inspector-animate flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-0.5">
                {/* Custom connector section — always shown first so a
                    hand-built line style is one click away, same pattern
                    as the Style Library's "Custom" tab for nodes. */}
                <div>
                  <h3 className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-slate)]">
                    <Wand2 size={10} /> Custom
                  </h3>
                  <div className="flex flex-col gap-1">
                    {customConnectorStyles.map((style) => (
                      <motion.div key={style.id} layout initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="group relative">
                        <button
                          onClick={() => handleApply(style)}
                          className="flex w-full items-center gap-2 rounded-md border border-[var(--color-sage)] px-2 py-1.5 pr-6 text-left transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
                        >
                          <StylePreview style={style} />
                          <span className="truncate text-[10.5px] leading-tight text-[var(--color-ink)]">{style.label}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteCustomConnectorStyle(style.id)
                          }}
                          title="Delete custom connector"
                          className="absolute top-1/2 right-1 -translate-y-1/2 rounded p-0.5 text-[var(--color-slate)] opacity-0 transition-opacity hover:text-[#c1443c] group-hover:opacity-100"
                        >
                          <Trash2 size={11} />
                        </button>
                      </motion.div>
                    ))}
                    <motion.button
                      onClick={() => setBuilderOpen(true)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="flex items-center justify-center gap-1.5 rounded-md border border-dashed border-[var(--color-sage)] px-2 py-2 text-[10.5px] font-medium text-[var(--color-slate)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-ink)]"
                    >
                      <Plus size={12} /> Custom connector line
                    </motion.button>
                  </div>
                </div>

                {groupedStyles.map((group) => (
                  <div key={group.key}>
                    <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-slate)]">
                      {group.label}
                    </h3>
                    <div className="flex flex-col gap-1">
                      {group.styles.map((style) => (
                        <button
                          key={style.label}
                          onClick={() => handleApply(style)}
                          className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-all duration-150 ${
                            group.key === 'effect'
                              ? 'border-[var(--color-sage)] hover:scale-[1.03] hover:border-[var(--color-accent)] hover:shadow-md'
                              : 'border-[var(--color-sage)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/20'
                          }`}
                        >
                          <StylePreview style={style} />
                          <span className="text-[10.5px] leading-tight text-[var(--color-ink)]">{style.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.aside>
        </>
      )}
      {builderOpen && <CustomConnectorBuilder onClose={() => setBuilderOpen(false)} />}
    </AnimatePresence>
  )
}
