// TradingView snapshots print "<username> created with TradingView.com …" on
// the first text row. This finds just the username (everything before the
// first word-gap) so only that part gets blurred.
//
// Returns { w, h } as FRACTIONS of the image width/height, or null when the
// image can't be read (cross-origin canvas taint) — callers fall back to a
// fixed box.
export function usernameBoxFromPixels(data, W, H) {
  const bandH = Math.min(H, Math.max(8, Math.round(W * 0.03)))
  const maxX = Math.min(W, Math.round(W * 0.28))
  const bg = [data[0], data[1], data[2]]
  const diff = (x, y) => {
    const i = (y * W + x) * 4
    return Math.abs(data[i] - bg[0]) + Math.abs(data[i + 1] - bg[1]) + Math.abs(data[i + 2] - bg[2])
  }
  // Pass 1: which rows hold text (strong contrast only — keeps the grey
  // chart area below the header row out of it).
  const rowInk = new Uint8Array(bandH)
  for (let y = 0; y < bandH; y++) for (let x = 0; x < maxX; x++) if (diff(x, y) > 260) { rowInk[y] = 1; break }
  const y0 = rowInk.indexOf(1)
  if (y0 < 0) return null
  let y1 = y0
  for (let y = y0; y < bandH && rowInk[y]; y++) y1 = y
  // Pass 2: ink columns inside those rows, with a lower threshold so thin
  // letters (i, l) don't read as gaps.
  const inkCol = new Uint8Array(maxX)
  for (let x = 0; x < maxX; x++) for (let y = y0; y <= y1; y++) if (diff(x, y) > 110) { inkCol[x] = 1; break }
  const start = inkCol.indexOf(1)
  if (start < 0) return null
  const gapMin = Math.max(3, Math.round(W * 0.0032))
  let end = start
  let gap = 0
  for (let x = start; x < maxX; x++) {
    if (inkCol[x]) {
      end = x
      gap = 0
    } else if (++gap >= gapMin) break
  }
  const pad = Math.max(2, Math.round(W * 0.003))
  return {
    x: Math.max(0, start - pad) / W,
    y: Math.max(0, y0 - pad) / H,
    w: (end - start + pad * 2) / W,
    h: (y1 - y0 + 1 + pad * 2) / H,
  }
}

export function detectUsernameBox(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const W = img.naturalWidth
        const H = img.naturalHeight
        const bandH = Math.min(H, Math.max(8, Math.round(W * 0.03)))
        const c = document.createElement('canvas')
        c.width = W
        c.height = bandH
        const ctx = c.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0)
        const d = ctx.getImageData(0, 0, W, bandH).data
        const r = usernameBoxFromPixels(d, W, H)
        resolve(r && { ...r, w: Math.min(r.w, 0.3) })
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

// Bakes the blur INTO the pixels (so "Copy image" / "Save image as" give the
// masked picture, not the original). Resolves { url, box } — url is a blob:
// URL — or null when the canvas can't be read (cross-origin) and the caller
// has to fall back to a CSS overlay.
export function maskedImage(url) {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const W = img.naturalWidth
        const H = img.naturalHeight
        const c = document.createElement('canvas')
        c.width = W
        c.height = H
        const ctx = c.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(img, 0, 0)
        const bandH = Math.min(H, Math.max(8, Math.round(W * 0.03)))
        const r = usernameBoxFromPixels(ctx.getImageData(0, 0, W, bandH).data, W, H)
        const b = r
          ? { x: r.x * W, y: r.y * H, w: Math.min(r.w, 0.3) * W, h: r.h * H }
          : { x: 0, y: 0, w: W * 0.08, h: H * 0.036 }
        const bx = Math.max(0, Math.floor(b.x))
        const by = Math.max(0, Math.floor(b.y))
        const bw = Math.min(W - bx, Math.ceil(b.w))
        const bh = Math.min(H - by, Math.ceil(b.h))
        // Mosaic (kills legibility) then a soft blur + grey veil on top.
        const tmp = document.createElement('canvas')
        const sw = Math.max(2, Math.round(bw / 7))
        const sh = Math.max(2, Math.round(bh / 7))
        tmp.width = sw
        tmp.height = sh
        tmp.getContext('2d').drawImage(c, bx, by, bw, bh, 0, 0, sw, sh)
        ctx.save()
        ctx.beginPath()
        ctx.rect(bx, by, bw, bh)
        ctx.clip()
        ctx.imageSmoothingEnabled = true
        ctx.filter = `blur(${Math.max(2, Math.round(W * 0.003))}px)`
        ctx.drawImage(tmp, bx, by, bw, bh)
        ctx.filter = 'none'
        ctx.fillStyle = 'rgba(150,150,150,0.4)'
        ctx.fillRect(bx, by, bw, bh)
        ctx.restore()
        c.toBlob((blob) => resolve(blob ? { url: URL.createObjectURL(blob) } : null), 'image/png')
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}
