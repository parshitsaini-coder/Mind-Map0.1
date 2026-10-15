// Typed errors (Phase 14). Every failure the proxy can produce has a code, an HTTP status and a message that is safe to show.
export const feedError = (code, message, extra = {}) => ({ code, message, status: STATUS[code] || 502, ...extra })
const STATUS = { bad_request: 400, unsupported_symbol: 404, auth: 502, plan: 502, rate_limited: 429, quota: 429, upstream: 502, not_configured: 503 }
export const isFeedError = (e) => !!e && typeof e === 'object' && typeof e.code === 'string' && typeof e.status === 'number'

// Never let a vendor message carry our key back to the browser.
export const scrub = (text, secrets = []) => secrets.filter(Boolean).reduce((t, s) => String(t).split(s).join('***'), String(text ?? ''))

export function httpOf(err) {
  const e = isFeedError(err) ? err : feedError('upstream', 'Price provider error')
  return { status: e.status, body: { error: { code: e.code, message: e.message, ...(e.retryAfter ? { retryAfter: e.retryAfter } : {}) } }, headers: e.retryAfter ? { 'Retry-After': String(e.retryAfter) } : {} }
}
