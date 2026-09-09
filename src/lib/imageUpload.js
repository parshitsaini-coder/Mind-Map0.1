import { supabase, isSupabaseConfigured } from './supabaseClient'

const BUCKET = 'mindmap-media'

// Returns { url, hosted } — `hosted: true` means it's a real Supabase
// Storage URL (small, survives share links); `hosted: false` means it's a
// base64 data URL fallback (works locally, but exportShareLink.js will
// strip it from a share link if the map is too large).
export async function uploadNodeImage(file) {
  if (!isSupabaseConfigured || !supabase) {
    return { url: await fileToDataUrl(file), hosted: false }
  }

  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type || undefined,
  })

  if (error) {
    // Most common cause: the `mindmap-media` bucket doesn't exist yet in
    // this Supabase project — fall back to base64 rather than losing the
    // image entirely, and let the caller surface the error to the user.
    console.error('Image upload failed, falling back to embedded image:', error.message)
    return { url: await fileToDataUrl(file), hosted: false, error: error.message }
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return { url: data.publicUrl, hosted: true }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
