// Node label text styling — bold/italic/underline/font size/font family are
// stored directly on node.data (data.bold, data.italic, data.underline,
// data.fontSize, data.fontFamily) so they save/load/share exactly like
// every other node property. This file is the single source of truth for
// turning that data into actual CSS, so the editable node (CustomNode),
// the read-only shared viewer (ViewerNode), and the Node Inspector's font
// picker all render/describe text identically.

export const FONT_FAMILIES = [
  { key: 'sans', label: 'Sans', value: 'var(--font-sans)' },
  { key: 'serif', label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { key: 'mono', label: 'Mono', value: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace' },
  { key: 'rounded', label: 'Rounded', value: '"Varela Round", ui-rounded, "Segoe UI", sans-serif' },
]

export function getFontFamilyValue(key) {
  return FONT_FAMILIES.find((f) => f.key === key)?.value
}

export const MIN_FONT_SIZE = 9
export const MAX_FONT_SIZE = 28
export const DEFAULT_FONT_SIZE = 12

// Returns a React inline-style object for a node's label, built from
// data.bold / data.italic / data.underline / data.fontSize / data.fontFamily.
// Any field left unset falls back to the node's normal styling (inherited
// from the node container) by leaving that CSS property undefined.
export function nodeTextStyle(data = {}) {
  return {
    fontWeight: data.bold ? 700 : undefined,
    fontStyle: data.italic ? 'italic' : undefined,
    textDecoration: data.underline ? 'underline' : undefined,
    fontSize: data.fontSize ? `${data.fontSize}px` : undefined,
    fontFamily: data.fontFamily ? getFontFamilyValue(data.fontFamily) : undefined,
  }
}
