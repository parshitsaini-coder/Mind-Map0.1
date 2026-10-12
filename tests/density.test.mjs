// The density switch is pure CSS — the rendered markup is identical at all
// three levels and only the custom properties change. That makes it fast,
// but it also means nothing in the React tests can catch a broken scale.
// This checks the stylesheet directly.
import fs from 'node:fs'

const css = fs.readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')
let checks = 0, failures = 0
const ok = (label, cond, got) => {
  checks++
  if (cond) console.log(`  ✓ ${label}`)
  else { failures++; console.error(`  ✗ ${label}${got !== undefined ? ` — got ${JSON.stringify(got)}` : ''}`) }
}

const block = (selector) => {
  const i = css.indexOf(selector + ' {')
  if (i === -1) return null
  const open = css.indexOf('{', i)
  const close = css.indexOf('}', open)
  const out = {}
  for (const m of css.slice(open + 1, close).matchAll(/--(tad-[\w-]+):\s*([^;]+);/g)) {
    out[m[1]] = parseFloat(m[2])
  }
  return out
}

// cozy is the un-suffixed base block; compact and dense override it.
const base = block('[data-ta-density]')
const compact = block("[data-ta-density='compact']")
const dense = block("[data-ta-density='dense']")

ok('base (cozy) block exists', base !== null)
ok('compact block exists', compact !== null)
ok('dense block exists', dense !== null)

const SCALED = ['tad-gap', 'tad-pad', 'tad-title', 'tad-label', 'tad-value', 'tad-hero', 'tad-body', 'tad-micro', 'tad-row-h', 'tad-chart-h']

console.log('\n── Every scaled token shrinks monotonically ──')
for (const token of SCALED) {
  const c = base[token]
  const m = compact[token] ?? c
  const d = dense[token] ?? m
  ok(`${token}: ${c} ≥ ${m} ≥ ${d}`, c >= m && m >= d, [c, m, d])
}

console.log('\n── Nothing shrinks below the readability floor ──')
// Below roughly 6px, digits stop being legible on a normal display.
for (const token of ['tad-micro', 'tad-body', 'tad-label', 'tad-title', 'tad-value', 'tad-hero']) {
  const d = dense[token] ?? compact[token] ?? base[token]
  ok(`${token} stays ≥ 6px at dense (${d}px)`, d >= 6, d)
}

console.log('\n── Dense is meaningfully tighter than cozy ──')
ok('gap at least 40% tighter', dense['tad-gap'] <= base['tad-gap'] * 0.6, [base['tad-gap'], dense['tad-gap']])
ok('padding at least 40% tighter', dense['tad-pad'] <= base['tad-pad'] * 0.6, [base['tad-pad'], dense['tad-pad']])
ok('row height at least 25% shorter', dense['tad-row-h'] <= base['tad-row-h'] * 0.75, [base['tad-row-h'], dense['tad-row-h']])

console.log('\n── Required utility classes ──')
for (const cls of ['ta-scroll', 'ta-scroll-x', 'ta-fade-edges', 'ta-bordered', 'ta-divide-y', 'ta-pro-card', 'ta-sticky-nav', 'ta-table', 'ta-shimmer', 'ta-pulse', 'ta-alert-live', 'ta-num', 'ta-tool-input']) {
  ok(`.${cls} defined`, css.includes('.' + cls))
}

console.log('\n── Scrollbars are visible, not hidden ──')
ok('scrollbar thumb styled', css.includes('::-webkit-scrollbar-thumb'))
ok('scrollbar width set', /scrollbar-width\s*:/.test(css))
ok('borders use a token, not hard-coded colours', css.includes('--tad-border'))

console.log('\n── Motion preferences respected ──')
ok('prefers-reduced-motion handled', css.includes('prefers-reduced-motion'))

console.log(`\n══ ${checks} checks, ${failures} failure(s) ══\n`)
process.exit(failures ? 1 : 0)
