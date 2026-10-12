// Custom brand icon — replaces the generic lucide "Brain" icon.
// Minimal line-outline mind-node mark: a central node with five branches,
// drawn purely in stroke so it inherits `color` like any lucide icon does.
export default function MindNodeIcon({ size = 22, color = 'currentColor', strokeWidth = 2.6, className }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="7.5" />
      <path d="M24 16.5V9" />
      <circle cx="24" cy="6.5" r="2.5" />
      <path d="M29.8 20.2l6.4-4.4" />
      <circle cx="38.5" cy="14" r="2.5" />
      <path d="M29.8 27.8l6.4 4.4" />
      <circle cx="38.5" cy="34" r="2.5" />
      <path d="M18.2 20.2l-6.4-4.4" />
      <circle cx="9.5" cy="14" r="2.5" />
    </svg>
  )
}
