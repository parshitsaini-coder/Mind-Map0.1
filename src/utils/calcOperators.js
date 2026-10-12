import { Plus, Minus, Asterisk, Divide, Equal } from 'lucide-react'

// Section — Connector Calculations. Single source of truth for the 5
// operators offered on a connector's right-click menu (ConnectorCalcMenu)
// and the small badge CustomEdge/CrossEdge/ConnectorDemoEdge draw on a
// connector once it has one, so the icon/label for a given operator is
// never redefined in more than one place.
export const CALC_OPERATOR_META = [
  { op: '+', icon: Plus, label: 'Add (+)' },
  { op: '-', icon: Minus, label: 'Subtract (−)' },
  { op: '*', icon: Asterisk, label: 'Multiply (×)' },
  { op: '/', icon: Divide, label: 'Divide (÷)' },
  { op: '=', icon: Equal, label: 'Calculate (=)' },
]

export const CALC_OPERATOR_ICON = Object.fromEntries(CALC_OPERATOR_META.map((m) => [m.op, m.icon]))
