// Scans every source file's named imports from local modules and verifies
// each one is actually exported. Catches the whole class of build errors
// in a single pass instead of one rebuild at a time.
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve('src')
const files = []
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p)
    else if (/\.(js|jsx)$/.test(e.name)) files.push(p)
  }
}
walk(ROOT)

const exportsOf = new Map()
const resolve = (from, spec) => {
  const base = path.resolve(path.dirname(from), spec)
  for (const cand of [base, `${base}.js`, `${base}.jsx`, path.join(base, 'index.js'), path.join(base, 'index.jsx')]) {
    if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand
  }
  return null
}

const collectExports = (file) => {
  if (exportsOf.has(file)) return exportsOf.get(file)
  const src = fs.readFileSync(file, 'utf8')
  const names = new Set()
  // export function/const/let/class NAME
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z0-9_$]+)/gm)) names.add(m[1])
  // export default
  if (/^export\s+default/m.test(src)) names.add('default')
  // export { a, b as c }
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    m[1].split(',').forEach((part) => {
      const t = part.trim()
      if (!t) return
      const as = t.split(/\s+as\s+/)
      names.add((as[1] || as[0]).trim())
    })
  }
  exportsOf.set(file, names)
  return names
}

let problems = 0
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8')
  for (const m of src.matchAll(/import\s+([^'"]+?)\s+from\s+['"](\.[^'"]+)['"]/g)) {
    const clause = m[1]
    const target = resolve(file, m[2])
    if (!target) {
      console.error(`✗ ${path.relative('.', file)} -> cannot resolve "${m[2]}"`)
      problems++
      continue
    }
    const available = collectExports(target)
    const braced = clause.match(/\{([^}]*)\}/)
    if (!braced) continue
    braced[1].split(',').forEach((part) => {
      const t = part.trim()
      if (!t) return
      const name = t.split(/\s+as\s+/)[0].trim()
      if (!name) return
      if (!available.has(name)) {
        console.error(`✗ ${path.relative('.', file)} imports "${name}" from ${path.relative('.', target)} — not exported`)
        problems++
      }
    })
  }
}
console.log(problems ? `\n${problems} import problem(s)` : '\n✓ all local named imports resolve')
process.exit(problems ? 1 : 0)
