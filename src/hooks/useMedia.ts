import { useEffect, useState } from 'react'

export function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const fn = () => setMatch(mq.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [query])
  return match
}

export const useIsMobile = () => useMedia('(max-width: 767px)')
export const useIsTablet = () => useMedia('(max-width: 1079px)')
export const useReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)')
