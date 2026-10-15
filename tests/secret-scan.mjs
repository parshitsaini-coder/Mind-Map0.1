// Phase 14.6: no vendor key (or key-shaped literal) in src/ public/ tests/ and, after `npm run build`, dist/.
import fs from 'node:fs'
import path from 'node:path'
const dirs = ['src', 'public', 'tests', 'dist'].filter((d) => fs.existsSync(d))
const bad = []
const PATTERNS = [
  [/VITE_(TWELVE|FINNHUB|OANDA|BINANCE)\w*/i, 'a VITE_-prefixed vendor key would be bundled into the browser'],
  [/(apikey|api_key|x-finnhub-token|token)\s*[:=]\s*['"][A-Za-z0-9]{20,}['"]/i, 'key-shaped literal'],
  [/\b[a-z0-9]{32}\b(?=['"]?\s*[,;)\]}]?\s*$)/im, null], // placeholder: 32-hex literals are only reported when next to a key word (below)
]
const KEYWORD = /(twelve|finnhub|api[_-]?key)/i
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(js|jsx|mjs|html|json|css|map)$/.test(e.name) && !p.endsWith('secret-scan.mjs')) scan(p) } }
function scan(p) {
  const src = fs.readFileSync(p, 'utf8')
  for (const [re, why] of PATTERNS) { if (!why) continue; const m = src.match(re); if (m) bad.push(`${p}: ${why}: ${m[0].slice(0, 40)}`) }
  for (const line of src.split('\n')) { const m = line.match(/['"]([a-f0-9]{32})['"]/i); if (m && KEYWORD.test(line)) bad.push(`${p}: 32-char literal next to a key word`) }
}
dirs.forEach(walk)
console.log(bad.length ? bad.join('\n') + `\n${bad.length} possible secret(s)` : `✓ secret scan clean (${dirs.join(', ')})`)
process.exit(bad.length ? 1 : 0)
