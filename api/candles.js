import { createProxy } from './_lib/core.js'

// GET /api/candles  (see api/_lib/core.js). One proxy per server instance so the rate limiter and credit budget persist between calls.
const proxy = createProxy({ env: process.env })
export default function handler(req, res) { return proxy.handle('candles', req, res) }
