import * as LZString from 'lz-string'
import { makeId } from './id'
import type { Counter, CounterAppearance, CounterBehavior, DisplayStyle, HistoryPoint } from './types'

/** Déclenche le téléchargement d'un blob sous le nom de fichier donné. */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Déclenche le téléchargement d'un fichier JSON contenant tous les compteurs. */
export function downloadBackup(counters: Counter[]) {
  const blob = new Blob([JSON.stringify(counters, null, 2)], { type: 'application/json' })
  const date = new Date().toISOString().slice(0, 10)
  triggerDownload(blob, `+1-sauvegarde-${date}.json`)
}

/** Formate l'historique d'un compteur en CSV (horodatage ISO, valeur), pour
 * une analyse dans un tableur. */
export function buildHistoryCsv(counter: Counter): string {
  const rows = (counter.history ?? []).map((p) => `${new Date(p.t).toISOString()},${p.v}`)
  return ['Horodatage,Valeur', ...rows].join('\n')
}

/** Déclenche le téléchargement de l'historique d'un compteur au format CSV. */
export function downloadHistoryCsv(counter: Counter) {
  const blob = new Blob([buildHistoryCsv(counter)], { type: 'text/csv' })
  const date = new Date().toISOString().slice(0, 10)
  const safeName = counter.name.replace(/[^a-zA-Z0-9-_]+/g, '-') || 'compteur'
  triggerDownload(blob, `+1-historique-${safeName}-${date}.csv`)
}

function isValidCounter(value: unknown): value is Record<string, unknown> {
  if (!value) return false
  const c = value as Record<string, unknown>
  return typeof c.name === 'string' && typeof c.count === 'number'
}

// Avant le regroupement des réglages en `behavior`/`appearance`, ces champs
// vivaient directement sur le compteur : une sauvegarde JSON exportée avant
// cette migration (ou un lien/QR généré par `toCompact`, toujours à plat)
// les présente donc sous cette forme. `readBehavior`/`readAppearance` lisent
// l'un ou l'autre format indifféremment, pour que l'import reste transparent
// quelle que soit l'origine des données.
function readBehavior(raw: Record<string, unknown>): CounterBehavior {
  const src = (raw.behavior && typeof raw.behavior === 'object' ? raw.behavior : raw) as Record<string, unknown>
  return {
    oddsDenominator: typeof src.oddsDenominator === 'number' ? src.oddsDenominator : undefined,
    startDate: typeof src.startDate === 'string' ? src.startDate : undefined,
    step: typeof src.step === 'number' ? src.step : undefined,
    target: typeof src.target === 'number' ? src.target : undefined,
  }
}

function readAppearance(raw: Record<string, unknown>): CounterAppearance {
  const src = (raw.appearance && typeof raw.appearance === 'object' ? raw.appearance : raw) as Record<string, unknown>
  return {
    color: (typeof src.color === 'string' && src.color) || '#2563eb',
    displayStyle: typeof src.displayStyle === 'string' ? (src.displayStyle as DisplayStyle) : undefined,
    backgroundImageUrl: typeof src.backgroundImageUrl === 'string' ? src.backgroundImageUrl : undefined,
  }
}

/** Complète les champs manquants et régénère un id pour éviter les collisions. */
function normalizeCounter(raw: Record<string, unknown>): Counter {
  return {
    id: makeId(),
    name: (raw.name as string) || 'Sans nom',
    count: typeof raw.count === 'number' ? raw.count : 0,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
    history: raw.history as HistoryPoint[] | undefined,
    archived: raw.archived as boolean | undefined,
    pinned: raw.pinned as boolean | undefined,
    archivedAt: typeof raw.archivedAt === 'number' ? raw.archivedAt : undefined,
    behavior: readBehavior(raw),
    appearance: readAppearance(raw),
  }
}

