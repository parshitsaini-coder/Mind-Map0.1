// When was the terminal last running? Used to replay what price did while the app was closed.
const KEY = 'mindmap-terminal-lastseen'
export function markSeen(sec = Math.floor(Date.now() / 1000)) {
  try { localStorage.setItem(KEY, String(sec)) } catch { /* storage full/blocked */ }
}
export function getLastSeen() {
  try { return Number(localStorage.getItem(KEY)) || null } catch { return null }
}
