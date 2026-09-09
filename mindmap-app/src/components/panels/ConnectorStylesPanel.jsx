import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X, Spline, Waves } from 'lucide-react'
import { useMapStore } from '../../store/mapStore'
import { useUiStore } from '../../store/uiStore'
import { CONNECTOR_STYLES, CONNECTOR_STYLE_CATEGORIES } from '../../utils/connectorDemoData'
import { ICONS } from '../../theme/iconSet'

// Small inline preview so people can see what a style looks like before
// applying it, without leaving the panel or opening the demo map.
function StylePreview({ style }) {
  const color = style.color || 'var(--color-slate)'
  const width = style.strokeWidth || 2
  let d = 'M4 12 H56'
  if (style.pathType === 'step') d = 'M4 12 H26 V6 H56'
  else if (style.pathType === 'smoothstep') d = 'M4 12 H22 Q26 12 26 8 V10 Q26 6 30 6 H56'
  else if (style.pathType === 'bezier' || style.pathType === 'simplebezier') d = 'M4 12 C 22 2, 38 22, 56 12'

  const IconComp = style.iconMid ? ICONS[style.iconMid] : null

  return (
    <svg viewBox="0 0 60 24" className="h-6 w-14 shrink-0">
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeDasharray={style.dash || undefined}
        strokeLinecap={style.cap || undefined}
        className={style.animated ? 'connector-preview-animated' : ''}
      />
      {style.arrowEnd && (
        <polygon points="56,12 49,9 49,15" fill={color} />
      )}
      {style.arrowStart && (
        <polygon points="4,12 11,9 11,15" fill={color} />
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

  // Local slider value only — the store keeps each edge's own base width,
  // so this doesn't need to track any particular edge's current scale.
  const [scale, setScale] = useState(1)

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

              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-0.5">
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
                          className="flex items-center gap-2 rounded-md border border-[var(--color-sage)] px-2 py-1.5 text-left transition-colors hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
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
    </AnimatePresence>
  )
}
