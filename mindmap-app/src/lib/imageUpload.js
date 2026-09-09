import { supabase, isSupabaseConfigured } from './supabaseClient'

const SUPABASE_BUCKET = 'mindmap-media'

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET
const isCloudinaryConfigured = Boolean(CLOUDINARY_CLOUD_NAME && CLOUDINARY_UPLOAD_PRESET)

// Returns { url, hosted } — `hosted: true` means it's a real hosted URL
// (small, survives share links); `hosted: false` means it's a base64 data
// URL fallback (works locally, but exportShareLink.js will strip it from a
// share link if the map is too large).
//
// Priority: Cloudinary (primary, per the user's choice) → Supabase Storage
// (kept as a fallback in case Cloudinary isn't configured but Supabase
// already was) → base64 embed (last resort, no backend configured at all).
export async function uploadNodeImage(file) {
  if (isCloudinaryConfigured) {
    try {
      return await uploadToCloudinary(file)
    } catch (err) {
      console.error('Cloudinary upload failed, trying next fallback:', err.message)
      // fall through to Supabase / base64 below
    }
  }

  if (isSupabaseConfigured && supabase) {
    return uploadToSupabase(file)
  }

  return { url: await fileToDataUrl(file), hosted: false }
}

async function uploadToCloudinary(file) {
  const form = new FormData()
  form.append('file', file)
  form.append('upload_preset', CLOUDINARY_UPLOAD_PRESET)

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
    method: 'POST',
    body: form,
  })
  const data = await res.json()

  if (!res.ok) {
    // Most common causes: wrong cloud name, upload preset doesn't exist,
    // or the preset isn't set to "Unsigned" in the Cloudinary dashboard.
    throw new Error(data?.error?.message || `Cloudinary upload failed (${res.status})`)
  }

  return { url: data.secure_url, hosted: true }
}

async function uploadToSupabase(file) {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: false,
    contentType: file.type || undefined,
  })

  if (error) {
    console.error('Supabase image upload failed, falling back to embedded image:', error.message)
    return { url: await fileToDataUrl(file), hosted: false, error: error.message }
  }

  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(path)
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
