import { useEffect, useState } from 'react'

// Reactive window.matchMedia — false where it is unavailable (tests / SSR).
export default function useMedia(query) {
  const get = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(query).matches : false)
  const [on, setOn] = useState(get)
  useEffect(() => {
    if (!window.matchMedia) return undefined
    const mq = window.matchMedia(query)
    const h = () => setOn(mq.matches)
    mq.addEventListener('change', h)
    h()
    return () => mq.removeEventListener('change', h)
  }, [query])
  return on
}
