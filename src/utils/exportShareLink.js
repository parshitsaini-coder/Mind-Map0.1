export function encodeMapToParam(nodes, edges) {
  const json = JSON.stringify({ nodes, edges })
  return btoa(encodeURIComponent(json))
}

export function decodeMapFromParam(param) {
  try {
    const json = decodeURIComponent(atob(param))
    return JSON.parse(json)
  } catch {
    return null
  }
}

export function buildShareUrl(nodes, edges) {
  const url = new URL(window.location.href)
  url.searchParams.set('map', encodeMapToParam(nodes, edges))
  return url.toString()
}
