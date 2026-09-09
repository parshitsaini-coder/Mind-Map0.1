import { useEffect, useState } from 'react'

// Matches Tailwind's `sm` breakpoint (640px) — below this, panels switch
// from a docked/overlay side panel to a full-width bottom sheet, which is
// far more comfortable to reach and read on a phone-width touch screen.
const MOBILE_QUERY = '(max-width: 639px)'

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches
  )

  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY)
    const onChange = (e) => setIsMobile(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isMobile
}
