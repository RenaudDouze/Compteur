import { makeId } from './id'
import type { Counter } from './types'

/** Déclenche le téléchargement d'un fichier JSON contenant tous les compteurs. */
export function downloadBackup(counters: Counter[]) {
  const blob = new Blob([JSON.stringify(counters, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().slice(0, 10)
  a.href = url
  a.download = `compteur-sauvegarde-${date}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function isValidCounter(value: unknown): value is Partial<Counter> {
  if (!value) return false
  const c = value as Record<string, unknown>
  return typeof c.name === 'string' && typeof c.count === 'number'
}

/** Complète les champs manquants et régénère un id pour éviter les collisions. */
function normalizeCounter(raw: Partial<Counter>): Counter {
  return {
    id: makeId(),
    name: raw.name || 'Sans nom',
    count: typeof raw.count === 'number' ? raw.count : 0,
    color: raw.color || '#2563eb',
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    oddsDenominator: raw.oddsDenominator,
    startDate: raw.startDate,
    backgroundImageUrl: raw.backgroundImageUrl,
    step: raw.step,
  }
}

/** Parse un fichier JSON exporté. Retourne null si le contenu n'est pas valide. */
export function parseBackupJson(text: string): Counter[] | null {
  try {
    const data = JSON.parse(text)
    // Pas de vérification explicite Array.isArray : un `data` qui n'est pas
    // un tableau (objet, nombre...) fait échouer `.filter` juste en dessous,
    // ce qui est intercepté par le catch et retourne null tout de même.
    const valid = data.filter(isValidCounter)
    if (valid.length === 0) return null
    return valid.map(normalizeCounter)
  } catch {
    return null
  }
}

// Format compact utilisé pour le lien/QR code, pour limiter la taille encodée.
interface CompactCounter {
  n: string
  c: number
  k: string
  t: number
  d?: number
  s?: string
  i?: string
  p?: number
}

function toCompact(counter: Counter): CompactCounter {
  return {
    n: counter.name,
    c: counter.count,
    k: counter.color,
    t: counter.createdAt,
    ...(counter.oddsDenominator ? { d: counter.oddsDenominator } : {}),
    ...(counter.startDate ? { s: counter.startDate } : {}),
    ...(counter.backgroundImageUrl ? { i: counter.backgroundImageUrl } : {}),
    ...(counter.step ? { p: counter.step } : {}),
  }
}

function fromCompact(raw: CompactCounter): Counter {
  return normalizeCounter({
    name: raw.n,
    count: raw.c,
    color: raw.k,
    createdAt: raw.t,
    oddsDenominator: raw.d,
    startDate: raw.s,
    backgroundImageUrl: raw.i,
    step: raw.p,
  })
}

export function encodeCountersToParam(counters: Counter[]): string {
  const compact = counters.map(toCompact)
  const json = JSON.stringify(compact)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  // Les caractères `=` de bourrage base64 n'apparaissent jamais qu'en fin de
  // chaîne : pas besoin d'ancrer `$` explicitement.
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+/, '')
}

export function decodeCountersFromParam(param: string): Counter[] | null {
  try {
    const base64 = param.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    const json = new TextDecoder().decode(bytes)
    const compact = JSON.parse(json) as CompactCounter[]
    // Idem : un `compact` qui n'est pas un tableau fait échouer `.map`,
    // intercepté par le catch ci-dessous (retourne null dans les deux cas).
    return compact.map(fromCompact)
  } catch {
    return null
  }
}

export function buildShareUrl(counters: Counter[]): string {
  const url = new URL(window.location.href)
  url.hash = ''
  url.searchParams.set('import', encodeCountersToParam(counters))
  return url.toString()
}
