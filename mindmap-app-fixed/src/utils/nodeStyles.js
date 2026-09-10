// Section — Style Library. 40+ ready-made node styles across six
// categories (solid colors, pastels, gradients, neon/glow, outlines, and
// live-animated motion styles). Each preset is a small patch applied onto a
// node's `data` via `applyNodeStyle` in mapStore.js — see CustomNode.jsx for
// how `customBg` / `glowColor` / `animationClass` / `customBorder` /
// `bgSize` are rendered.
//
// Kept as plain data (not baked-in inline styles scattered across the app)
// so the gallery, the live preview swatches, and the actual canvas node all
// read from the exact same source of truth.

export const STYLE_CATEGORIES = ['Solid', 'Pastel', 'Gradient', 'Glow', 'Outline', 'Motion']

export const NODE_STYLE_PRESETS = [
  // ── Solid ────────────────────────────────────────────────────────────
  { id: 'solid-coral', name: 'Sunset Coral', category: 'Solid', color: '#e07856', textColor: '#ffffff' },
  { id: 'solid-teal', name: 'Ocean Teal', category: 'Solid', color: '#4fb0a5', textColor: '#ffffff' },
  { id: 'solid-lemon', name: 'Lemon Zest', category: 'Solid', color: '#f5cb5c', textColor: '#242423' },
  { id: 'solid-lavender', name: 'Lavender Dream', category: 'Solid', color: '#8a7fd1', textColor: '#ffffff' },
  { id: 'solid-blush', name: 'Blush Pink', category: 'Solid', color: '#f2a6b3', textColor: '#242423' },
  { id: 'solid-moss', name: 'Forest Moss', category: 'Solid', color: '#6b8e5a', textColor: '#ffffff' },
  { id: 'solid-charcoal', name: 'Charcoal Ink', category: 'Solid', color: '#242423', textColor: '#f5f5f0' },
  { id: 'solid-slateblue', name: 'Slate Blue', category: 'Solid', color: '#4a6fa5', textColor: '#ffffff' },

  // ── Pastel ───────────────────────────────────────────────────────────
  { id: 'pastel-sage', name: 'Soft Sage', category: 'Pastel', color: '#cfdbd5', textColor: '#242423' },
  { id: 'pastel-butter', name: 'Buttercream', category: 'Pastel', color: '#f7e7ce', textColor: '#242423' },
  { id: 'pastel-powder', name: 'Powder Blue', category: 'Pastel', color: '#c9e4f6', textColor: '#242423' },
  { id: 'pastel-blush', name: 'Blush Cloud', category: 'Pastel', color: '#fbe1e1', textColor: '#242423' },
  { id: 'pastel-mint', name: 'Mint Whisper', category: 'Pastel', color: '#d6f0e3', textColor: '#242423' },
  { id: 'pastel-lilac', name: 'Lilac Fog', category: 'Pastel', color: '#e6ddf5', textColor: '#242423' },

  // ── Gradient ─────────────────────────────────────────────────────────
  { id: 'grad-peach', name: 'Peach Fade', category: 'Gradient', customBg: 'linear-gradient(135deg,#ffb88c,#de6262)', textColor: '#ffffff' },
  { id: 'grad-dusk', name: 'Cool Dusk', category: 'Gradient', customBg: 'linear-gradient(135deg,#667eea,#764ba2)', textColor: '#ffffff' },
  { id: 'grad-mint', name: 'Mint to Sky', category: 'Gradient', customBg: 'linear-gradient(135deg,#43e97b,#38f9d7)', textColor: '#242423' },
  { id: 'grad-grape', name: 'Grape Soda', category: 'Gradient', customBg: 'linear-gradient(135deg,#a18cd1,#fbc2eb)', textColor: '#242423' },
  { id: 'grad-golden', name: 'Golden Hour', category: 'Gradient', customBg: 'linear-gradient(135deg,#f6d365,#fda085)', textColor: '#242423' },
  { id: 'grad-rosegold', name: 'Rose Gold', category: 'Gradient', customBg: 'linear-gradient(135deg,#f78ca0,#f9748f)', textColor: '#ffffff' },
  { id: 'grad-deepsea', name: 'Deep Sea', category: 'Gradient', customBg: 'linear-gradient(135deg,#2b5876,#4e4376)', textColor: '#ffffff' },
  { id: 'grad-citrus', name: 'Citrus Punch', category: 'Gradient', customBg: 'linear-gradient(135deg,#f7971e,#ffd200)', textColor: '#242423' },

  // ── Glow / Neon ──────────────────────────────────────────────────────
  { id: 'glow-cyan', name: 'Neon Cyan Pulse', category: 'Glow', color: '#0f2027', textColor: '#00f5ff', glowColor: '#00f5ff', customBorder: { color: '#00f5ff', width: 1.5 }, animationClass: 'node-anim-pulse-glow' },
  { id: 'glow-magenta', name: 'Electric Magenta', category: 'Glow', color: '#1a0b2e', textColor: '#ff2ee6', glowColor: '#ff2ee6', customBorder: { color: '#ff2ee6', width: 1.5 }, animationClass: 'node-anim-pulse-glow' },
  { id: 'glow-lime', name: 'Toxic Lime', category: 'Glow', color: '#0d1b0d', textColor: '#aef73e', glowColor: '#aef73e', customBorder: { color: '#aef73e', width: 1.5 }, animationClass: 'node-anim-pulse-glow' },
  { id: 'glow-amber', name: 'Amber Warning', category: 'Glow', color: '#241a0a', textColor: '#ffb703', glowColor: '#ffb703', customBorder: { color: '#ffb703', width: 1.5 }, animationClass: 'node-anim-pulse-glow' },
  { id: 'glow-cherry', name: 'Cherry Neon', category: 'Glow', color: '#1c0a12', textColor: '#ff3860', glowColor: '#ff3860', customBorder: { color: '#ff3860', width: 1.5 }, animationClass: 'node-anim-pulse-glow' },
  { id: 'glow-violet', name: 'Violet Static', category: 'Glow', color: '#120a24', textColor: '#b083ff', glowColor: '#9d4dff', customBorder: { color: '#9d4dff', width: 1.5 }, animationClass: 'node-anim-pulse-glow' },

  // ── Outline ──────────────────────────────────────────────────────────
  { id: 'outline-ink', name: 'Ink Outline', category: 'Outline', color: '#ffffff', textColor: '#242423', customBorder: { color: '#242423', width: 2 } },
  { id: 'outline-chalk', name: 'Chalk Outline', category: 'Outline', color: '#f5f5f0', textColor: '#333533', customBorder: { color: '#6b6b6b', width: 2, style: 'dashed' } },
  { id: 'outline-double', name: 'Double Border Classic', category: 'Outline', color: '#ffffff', textColor: '#242423', customBorder: { color: '#242423', width: 4, style: 'double' } },
  { id: 'outline-wire', name: 'Thin Wire', category: 'Outline', color: '#ffffff', textColor: '#333533', customBorder: { color: '#999999', width: 1 } },
  { id: 'outline-accent', name: 'Accent Outline', category: 'Outline', color: '#ffffff', textColor: '#242423', customBorder: { color: '#f5cb5c', width: 2 } },

  // ── Motion (live-animated) ───────────────────────────────────────────
  { id: 'motion-float', name: 'Floating', category: 'Motion', color: '#cfe8e3', textColor: '#242423', animationClass: 'node-anim-float' },
  { id: 'motion-breathe', name: 'Breathing', category: 'Motion', color: '#f5cb5c', textColor: '#242423', animationClass: 'node-anim-breathe' },
  { id: 'motion-wiggle', name: 'Wiggle Alert', category: 'Motion', color: '#e07856', textColor: '#ffffff', animationClass: 'node-anim-wiggle' },
  {
    id: 'motion-shimmer',
    name: 'Shimmer Sweep',
    category: 'Motion',
    customBg: 'linear-gradient(100deg,#f5cb5c 30%,#fff8e1 50%,#f5cb5c 70%)',
    bgSize: '200% 100%',
    textColor: '#242423',
    animationClass: 'node-anim-shimmer',
  },
  { id: 'motion-bounce', name: 'Bounce Soft', category: 'Motion', color: '#8a7fd1', textColor: '#ffffff', animationClass: 'node-anim-bounce-soft' },
  {
    id: 'motion-gradientshift',
    name: 'Gradient Shift',
    category: 'Motion',
    customBg: 'linear-gradient(120deg,#667eea,#f78ca0,#43e97b,#667eea)',
    bgSize: '300% 300%',
    textColor: '#ffffff',
    animationClass: 'node-anim-gradient-shift',
  },
  { id: 'motion-sonar', name: 'Sonar Ping', category: 'Motion', color: '#4fb0a5', textColor: '#ffffff', glowColor: '#4fb0a5', animationClass: 'node-anim-sonar' },
]

export function getPresetById(id) {
  return NODE_STYLE_PRESETS.find((p) => p.id === id) || null
}
