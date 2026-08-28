/** Fusionne un nouvel ordre — portant sur `newOrder`, un sous-ensemble
 * visible de `prev` potentiellement filtré (recherche, vue Actifs/Archivés)
 * — dans la liste complète : les éléments absents de `newOrder` (masqués par
 * le filtre) gardent leur position, seuls les éléments visibles changent de
 * place entre eux (chacun réoccupe l'emplacement d'un autre élément visible). */
export function mergeVisibleOrder<T extends { id: string }>(prev: T[], newOrder: T[]): T[] {
  const visibleIds = new Set(newOrder.map((item) => item.id))
  const slots: number[] = []
  prev.forEach((item, i) => {
    if (visibleIds.has(item.id)) slots.push(i)
  })
  const next = [...prev]
  slots.forEach((slot, k) => {
    next[slot] = newOrder[k]
  })
  return next
}
