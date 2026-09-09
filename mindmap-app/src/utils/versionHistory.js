const KEY = 'mindmap-versions'
const MAX_SNAPSHOTS = 20

export function listSnapshots() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

export function saveSnapshot(label, data) {
  const existing = listSnapshots()
  const snapshot = { id: `v_${Date.now()}`, label: label || 'Untitled snapshot', timestamp: Date.now(), data }
  const updated = [snapshot, ...existing].slice(0, MAX_SNAPSHOTS)
  localStorage.setItem(KEY, JSON.stringify(updated))
  return snapshot
}

export function deleteSnapshot(id) {
  const updated = listSnapshots().filter((s) => s.id !== id)
  localStorage.setItem(KEY, JSON.stringify(updated))
}
