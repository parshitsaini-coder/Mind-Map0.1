import { useRef } from 'react'

// Shared, tiny motion helpers for the Strategy Tester. Kept dependency-free
// (plain SVG + CSS classes from index.css) so they can be rendered in every
// grid cell without spinning up a JS animation each.

// A check mark that draws itself (stroke-dashoffset) when it mounts. Pair
// with `.st-box.is-on` on the box for the pop.
export function Tick({ size = 8, color = '#fffcf2', strokeWidth = 3 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <polyline
        className="st-tick"
        points="2 6.4 4.9 9.2 10 3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="14"
      />
    </svg>
  )
}

// +1 / -1 depending on whether `value` went up or down since the last
// render — used to slide month labels the way the user is navigating.
export function useNavDirection(value) {
  const prev = useRef(value)
  const dir = useRef(1)
  if (value !== prev.current) {
    dir.current = value > prev.current ? 1 : -1
    prev.current = value
  }
  return dir.current
}

export const EASE_OUT = [0.23, 1, 0.32, 1]