/** Reconstruit un compteur déjà stocké localement en s'assurant qu'il expose
 * bien `behavior`/`appearance` imbriqués — transparent pour un compteur déjà
 * à jour, migre silencieusement un compteur enregistré avant ce regroupement
 * (champs alors à plat). Contrairement à `normalizeCounter` (utilisée à
 * l'import d'une sauvegarde ou d'un lien), ne régénère pas l'id : il s'agit
 * du même compteur, pas d'une copie. */
export function migrateStoredCounter(raw: Record<string, unknown>): Counter {
  return {
    id: raw.id as string,
    name: raw.name as string,
    count: raw.count as number,
    createdAt: raw.createdAt as number,
    history: raw.history as HistoryPoint[] | undefined,
    archived: raw.archived as boolean | undefined,
    pinned: raw.pinned as boolean | undefined,
    archivedAt: raw.archivedAt as number | undefined,
    behavior: readBehavior(raw),
    appearance: readAppearance(raw),
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
  y?: DisplayStyle
  g?: number
  a?: 1
  m?: 1
  e?: number
}

function toCompact(counter: Counter): CompactCounter {
  return {
    n: counter.name,
    c: counter.count,
    k: counter.appearance.color,
    t: counter.createdAt,
    ...(counter.behavior.oddsDenominator ? { d: counter.behavior.oddsDenominator } : {}),
    ...(counter.behavior.startDate ? { s: counter.behavior.startDate } : {}),
    ...(counter.appearance.backgroundImageUrl ? { i: counter.appearance.backgroundImageUrl } : {}),
    ...(counter.behavior.step ? { p: counter.behavior.step } : {}),
    ...(counter.appearance.displayStyle ? { y: counter.appearance.displayStyle } : {}),
    ...(counter.behavior.target ? { g: counter.behavior.target } : {}),
    ...(counter.archived ? { a: 1 } : {}),
    ...(counter.pinned ? { m: 1 } : {}),
    ...(counter.archivedAt ? { e: counter.archivedAt } : {}),
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
    displayStyle: raw.y,
    target: raw.g,
    archived: raw.a === 1 ? true : undefined,
    pinned: raw.m === 1 ? true : undefined,
    archivedAt: raw.e,
  })
}

export function encodeCountersToParam(counters: Counter[]): string {
  const compact = counters.map(toCompact)
  const json = JSON.stringify(compact)
  // Compressé (lz-string) plutôt qu'un simple base64 : un JSON répète
  // beaucoup les mêmes clés et valeurs (couleur par défaut, styles...), ce
  // qui compresse bien et réduit nettement la taille du lien/QR partagé, en
  // particulier avec beaucoup de compteurs.
  return LZString.compressToEncodedURIComponent(json)
}

/** Décode un JSON compact déjà extrait (compressé ou legacy) : `null` si le
 * paramètre est manquant, invalide, ou ne correspond pas à un tableau de
 * compteurs. */
function parseCompactJson(json: string | null | undefined): Counter[] | null {
  if (!json) return null
  try {
    const compact = JSON.parse(json) as CompactCounter[]
    // Idem : un `compact` qui n'est pas un tableau fait échouer `.map`,
    // intercepté par le catch ci-dessous (retourne null dans les deux cas).
    return compact.map(fromCompact)
  } catch {
    return null
  }
}

/** Décode un lien généré avant l'introduction de la compression lz-string
 * (base64 URL-safe d'un JSON brut, non compressé). */
function decodeLegacyParam(param: string): string | null {
  try {
    const base64 = param.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

export function decodeCountersFromParam(param: string): Counter[] | null {
  return parseCompactJson(LZString.decompressFromEncodedURIComponent(param)) ?? parseCompactJson(decodeLegacyParam(param))
}

export function buildShareUrl(counters: Counter[]): string {
  const url = new URL(window.location.href)
  url.hash = ''
  url.searchParams.set('import', encodeCountersToParam(counters))
  return url.toString()
}
