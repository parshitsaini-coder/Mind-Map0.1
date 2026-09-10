// Trade Analysis — selectable color themes. Each theme maps to the same
// five --ta-* tokens the feature already uses (see index.css), so picking
// a theme just overrides those CSS custom properties on the overlay's root
// element instead of touching any component styling.
//
// "classic" is the feature's original built-in palette; the other five
// come from coolors.co palettes supplied by the user. For each, `surface`
// is the lightest/most neutral swatch (cards, inputs), `bg` a slightly
// deeper neutral (page backdrop), `ink` the darkest swatch (primary text),
// `slate` a mid-tone (secondary text/borders), and `accent` the color with
// the most "pop" against surface (buttons, active states).
export const TRADE_THEMES = [
  {
    id: 'classic',
    name: 'Classic',
    colors: { bg: '#ccc5b9', surface: '#fffcf2', ink: '#252422', slate: '#2b2925', accent: '#eb5e28' },
  },
  {
    id: 'olive',
    name: 'Olive Fields',
    // coolors.co/palette/606c38-283618-fefae0-dda15e-bc6c25
    colors: { bg: '#dda15e', surface: '#fefae0', ink: '#283618', slate: '#606c38', accent: '#bc6c25' },
  },
  {
    id: 'ember',
    name: 'Ember Navy',
    // coolors.co/palette/000000-14213d-fca311-e5e5e5-ffffff
    colors: { bg: '#e5e5e5', surface: '#ffffff', ink: '#000000', slate: '#14213d', accent: '#fca311' },
  },
  {
    id: 'midnight',
    name: 'Midnight Tide',
    // coolors.co/palette/0d1b2a-1b263b-415a77-778da9-e0e1dd
    colors: { bg: '#778da9', surface: '#e0e1dd', ink: '#0d1b2a', slate: '#1b263b', accent: '#415a77' },
  },
  {
    id: 'sagewood',
    name: 'Sagewood',
    // coolors.co/palette/f0ead2-dde5b6-adc178-a98467-6c584c
    colors: { bg: '#dde5b6', surface: '#f0ead2', ink: '#6c584c', slate: '#a98467', accent: '#adc178' },
  },
  {
    id: 'terracotta',
    name: 'Terracotta',
    // coolors.co/palette/cb997e-ddbea9-ffe8d6-b7b7a4-a5a58d-6b705c
    colors: { bg: '#b7b7a4', surface: '#ffe8d6', ink: '#6b705c', slate: '#a5a58d', accent: '#cb997e' },
  },
  {
    id: 'liquidglass',
    name: 'Liquid Glass',
    // Not a coolors.co palette like the others — this one is translucent
    // by design. `bg`/`surface`/`slate` all carry alpha (rgba) instead of
    // being opaque hex, so every existing `backgroundColor: var(--ta-bg)` /
    // `var(--ta-surface)` in the components automatically turns into a
    // frosted glass panel with zero component changes. `ink` and `accent`
    // stay fully opaque so text and buttons stay readable/vivid on top of
    // the frosted panels. Pairs with the `glass: true` flag below, which
    // TradeAnalysis.jsx checks to swap in the animated liquid-color
    // backdrop and turn on backdrop-blur globally (see index.css).
    glass: true,
    colors: {
      bg: 'rgba(255,255,255,0.22)',
      surface: 'rgba(255,255,255,0.5)',
      ink: '#161a2b',
      slate: 'rgba(22,26,43,0.55)',
      accent: '#000000',
    },
  },
]

export const DEFAULT_TRADE_THEME_ID = 'classic'

export const getTradeTheme = (id) => TRADE_THEMES.find((t) => t.id === id) || TRADE_THEMES[0]

// Whether a theme id is the frosted/translucent "Liquid Glass" theme —
// TradeAnalysis.jsx uses this to switch on the animated liquid backdrop
// and the global backdrop-blur rules (see .ta-liquid-bg in index.css)
// instead of the plain white page background the other themes use.
export const isGlassTheme = (id) => !!getTradeTheme(id).glass

// CSS custom-property overrides for a theme, ready to spread into a React
// inline `style` object on the overlay root — cascades down to every
// var(--ta-*) reference in the feature without touching component code.
export const tradeThemeCssVars = (id) => {
  const { colors } = getTradeTheme(id)
  return {
    '--ta-bg': colors.bg,
    '--ta-surface': colors.surface,
    '--ta-ink': colors.ink,
    '--ta-slate': colors.slate,
    '--ta-accent': colors.accent,
  }
}
