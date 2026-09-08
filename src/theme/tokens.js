// Fixed palette — do not change.
// coolors.co/palette/cfdbd5-e8eddf-f5cb5c-242423-333533
export const COLORS = {
  bgMain: '#ecebe4',   // canvas / dashboard background
  sage: '#cfdbd5',     // secondary surfaces, hover states
  cream: '#e8eddf',    // cards, panels, node fills
  accent: '#f5cb5c',   // primary accent — buttons, active states, highlights
  ink: '#242423',      // primary text, dark nodes
  slate: '#333533',    // secondary text, borders, icons
}

// Alternate skins/themes users can switch to (Section 4.3 — Themes/skins).
// Default theme always uses COLORS above.
export const THEME_PRESETS = {
  default: COLORS,
  ocean: {
    bgMain: '#eef4f5',
    sage: '#c7dee2',
    cream: '#e3f0ef',
    accent: '#4fb0a5',
    ink: '#1c2a2e',
    slate: '#2f4550',
  },
  sunset: {
    bgMain: '#f6ede4',
    sage: '#e8c1a0',
    cream: '#f3dfc9',
    accent: '#e8743b',
    ink: '#3d211a',
    slate: '#5c3a2e',
  },
  forest: {
    bgMain: '#eef2e6',
    sage: '#c3d6b0',
    cream: '#e6efdb',
    accent: '#6a9955',
    ink: '#1f2e17',
    slate: '#37472c',
  },
  lavender: {
    bgMain: '#f3eef7',
    sage: '#d9c7e8',
    cream: '#ede2f5',
    accent: '#9163cb',
    ink: '#2c1f38',
    slate: '#4a3960',
  },
  midnight: {
    bgMain: '#e7e9f0',
    sage: '#b9c2da',
    cream: '#dde1ee',
    accent: '#4361ee',
    ink: '#1a1d2e',
    slate: '#2c3150',
  },
  rose: {
    bgMain: '#faeef0',
    sage: '#f0c6cd',
    cream: '#fbe3e7',
    accent: '#e0607e',
    ink: '#3a1620',
    slate: '#5c2b36',
  },
  slate: {
    bgMain: '#eceff1',
    sage: '#c9d3d9',
    cream: '#e2e8eb',
    accent: '#5c7a89',
    ink: '#1c2529',
    slate: '#33454e',
  },
}

export const NODE_SHAPES = ['rectangle', 'oval', 'cloud', 'hexagon', 'no-border']

export const LAYOUTS = [
  { id: 'radial', label: 'Radial / Tree' },
  { id: 'orgChart', label: 'Org Chart' },
  { id: 'fishbone', label: 'Fishbone' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'matrix', label: 'Matrix / 2D' },
  { id: 'logicChart', label: 'Logic Chart' },
]
