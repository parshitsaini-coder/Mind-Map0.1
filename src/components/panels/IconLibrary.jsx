import { useState } from 'react'
import { ICONS, ICON_NAMES } from '../../theme/iconSet'

export default function IconLibrary({ onSelect, activeIcon }) {
  const [query, setQuery] = useState('')

  const filtered = query
    ? ICON_NAMES.filter((n) => n.toLowerCase().includes(query.toLowerCase()))
    : ICON_NAMES

  return (
    <div className="flex flex-col gap-1.5">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search icons…"
        className="rounded-md border border-[#cfdbd5] bg-white/60 px-2 py-1 text-[11px] outline-none focus:border-[#f5cb5c]"
      />
      <div className="grid max-h-40 grid-cols-6 gap-1 overflow-y-auto pr-1">
        {filtered.map((name) => {
          const Icon = ICONS[name]
          return (
            <button
              key={name}
              title={name}
              onClick={() => onSelect(name)}
              className={`flex h-7 w-7 items-center justify-center rounded-md border ${
                activeIcon === name ? 'border-[#f5cb5c] bg-[#f5cb5c]/30' : 'border-transparent hover:bg-[#cfdbd5]/50'
              }`}
            >
              <Icon size={14} color="#242423" />
            </button>
          )
        })}
        {filtered.length === 0 && <p className="col-span-6 text-[10px] text-[#333533]">No icons found.</p>}
      </div>
      {activeIcon && (
        <button
          onClick={() => onSelect(null)}
          className="self-start text-[10px] text-[#333533] underline hover:text-[#242423]"
        >
          Remove icon
        </button>
      )}
    </div>
  )
}
