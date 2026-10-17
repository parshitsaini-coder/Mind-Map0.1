import { useEffect, useState } from 'react'
import {
  MousePointer2, Crosshair, Dot, Presentation, Eraser, Ruler, ZoomIn, Magnet, Pin, Lock, LockOpen, Eye, EyeOff, Trash2, ListTree, Star, Smile,
  ChevronRight, Check, Type, StickyNote, Pencil, X,
} from 'lucide-react'
import { useWhiteboardStore } from '../../store/whiteboardStore'
import { TOOLS, GROUPS, DEFAULT_IN_GROUP, GLYPHS } from './drawShapes'

const CURSOR_ITEMS = [
  { id: 'cross', name: 'Cross', icon: Crosshair },
  { id: 'dot', name: 'Dot', icon: Dot },
  { id: 'arrow', name: 'Arrow', icon: MousePointer2 },
  { id: 'demo', name: 'Demonstration (laser pointer)', icon: Presentation },
]
const CURSOR_ICON = { cross: Crosshair, dot: Dot, arrow: MousePointer2, demo: Presentation }

function groupOf(toolId) {
  return GROUPS.find((g) => g.sections.some((s) => s.tools.includes(toolId)))?.id
}

// A bar button: main click area + an optional small ▸ strip that opens the flyout.
function BarBtn({ icon: Icon, title, active, onClick, onArrow, badge, testid, disabled, color }) {
  return (
    <div className="relative flex h-8 w-[46px] shrink-0 items-center" data-flyout-anchor>
      <button
        type="button"
        title={title}
        aria-label={title}
        aria-pressed={!!active}
        data-testid={testid}
        disabled={disabled}
        onClick={onClick}
        className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-30 ${
          active ? 'bg-[var(--color-accent)]' : 'hover:bg-[var(--color-sage)]'
        }`}
        style={{ marginLeft: 2 }}
      >
        <Icon size={16} color={color || 'var(--color-ink)'} />
        {badge && (
          <span className="pointer-events-none absolute left-[22px] top-0.5 rounded bg-[var(--color-ink)] px-0.5 text-[8px] font-bold leading-3 text-[var(--color-cream)]">
            {badge}
          </span>
        )}
      </button>
      {onArrow && (
        <button
          type="button"
          aria-label={`${title} — more`}
          title="More tools"
          onClick={onArrow}
          className="ml-px flex h-8 w-[10px] items-center justify-center rounded-sm text-[var(--color-slate)] hover:bg-[var(--color-sage)] hover:text-[var(--color-ink)]"
        >
          <ChevronRight size={9} />
        </button>
      )}
    </div>
  )
}

const Divider = () => <div className="my-1 h-px w-8 shrink-0" style={{ backgroundColor: 'var(--color-sage)' }} />

function FlyoutShell({ pos, children, width = 232 }) {
  const maxH = Math.max(160, window.innerHeight - pos.top - 10)
  return (
    <div
      data-wbfly
      role="menu"
      className="fixed z-[80] overflow-y-auto rounded-lg border py-1 shadow-2xl"
      style={{
        left: pos.left,
        top: pos.top,
        width,
        maxHeight: maxH,
        backgroundColor: 'var(--color-cream)',
        borderColor: 'var(--color-sage)',
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  )
}

const SectionTitle = ({ children }) => (
  <p className="px-3 pb-0.5 pt-1.5 text-[9px] font-bold uppercase tracking-wider text-[var(--color-slate)]">{children}</p>
)

function MenuRow({ icon: Icon, name, active, onClick, fav, onFav, testid }) {
  return (
    <div className={`group flex items-center ${active ? 'bg-[var(--color-accent)]/60' : 'hover:bg-[var(--color-sage)]/60'}`}>
      <button
        type="button"
        role="menuitem"
        data-testid={testid}
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-1.5 text-left text-[12px] font-medium text-[var(--color-ink)]"
      >
        <Icon size={14} className="shrink-0" />
        <span className="truncate">{name}</span>
        {active && <Check size={11} className="ml-auto shrink-0" />}
      </button>
      {onFav && (
        <button
          type="button"
          aria-label={fav ? `Unpin ${name}` : `Pin ${name} to the bar`}
          title={fav ? 'Remove from favorites' : 'Add to favorites'}
          onClick={onFav}
          className="px-2 py-1.5"
          style={{ color: fav ? '#d99a00' : 'var(--color-slate)', opacity: fav ? 1 : 0.55 }}
        >
          <Star size={12} fill={fav ? 'currentColor' : 'none'} />
        </button>
      )}
    </div>
  )
}

function ObjectTree({ pos, onClose }) {
  const elements = useWhiteboardStore((s) => s.elements)
  const selectedId = useWhiteboardStore((s) => s.selectedId)
  const st = useWhiteboardStore.getState
  const label = (el) => {
    if (el.type === 'shape') return TOOLS[el.tool]?.name || 'Drawing'
    if (el.type === 'path') return el.highlight ? 'Highlighter' : 'Brush stroke'
    if (el.type === 'sticky') return `Note${el.content ? ` — ${el.content.slice(0, 18)}` : ''}`
    return `Text${el.content ? ` — ${el.content.slice(0, 18)}` : ''}`
  }
  const iconOf = (el) => (el.type === 'shape' ? TOOLS[el.tool]?.icon || Pencil : el.type === 'path' ? Pencil : el.type === 'sticky' ? StickyNote : Type)
  return (
    <FlyoutShell pos={pos} width={272}>
      <div className="flex items-center justify-between px-3 pb-1 pt-1.5">
        <p className="text-[11px] font-bold text-[var(--color-ink)]">Object tree · {elements.length}</p>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded p-0.5 hover:bg-[var(--color-sage)]">
          <X size={12} />
        </button>
      </div>
      {elements.length === 0 && <p className="px-3 py-3 text-[11px] text-[var(--color-slate)]">Nothing on the board yet.</p>}
      {[...elements].reverse().map((el) => {
        const Icon = iconOf(el)
        return (
          <div key={el.id} className={`flex items-center gap-1 px-2 py-1 ${selectedId === el.id ? 'bg-[var(--color-accent)]/60' : 'hover:bg-[var(--color-sage)]/50'}`}>
            <button
              type="button"
              onClick={() => {
                st().setTool('select')
                st().selectElement(el.id)
              }}
              className="flex min-w-0 flex-1 items-center gap-2 text-left text-[11px] text-[var(--color-ink)]"
            >
              <Icon size={13} className="shrink-0" />
              <span className="truncate">{label(el)}</span>
            </button>
            <button type="button" title={el.hidden ? 'Show' : 'Hide'} onClick={() => st().toggleElementFlag(el.id, 'hidden')} className="rounded p-1 hover:bg-[var(--color-sage)]">
              {el.hidden ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
            <button type="button" title={el.locked ? 'Unlock' : 'Lock'} onClick={() => st().toggleElementFlag(el.id, 'locked')} className="rounded p-1 hover:bg-[var(--color-sage)]">
              {el.locked ? <Lock size={12} /> : <LockOpen size={12} />}
            </button>
            <button type="button" title="Delete" onClick={() => st().deleteElement(el.id)} className="rounded p-1 text-red-600 hover:bg-red-500/10">
              <Trash2 size={12} />
            </button>
          </div>
        )
      })}
    </FlyoutShell>
  )
}

function GlyphPanel({ pos, onPick }) {
  const [tab, setTab] = useState('Emojis')
  const glyph = useWhiteboardStore((s) => s.glyph)
  return (
    <FlyoutShell pos={pos} width={272}>
      <div className="flex gap-1 px-2 pb-1 pt-1">
        {Object.keys(GLYPHS).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded px-2 py-1 text-[11px] font-semibold ${tab === t ? 'bg-[var(--color-accent)]' : 'hover:bg-[var(--color-sage)]'}`}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-8 gap-0.5 px-2 pb-2">
        {GLYPHS[tab].map((g) => (
          <button
            key={g}
            type="button"
            title={g}
            onClick={() => onPick(g)}
            className={`flex h-8 items-center justify-center rounded text-[18px] hover:bg-[var(--color-sage)] ${glyph === g ? 'bg-[var(--color-accent)]/60' : ''}`}
          >
            {g}
          </button>
        ))}
      </div>
      <p className="px-3 pb-1.5 text-[10px] text-[var(--color-slate)]">Pick one, then click the board to place it. Resize with the A−/A+ buttons.</p>
    </FlyoutShell>
  )
}

