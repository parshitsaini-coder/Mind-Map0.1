import { createCore } from './_lib/core.js'

const core = createCore()
export default function handler(req, res) {
  return core.symbols(req, res)
}
