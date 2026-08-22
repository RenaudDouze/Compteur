import { useEffect, useState } from 'react'

/** true tant que la largeur de l'écran reste sous le seuil (téléphone vs tablette). */
export function useNarrowScreen(breakpoint = 480): boolean {
  const query = `(max-width: ${breakpoint}px)`
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches)

  useEffect(() => {
    const mql = window.matchMedia(query)
    const handler = (e: MediaQueryListEvent) => setNarrow(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [query])

  return narrow
}