// TradingView-style vertical drawing toolbar for the Whiteboard.
export default function WhiteboardLeftBar() {
  const tool = useWhiteboardStore((s) => s.tool)
  const drawTool = useWhiteboardStore((s) => s.drawTool)
  const penKind = useWhiteboardStore((s) => s.penKind)
  const cursorMode = useWhiteboardStore((s) => s.cursorMode)
  const magnet = useWhiteboardStore((s) => s.magnet)
  const stay = useWhiteboardStore((s) => s.stayDrawing)
  const lockAll = useWhiteboardStore((s) => s.lockAll)
  const hideAll = useWhiteboardStore((s) => s.hideAll)
  const favs = useWhiteboardStore((s) => s.drawFavs)
  const lastIn = useWhiteboardStore((s) => s.lastInGroup)
  const count = useWhiteboardStore((s) => s.elements.length)
  const st = useWhiteboardStore.getState

  const [fly, setFly] = useState(null) // { kind, id?, left, top }

  useEffect(() => {
    if (!fly) return undefined
    const off = (e) => {
      if (!e.target.closest?.('[data-wbfly]') && !e.target.closest?.('[data-flyout-anchor]')) setFly(null)
    }
    const esc = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setFly(null)
      }
    }
    window.addEventListener('pointerdown', off)
    window.addEventListener('keydown', esc, true)
    return () => {
      window.removeEventListener('pointerdown', off)
      window.removeEventListener('keydown', esc, true)
    }
  }, [fly])

  const openFly = (e, kind, id) => {
    const r = e.currentTarget.closest('[data-flyout-anchor]').getBoundingClientRect()
    setFly((cur) => (cur && cur.kind === kind && cur.id === id ? null : { kind, id, left: r.right + 6, top: Math.max(8, Math.min(r.top, window.innerHeight - 360)) }))
  }

  const isActiveTool = (id) => {
    const spec = TOOLS[id]
    if (!spec) return false
    if (spec.native?.tool === 'pen') return tool === 'pen' && penKind === spec.native.penKind
    if (spec.native) return tool === spec.native.tool
    return tool === 'draw' && drawTool === id
  }

  const pickTool = (id) => {
    const spec = TOOLS[id]
    if (!spec) return
    const gid = groupOf(id)
    if (gid) st().rememberInGroup(gid, id)
    if (spec.native?.tool === 'pen') st().setPenKind(spec.native.penKind)
    else if (spec.native) st().setTool(spec.native.tool)
    else st().setDrawTool(id)
    setFly(null)
  }

  const cursorActive = tool === 'select' || tool === 'eraser'
  const CursorIcon = tool === 'eraser' ? Eraser : CURSOR_ICON[cursorMode] || MousePointer2

  return (
    <div className="relative flex shrink-0">
      <div
        className="no-scrollbar flex w-[54px] flex-col items-center gap-0.5 overflow-y-auto border-r py-1"
        style={{ backgroundColor: 'var(--color-cream)', borderColor: 'var(--color-sage)' }}
        role="toolbar"
        aria-label="Whiteboard drawing tools"
        aria-orientation="vertical"
      >
        {/* Cursors */}
        <BarBtn
          icon={CursorIcon}
          title="Cursors (V)"
          testid="wb-grp-cursors"
          active={cursorActive}
          onClick={() => st().setTool(tool === 'eraser' ? 'select' : 'select')}
          onArrow={(e) => openFly(e, 'cursors')}
        />
        <Divider />

        {/* Tool groups */}
        {GROUPS.map((g) => {
          const shown = TOOLS[lastIn[g.id] || DEFAULT_IN_GROUP[g.id]] || TOOLS[DEFAULT_IN_GROUP[g.id]]
          const Icon = shown?.icon || g.icon
          const active = g.sections.some((s) => s.tools.some(isActiveTool))
          return (
            <BarBtn
              key={g.id}
              icon={Icon}
              title={`${g.name}${shown ? ` — ${shown.name}` : ''}`}
              testid={`wb-grp-${g.id}`}
              active={active}
              onClick={() => pickTool(lastIn[g.id] || DEFAULT_IN_GROUP[g.id])}
              onArrow={(e) => openFly(e, 'group', g.id)}
            />
          )
        })}

        {/* Icons / emoji / stickers */}
        <BarBtn
          icon={Smile}
          title="Icons, emojis and stickers"
          testid="wb-grp-glyphs"
          active={tool === 'draw' && drawTool === 'emoji'}
          onClick={(e) => openFly(e, 'glyphs')}
        />

        {favs.length > 0 && <Divider />}
        {favs
          .filter((id) => TOOLS[id])
          .map((id) => (
            <BarBtn key={id} icon={TOOLS[id].icon} title={`${TOOLS[id].name} (favorite)`} active={isActiveTool(id)} onClick={() => pickTool(id)} />
          ))}

        <Divider />
        <BarBtn icon={Ruler} title="Measure (M) — drag between two points" testid="wb-measure" active={tool === 'measure'} onClick={() => st().setTool(tool === 'measure' ? 'select' : 'measure')} />
        <BarBtn icon={ZoomIn} title="Zoom in — drag a box to zoom to it" testid="wb-zoom-area" active={tool === 'zoom'} onClick={() => st().setTool(tool === 'zoom' ? 'select' : 'zoom')} />

        <Divider />
        <BarBtn
          icon={Magnet}
          title={`Magnet: ${magnet} — snaps new points to nearby points and corners`}
          testid="wb-magnet"
          active={magnet !== 'off'}
          badge={magnet === 'weak' ? 'W' : magnet === 'strong' ? 'S' : undefined}
          onClick={() => st().setMagnet(magnet === 'off' ? 'weak' : 'off')}
          onArrow={(e) => openFly(e, 'magnet')}
        />
        <BarBtn icon={Pin} title="Stay in drawing mode" testid="wb-stay" active={stay} onClick={() => st().setStayDrawing(!stay)} />
        <BarBtn icon={lockAll ? Lock : LockOpen} title={lockAll ? 'Unlock all drawings' : 'Lock all drawings'} testid="wb-lock" active={lockAll} onClick={() => st().setLockAll(!lockAll)} />
        <BarBtn icon={hideAll ? EyeOff : Eye} title={hideAll ? 'Show all drawings' : 'Hide all drawings'} testid="wb-hide" active={hideAll} onClick={() => st().setHideAll(!hideAll)} />
        <BarBtn icon={Trash2} title="Remove objects" testid="wb-remove" disabled={!count} onClick={(e) => openFly(e, 'remove')} color={count ? '#b91c1c' : undefined} />

        <div className="mt-auto" />
        <Divider />
        <BarBtn icon={ListTree} title="Object tree" testid="wb-tree" active={fly?.kind === 'tree'} onClick={(e) => openFly(e, 'tree')} />
      </div>

      {/* Flyouts */}
      {fly?.kind === 'cursors' && (
        <FlyoutShell pos={fly}>
          <SectionTitle>Cursors</SectionTitle>
          {CURSOR_ITEMS.map((c) => (
            <MenuRow
              key={c.id}
              icon={c.icon}
              name={c.name}
              testid={`wb-cursor-${c.id}`}
              active={tool === 'select' && cursorMode === c.id}
              onClick={() => {
                st().setCursorMode(c.id)
                setFly(null)
              }}
            />
          ))}
          <SectionTitle>Tools</SectionTitle>
          <MenuRow icon={Eraser} name="Eraser (E)" testid="wb-cursor-eraser" active={tool === 'eraser'} onClick={() => { st().setTool('eraser'); setFly(null) }} />
        </FlyoutShell>
      )}

      {fly?.kind === 'group' &&
        (() => {
          const g = GROUPS.find((x) => x.id === fly.id)
          if (!g) return null
          return (
            <FlyoutShell pos={fly}>
              {g.sections.map((sec) => (
                <div key={sec.title}>
                  <SectionTitle>{sec.title}</SectionTitle>
                  {sec.tools.map((id) => (
                    <MenuRow
                      key={id}
                      icon={TOOLS[id].icon}
                      name={TOOLS[id].name}
                      testid={`wb-tool-${id}`}
                      active={isActiveTool(id)}
                      onClick={() => pickTool(id)}
                      fav={favs.includes(id)}
                      onFav={() => st().toggleFav(id)}
                    />
                  ))}
                </div>
              ))}
            </FlyoutShell>
          )
        })()}

      {fly?.kind === 'glyphs' && (
        <GlyphPanel
          pos={fly}
          onPick={(g) => {
            st().setGlyph(g)
            st().setDrawTool('emoji')
            setFly(null)
          }}
        />
      )}

      {fly?.kind === 'magnet' && (
        <FlyoutShell pos={fly} width={200}>
          <SectionTitle>Magnet mode</SectionTitle>
          {[['off', 'Off'], ['weak', 'Weak magnet'], ['strong', 'Strong magnet']].map(([id, name]) => (
            <MenuRow key={id} icon={Magnet} name={name} active={magnet === id} onClick={() => { st().setMagnet(id); setFly(null) }} />
          ))}
        </FlyoutShell>
      )}

      {fly?.kind === 'remove' && (
        <FlyoutShell pos={fly} width={216}>
          <SectionTitle>Remove</SectionTitle>
          <MenuRow
            icon={Pencil}
            name="Remove drawings"
            onClick={() => {
              st().clearDrawings()
              setFly(null)
            }}
          />
          <MenuRow
            icon={Trash2}
            name="Remove all objects"
            onClick={() => {
              if (window.confirm('Clear the entire whiteboard? This removes every note and drawing (Ctrl+Z can undo it).')) st().clearBoard()
              setFly(null)
            }}
          />
          <MenuRow
            icon={Trash2}
            name="Remove selected (Del)"
            onClick={() => {
              if (st().selectedId) st().deleteElement(st().selectedId)
              setFly(null)
            }}
          />
        </FlyoutShell>
      )}

      {fly?.kind === 'tree' && <ObjectTree pos={fly} onClose={() => setFly(null)} />}
    </div>
  )
}
