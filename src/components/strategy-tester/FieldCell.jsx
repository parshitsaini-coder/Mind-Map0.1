import { useRef, useState } from 'react'
import { Camera, Check, Loader2, StickyNote } from 'lucide-react'
import { RRR_OPTIONS } from '../../utils/strategyTesterFields'
import { uploadTradeImage } from '../../lib/imageUpload'
import { useUiStore } from '../../store/uiStore'
import NotesPopup from './NotesPopup'

const inputCls = 'st-cell-input'

export default function FieldCell({ field, value, onChange, rowLabel }) {
  const [uploading, setUploading] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const fileRef = useRef(null)

  switch (field.type) {
    case 'checkbox':
      return (
        <button
          type="button"
          onClick={() => onChange(!value)}
          className="flex h-full w-full items-center justify-center"
          title={field.label}
        >
          <span
            className="flex h-3 w-3 items-center justify-center rounded-[3px] border transition-colors"
            style={{
              borderColor: value ? 'var(--ta-accent)' : 'var(--ta-slate)',
              backgroundColor: value ? 'var(--ta-accent)' : 'transparent',
            }}
          >
            {value && <Check size={8} color="#fffcf2" strokeWidth={3} />}
          </span>
        </button>
      )

    case 'buysell':
      return (
        <div className="flex items-center justify-center gap-0.5">
          {[
            { key: 'buy', label: 'B', color: '#16a34a' },
            { key: 'sell', label: 'S', color: '#dc2626' },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(value === opt.key ? null : opt.key)}
              className="flex h-4 w-4 items-center justify-center rounded-[3px] text-[8.5px] font-bold transition-colors"
              style={{
                backgroundColor: value === opt.key ? opt.color : 'transparent',
                color: value === opt.key ? '#fffcf2' : 'var(--ta-slate)',
                border: `1px solid ${value === opt.key ? opt.color : 'var(--tad-border)'}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )

    case 'outcome':
      return (
        <div className="flex items-center justify-center gap-0.5">
          {[
            { key: 'win', label: 'W', color: '#16a34a' },
            { key: 'loss', label: 'L', color: '#dc2626' },
            { key: 'be', label: 'BE', color: 'var(--ta-slate)' },
          ].map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => onChange(value === opt.key ? null : opt.key)}
              title={opt.key === 'be' ? 'Breakeven' : opt.key === 'win' ? 'Win' : 'Loss'}
              className="flex h-4 min-w-[13px] items-center justify-center rounded-[3px] px-0.5 text-[7.5px] font-bold transition-colors"
              style={{
                backgroundColor: value === opt.key ? opt.color : 'transparent',
                color: value === opt.key ? '#fffcf2' : 'var(--ta-slate)',
                border: `1px solid ${value === opt.key ? opt.color : 'var(--tad-border)'}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )

    case 'rrr':
      return (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="st-cell-select"
          title={field.label}
        >
          <option value="">—</option>
          {RRR_OPTIONS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      )

    case 'sltarget':
      return (
        <div className="flex flex-col items-stretch gap-[1px] px-0.5 leading-none">
          <div className="flex items-center gap-0.5">
            <span className="text-[6.5px] font-bold" style={{ color: '#dc2626' }}>
              SL
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={value?.sl ?? ''}
              onChange={(e) => onChange({ ...(value || {}), sl: e.target.value })}
              className={inputCls}
              style={{ color: '#dc2626' }}
              placeholder="—"
            />
          </div>
          <div className="flex items-center gap-0.5">
            <span className="text-[6.5px] font-bold" style={{ color: '#16a34a' }}>
              TP
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={value?.target ?? ''}
              onChange={(e) => onChange({ ...(value || {}), target: e.target.value })}
              className={inputCls}
              style={{ color: '#16a34a' }}
              placeholder="—"
            />
          </div>
        </div>
      )

    case 'pnl': {
      const num = value === '' || value == null ? null : parseFloat(value)
      const color = num == null || Number.isNaN(num) ? 'var(--ta-ink)' : num > 0 ? '#16a34a' : num < 0 ? '#dc2626' : 'var(--ta-ink)'
      return (
        <input
          type="text"
          inputMode="decimal"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
          style={{ color, fontWeight: 700 }}
          placeholder="—"
        />
      )
    }

    case 'number':
      return (
        <input
          type="text"
          inputMode="decimal"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={inputCls}
          placeholder="—"
        />
      )

    case 'notes':
      return (
        <>
          <button
            type="button"
            onClick={() => setNotesOpen(true)}
            title={value ? value : 'Add a note'}
            className="flex h-full w-full items-center justify-center gap-0.5 px-0.5"
          >
            <StickyNote size={10} style={{ color: value ? 'var(--ta-accent)' : 'var(--ta-slate)', opacity: value ? 1 : 0.45 }} />
            {value ? (
              <span className="truncate text-[8px]" style={{ color: 'var(--ta-ink)', maxWidth: 46 }}>
                {value}
              </span>
            ) : null}
          </button>
          {notesOpen && (
            <NotesPopup
              title={`${field.label} — ${rowLabel}`}
              value={value}
              onSave={onChange}
              onClose={() => setNotesOpen(false)}
            />
          )}
        </>
      )

    case 'image': {
      const handleFile = async (e) => {
        const file = e.target.files?.[0]
        e.target.value = ''
        if (!file) return
        setUploading(true)
        try {
          const { url } = await uploadTradeImage(file)
          onChange(url)
        } catch (err) {
          useUiStore.getState().showToast(err.message || 'Could not upload image')
        } finally {
          setUploading(false)
        }
      }
      return (
        <div className="flex h-full w-full items-center justify-center py-0.5">
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
          {uploading ? (
            <Loader2 size={11} className="animate-spin" style={{ color: 'var(--ta-accent)' }} />
          ) : value ? (
            <button
              type="button"
              onClick={() => useUiStore.getState().openImageLightbox(value, () => onChange(null))}
              className="h-5 w-7 shrink-0 overflow-hidden rounded-[3px] border"
              style={{ borderColor: 'var(--tad-border)' }}
              title="View image"
            >
              <img src={value} alt="" className="h-full w-full object-cover" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              title="Attach an image"
              className="flex h-5 w-7 items-center justify-center rounded-[3px] border border-dashed transition-colors hover:bg-black/5"
              style={{ borderColor: 'var(--tad-border)' }}
            >
              <Camera size={10} style={{ color: 'var(--ta-slate)', opacity: 0.6 }} />
            </button>
          )}
        </div>
      )
    }

    default:
      return null
  }
}
