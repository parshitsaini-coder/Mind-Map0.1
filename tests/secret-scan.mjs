// Secret scan: after `npm run build`, the provider key must not appear anywhere the browser (or git)
// can see it: src/ public/ tests/ dist/ (+ api/ and root docs may only mention the variable NAME).
import fs from 'node:fs'
import path from 'node:path'

const dirs = ['src', 'public', 'tests', 'dist', 'api']
const skip = new Set(['node_modules', '.testbuild'])
const files = []
const walk = (d) => {
  if (!fs.existsSync(d)) return
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (skip.has(e.name)) continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (!/\.(png|jpg|jpeg|gif|webp|ico|woff2?|ttf|mp3|ogg|wav|zip)$/i.test(e.name)) files.push(p)
  }
}
dirs.forEach(walk)
for (const f of ['README.md', 'SUPABASE_SETUP.md', '.env.example', 'vercel.json', 'package.json']) if (fs.existsSync(f)) files.push(f)

const bad = []
const secrets = [process.env.TWELVEDATA_API_KEY].filter((x) => x && x.length >= 8)
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8')
  for (const s of secrets) if (t.includes(s)) bad.push(`${f}: contains the real key`)
  if (/VITE_[A-Z_]*(TWELVE|API_KEY|FEED)/.test(t)) bad.push(`${f}: a provider key must never use the VITE_ prefix`)
  // a literal apikey=<value> (not a variable / placeholder)
  for (const m of t.matchAll(/apikey\s*[=:]\s*['"]?([A-Za-z0-9]{16,})/gi)) if (!/^(your|example|xxxx|test)/i.test(m[1])) bad.push(`${f}: literal apikey value`)
  // the browser bundle must not know the provider host or the env var
  if (f.startsWith('dist') && /api\.twelvedata\.com|TWELVEDATA_API_KEY/.test(t)) bad.push(`${f}: browser bundle references the provider / key name`)
  if ((f.startsWith('src') || f.startsWith('public')) && /api\.twelvedata\.com/.test(t) && !f.includes(`${path.sep}adapters${path.sep}`)) bad.push(`${f}: talks to the provider directly (must go through /api/*)`)
}
if (bad.length) { bad.forEach((b) => console.log(`✗ ${b}`)); process.exit(1) }
console.log(`✓ secret scan clean (${files.length} files)`)
