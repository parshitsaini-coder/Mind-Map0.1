import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'

// A share link puts the whole map's nodes/edges JSON into the URL itself
// (no backend / DB needed — anyone with the link can open it). Once a map
// has more than a handful of nodes — or has notes/attachments/images — the
// raw JSON gets big enough that the URL blows past what browsers/hosts
// (Vercel included) will accept, and the visitor lands on a
// "414 / URI_TOO_LONG" error page instead of the map.
//
// Fixed in two layers:
//  1. Compress the JSON with lz-string before it goes in the URL
//     (typically 5–10x smaller for this kind of repetitive JSON).
//  2. If it's STILL too long, that's almost always because a node has an
//     embedded image/attachment/audio note as a base64 data URL — those
//     can be huge even for a map with just a handful of nodes. So we
//     strip that embedded media out and retry once before giving up,
//     which keeps small-to-medium maps shareable even when one node has
//     a large image on it (the shared view just won't show that image).

// Most browsers/proxies are comfortable well past this, but some hosts
// (Vercel's edge network included) start rejecting requests in the
// 8–16KB range — 7000 chars keeps the full URL safely under that even
// after the domain/path prefix.
const MAX_URL_PARAM_LENGTH = 7000

// Only the checklists actually applied to some node need to travel with the
// link — the shared viewer needs their name/items to render Section —
// Checklist Library bodies, but the rest of the creator's checklist library
// is irrelevant to this map.
function collectUsedChecklists(nodes, checklists) {
  const usedIds = new Set()
  nodes.forEach((n) => (n.data?.checklists || []).forEach((c) => usedIds.add(c.checklistId)))
  return checklists.filter((c) => usedIds.has(c.id))
}

// Same idea for linked trades, but trimmed to just the fields the viewer's
// trade tag needs — a trade can carry a screenshot/result image as a large
// base64 data URL, which would blow the URL budget for no visual benefit
// (the shared view only shows a small "pair" tag, not the full trade).
function collectUsedTrades(nodes, trades) {
  const usedIds = new Set()
  nodes.forEach((n) => {
    if (n.data?.linkedTradeId) usedIds.add(n.data.linkedTradeId)
  })
  return trades
    .filter((t) => usedIds.has(t.id))
    .map((t) => ({ id: t.id, pair: t.pair, direction: t.direction, status: t.status }))
}

export function encodeMapToParam(nodes, edges, checklists = [], trades = []) {
  const json = JSON.stringify({
    nodes,
    edges,
    checklists: collectUsedChecklists(nodes, checklists),
    trades: collectUsedTrades(nodes, trades),
  })
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

// True if this node is carrying any embedded base64 media that could be
// large (image, file attachment, recorded audio note). `videoEmbed` is
// just a short YouTube id, so it's left alone.
function hasEmbeddedMedia(data) {
  const hasImageData = typeof data?.image === 'string' && data.image.startsWith('data:')
  return Boolean(hasImageData || data?.audioNote || (data?.attachments || []).length)
}

// Returns a copy of nodes with embedded image/attachment/audio-note data
// removed, replaced by a small marker so the shared viewer can (if it
// wants to) show "image not included in this shared link" instead of
// silently dropping it without a trace.
function stripHeavyMedia(nodes) {
  return nodes.map((n) => {
    if (!hasEmbeddedMedia(n.data)) return n
    const isDataImage = typeof n.data?.image === 'string' && n.data.image.startsWith('data:')
    const { image, audioNote, attachments, ...rest } = n.data
    return {
      ...n,
      data: {
        ...rest,
        ...(isDataImage ? {} : { image }),
        sharedMediaOmitted: true,
      },
    }
  })
}

// Returns { url } on success, { url, warning } if media had to be
// stripped to make it fit, or { error } if the map is too large to share
// as a link even after both compression and stripping.
export function buildShareUrl(nodes, edges, checklists = [], trades = []) {
  const full = encodeMapToParam(nodes, edges, checklists, trades)
  if (full.length <= MAX_URL_PARAM_LENGTH) {
    const url = new URL(window.location.href)
    url.searchParams.set('map', full)
    return { url: url.toString() }
  }

  const strippedNodes = stripHeavyMedia(nodes)
  const anyStripped = strippedNodes.some((n, i) => n !== nodes[i])
  if (anyStripped) {
    const lean = encodeMapToParam(strippedNodes, edges, checklists, trades)
    if (lean.length <= MAX_URL_PARAM_LENGTH) {
      const url = new URL(window.location.href)
      url.searchParams.set('map', lean)
      return {
        url: url.toString(),
        warning: 'Link created, but embedded images/attachments/audio notes were left out — the map itself was too large to include them.',
      }
    }
  }

  return {
    error:
      'This mind map is too large for a share link, even after removing embedded images/attachments. Try trimming the map or use Export instead.',
  }
}
