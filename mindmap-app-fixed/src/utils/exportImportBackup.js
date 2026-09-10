const BACKUP_VERSION = 1

// Triggers a browser download of the current map as a .json file. Kept
// deliberately uncompressed/readable (unlike the share-link encoder) since
// this file never goes in a URL — there's no size pressure, so full-size
// embedded images are kept as-is rather than stripped.
export function downloadMapBackup({ nodes, edges, groups, activityLog }, filename = 'mindmap-backup') {
  const payload = {
    backupVersion: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    nodes,
    edges,
    groups: groups || [],
    activityLog: activityLog || [],
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filename}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Reads a File (from an <input type="file"> change event) and returns the
// parsed { nodes, edges, groups, activityLog }, or throws with a
// human-readable message if the file isn't a valid backup.
export function readMapBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      let data
      try {
        data = JSON.parse(reader.result)
      } catch {
        reject(new Error('That file isn\u2019t valid JSON.'))
        return
      }
      if (!Array.isArray(data?.nodes)) {
        reject(new Error('That doesn\u2019t look like a mind map backup file.'))
        return
      }
      resolve({
        nodes: data.nodes,
        edges: Array.isArray(data.edges) ? data.edges : [],
        groups: Array.isArray(data.groups) ? data.groups : [],
        activityLog: Array.isArray(data.activityLog) ? data.activityLog : [],
      })
    }
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsText(file)
  })
}
