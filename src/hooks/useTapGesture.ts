import { useRef } from 'react'

// Distance de tolérance (px) entre l'appui et le relâchement pour qu'un
// geste compte comme un tap plutôt qu'un glissement/scroll.
const TAP_MOVE_THRESHOLD_PX = 10

/** Détecte un tap (appui puis relâchement au même endroit) via les
 * évènements pointer, en secours du onClick natif.
 *
 * Sur mobile, le clic natif émis par le navigateur après un touchend peut
 * occasionnellement ne pas se déclencher (ambiguïté tap/scroll, ou bug de
 * synthèse du clic pendant qu'un transform Framer Motion est encore
 * appliqué à l'élément) : suivre nous-mêmes le tap via les évènements
 * pointer (fiables même quand le clic de compatibilité échoue) sert de
 * secours au onClick natif, qui reste la voie principale pour la souris et
 * le clavier. */
export function useTapGesture(bump: (sign: 1 | -1) => void) {
  const tapStart = useRef<{ x: number; y: number } | null>(null)
  const tapHandledByPointer = useRef(false)

  const onPointerDown = (e: React.PointerEvent) => {
    // Ignore le clic droit/bouton secondaire (button !== 0) : seul un tap ou
    // un clic principal doit compter comme une intention d'incrémenter.
    if (e.button !== 0) return
    tapStart.current = { x: e.clientX, y: e.clientY }
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const start = tapStart.current
    tapStart.current = null
    if (!start) return
    const moved = Math.hypot(e.clientX - start.x, e.clientY - start.y)
    if (moved <= TAP_MOVE_THRESHOLD_PX) {
      tapHandledByPointer.current = true
      bump(1)
    }
  }

  const onPointerCancel = () => {
    tapStart.current = null
  }

  // Le tap a déjà été compté via pointerup : ignore le clic natif qui suit
  // pour ne pas incrémenter deux fois.
  const onClick = () => {
    if (tapHandledByPointer.current) {
      tapHandledByPointer.current = false
      return
    }
    bump(1)
  }

  return { onPointerDown, onPointerUp, onPointerCancel, onClick }
}
