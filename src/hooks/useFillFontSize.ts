import { useEffect, useRef, useState } from 'react'

/** Quand `active` (typiquement : 1 ou 2 compteurs affichés, style par
 * défaut), mesure l'espace réellement disponible dans l'élément référencé
 * pour afficher `digitsSource` (converti en nombre de chiffres) le plus
 * grand possible, sans déborder ni en hauteur ni en largeur. Réglé
 * spécifiquement pour les proportions de l'odomètre : les autres styles
 * s'appuient plutôt sur les tailles CSS par mode de grille (elles
 * s'expriment en `em`, donc elles suivent quand même l'espace disponible). */
export function useFillFontSize(active: boolean, digitsSource: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [fontSize, setFontSize] = useState<number | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!active || !el) {
      setFontSize(null)
      return
    }

    const digits = Math.max(digitsSource.toString().length, 1)

    const compute = () => {
      // offsetWidth/offsetHeight ignorent les transforms CSS (contrairement à
      // getBoundingClientRect), ce qui évite de mesurer une taille faussée
      // pendant les animations de réagencement de Framer Motion.
      const width = el.offsetWidth
      const height = el.offsetHeight
      if (width === 0 || height === 0) return
      const byHeight = height * 0.85
      const byWidth = width / (digits * 0.62)
      setFontSize(Math.max(48, Math.min(byHeight, byWidth)))
    }

    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [active, digitsSource])

  return { ref, fontSize }
}
