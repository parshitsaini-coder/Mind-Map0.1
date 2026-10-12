// Bundles the render entry with rolldown (so JSX + the app's import graph
// resolve exactly as Vite would) and runs the result in Node.
import { build } from 'rolldown'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const out = path.resolve('.testbuild/render.mjs')

// jsdom is not installed, and renderToStaticMarkup does not run effects,
// so only the handful of globals touched during render need stubbing.
globalThis.addEventListener = () => {}
globalThis.removeEventListener = () => {}
globalThis.dispatchEvent = () => true
globalThis.getComputedStyle = () => ({ getPropertyValue: () => '', fontSize: '16px' })
globalThis.scrollTo = () => {}
globalThis.innerWidth = 1440
globalThis.innerHeight = 900
globalThis.devicePixelRatio = 1
globalThis.window = globalThis
const stubEl = () => ({ style: {}, click() {}, setAttribute() {}, appendChild() {}, removeChild() {}, addEventListener() {}, removeEventListener() {}, getBoundingClientRect: () => ({ top: 0, left: 0, width: 800, height: 600, bottom: 600, right: 800 }), querySelector: () => null, querySelectorAll: () => [], scrollIntoView() {} })
globalThis.document = {
  createElement: stubEl,
  createElementNS: stubEl,
  createTextNode: () => ({}),
  body: stubEl(),
  head: stubEl(),
  documentElement: { ...stubEl(), style: { setProperty() {}, getPropertyValue: () => '' } },
  addEventListener() {}, removeEventListener() {},
  querySelector: () => null, querySelectorAll: () => [],
  getElementById: () => null,
  visibilityState: 'visible',
}
// navigator is a read-only getter in Node 22 and already present.
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
globalThis.localStorage = {
  _d: new Map(),
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null },
  setItem(k, v) { this._d.set(k, String(v)) },
  removeItem(k) { this._d.delete(k) },
  clear() { this._d.clear() },
}
globalThis.sessionStorage = globalThis.localStorage
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0)
globalThis.cancelAnimationFrame = (id) => clearTimeout(id)
globalThis.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} }
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
globalThis.URL.createObjectURL = () => 'blob:stub'
globalThis.URL.revokeObjectURL = () => {}

await build({
  input: path.resolve('tests/render-entry.jsx'),
  output: { file: out, format: 'esm', codeSplitting: false },
  external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime'],
  resolve: { extensions: ['.js', '.jsx', '.json'] },
  platform: 'node',

  logLevel: 'silent',
})

// rolldown has no top-level `define`, and `import.meta.env` is undefined
// in Node, so the built bundle is rewritten before it is imported.
const fs = await import('node:fs')
let code = fs.readFileSync(out, 'utf8')
code = code.replace(/import\.meta\.env/g, '({ VITE_SUPABASE_URL: "", VITE_SUPABASE_ANON_KEY: "", DEV: false, PROD: true, MODE: "test" })')
fs.writeFileSync(out, code)

await import(pathToFileURL(out).href)
