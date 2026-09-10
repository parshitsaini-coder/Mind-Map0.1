import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'
import { useChecklistStore } from '../store/checklistStore'
import { useTradeAnalysisStore } from '../store/tradeAnalysisStore'

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

// Section — bring Checklist Library + linked Trade Analysis data along in
// the share link. Both `node.data.checklists` (applied checklists) and
// `node.data.linkedTradeId` are just ids pointing at records that live in
// checklistStore/tradeAnalysisStore — stores the *viewer* (a stranger
// opening the link, or the same browser with an empty/different local
// library) has no access to. So before encoding, walk every node once,
// collect only the checklist defs / trade rows actually referenced, and
// embed those denormalized snapshots alongside nodes/edges. Nothing else
// from either store is included.
function collectReferencedChecklistsAndTrades(nodes) {
  const checklistIds = new Set()
  const tradeIds = new Set()
  for (const n of nodes) {
    for (const applied of n.data?.checklists || []) {
      if (applied?.checklistId) checklistIds.add(applied.checklistId)
    }
    if (n.data?.linkedTradeId) tradeIds.add(n.data.linkedTradeId)
  }

  const allChecklists = useChecklistStore.getState().checklists
  const checklists = allChecklists.filter((c) => checklistIds.has(c.id))

  const { trades: allTrades, validationRules: allValidationRules } = useTradeAnalysisStore.getState()
  const trades = allTrades.filter((t) => tradeIds.has(t.id))
  const neededRuleIds = new Set(trades.flatMap((t) => t.validationRuleIds || []))
  const validationRules = allValidationRules.filter((r) => neededRuleIds.has(r.id))

  return { checklists, trades, validationRules }
}

export function encodeMapToParam(nodes, edges, themeName) {
  const { checklists, trades, validationRules } = collectReferencedChecklistsAndTrades(nodes)
  const json = JSON.stringify({ nodes, edges, checklists, trades, validationRules, themeName })
  return compressToEncodedURIComponent(json)
}

// Same denormalized snapshot as encodeMapToParam, but as a plain object with
// snake_case keys ready to write into the `live_shares` table — shared by
// both the initial "create live link" call and every later debounced sync,
// so the two link types never drift out of sync on what they include.
export function buildSharePayload(nodes, edges, themeName) {
  const { checklists, trades, validationRules } = collectReferencedChecklistsAndTrades(nodes)
  return { nodes, edges, checklists, trades, validation_rules: validationRules, theme_name: themeName }
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
export function buildShareUrl(nodes, edges, themeName) {
  const full = encodeMapToParam(nodes, edges, themeName)
  if (full.length <= MAX_URL_PARAM_LENGTH) {
    const url = new URL(window.location.href)
    url.searchParams.set('map', full)
    return { url: url.toString() }
  }

  const strippedNodes = stripHeavyMedia(nodes)
  const anyStripped = strippedNodes.some((n, i) => n !== nodes[i])
  if (anyStripped) {
    const lean = encodeMapToParam(strippedNodes, edges, themeName)
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
