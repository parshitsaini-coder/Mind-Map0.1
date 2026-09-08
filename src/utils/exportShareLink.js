import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'

// A share link puts the whole map's nodes/edges JSON into the URL itself
// (no backend / DB needed — anyone with the link can open it). Once a map
// has more than a handful of nodes — or has notes/attachments/images — the
// raw JSON gets big enough that the URL blows past what browsers/hosts
// (Vercel included) will accept, and the visitor lands on a
// "414 / URI_TOO_LONG" error page instead of the map.
//
// Fixed by compressing the JSON with lz-string before it goes in the URL
// (typically 5–10x smaller for this kind of repetitive JSON) and by
// refusing to hand back a link that's still too long, so the toolbar can
// show a clear message instead of silently producing a broken URL.

// Most browsers/proxies are comfortable well past this, but some hosts
// (Vercel's edge network included) start rejecting requests in the
// 8–16KB range — 7000 chars keeps the full URL safely under that even
// after the domain/path prefix.
const MAX_URL_PARAM_LENGTH = 7000

export function encodeMapToParam(nodes, edges) {
  const json = JSON.stringify({ nodes, edges })
  return compressToEncodedURIComponent(json)
}

// Old links (created before this fix) were plain base64 — `atob` on a
// modern lz-string payload throws immediately, so trying the new format
// first and falling back to the legacy one keeps previously-shared links
// working instead of showing "this link looks broken".
export function decodeMapFromParam(param) {
  try {
    const json = decompressFromEncodedURIComponent(param)
    if (json) return JSON.parse(json)
  } catch {
    // fall through to legacy format below
  }
  try {
    const json = decodeURIComponent(atob(param))
    return JSON.parse(json)
  } catch {
    return null
  }
}

// Returns { url } on success, or { error } if the map is too large to fit
// in a shareable link even after compression — the caller decides how to
// surface that (toast, etc).
export function buildShareUrl(nodes, edges) {
  const encoded = encodeMapToParam(nodes, edges)
  if (encoded.length > MAX_URL_PARAM_LENGTH) {
    return {
      error:
        'This mind map is too large for a share link (usually caused by embedded images/attachments). Try removing large images or use Export instead.',
    }
  }
  const url = new URL(window.location.href)
  url.searchParams.set('map', encoded)
  return { url: url.toString() }
}
