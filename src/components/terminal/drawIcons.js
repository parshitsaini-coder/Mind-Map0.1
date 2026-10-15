import {
  TrendingUp, TrendingDown, MoveUpRight, Slash, ArrowUpRight, Minus, ArrowRight, GripVertical, Columns2, Waypoints, ChartNoAxesGantt,
  Square, Circle, Triangle, Type, MessageSquare, ArrowBigUp, Ruler, MoveVertical, MoveHorizontal, Scan, Pencil,
} from 'lucide-react'

// Registry icon name -> component (kept explicit so the bundle only ships what is used).
export const DRAW_ICONS = {
  TrendingUp, TrendingDown, MoveUpRight, Slash, ArrowUpRight, Minus, ArrowRight, GripVertical, Columns2, Waypoints, ChartNoAxesGantt,
  Square, Circle, Triangle, Type, MessageSquare, ArrowBigUp, Ruler, MoveVertical, MoveHorizontal, Scan,
}
export const iconOf = (tool, spec) => DRAW_ICONS[spec?.icon] || Pencil
