import type { Counter } from './types'

// Même alphabet que worker/src/code.ts (dupliqué volontairement : l'app et
// le worker sont deux projets déployés séparément, sans étape de build
// partagée — ces quelques lignes ne valent pas la complexité d'un package
// commun).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTWXYZ23456789'
const CODE_LENGTH = 8

export interface SyncState {
  updatedAt: number
  counters: Counter[]
}

/** Met un code saisi à la main (espaces, tirets, minuscules) au format
 * canonique attendu par le worker. */
export function normalizeSyncCode(raw: string): string {
  // Un remplacement global retire déjà les espaces/tirets en tête et en
  // queue (`\s` couvre les mêmes blancs que `.trim()`) : un `.trim()`
  // préalable, ou un `+` pour absorber une suite en un seul remplacement,
  // n'apporteraient rien d'observable.
  return raw.toUpperCase().replace(/[\s-]/g, '')
}

/** Un code normalisé valide fait exactement 8 caractères de l'alphabet
 * autorisé par le worker (voir worker/src/code.ts). Validé côté client avant
 * l'appel réseau, pour un retour immédiat sur un code mal recopié. */
export function isValidSyncCode(code: string): boolean {
  return new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`).test(code)
}

/** Présentation lisible d'un code (`XXXX XXXX`), pour l'affichage uniquement
 * — le stockage et les appels réseau utilisent toujours la forme compacte. */
export function formatSyncCode(code: string): string {
  return `${code.slice(0, 4)} ${code.slice(4)}`
}

async function readJsonOrThrow(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new Error('Réponse du serveur illisible.')
  }
}

/** Demande un nouveau code de synchronisation au worker. */
export async function createSyncCode(workerUrl: string): Promise<string> {
  const response = await fetch(`${workerUrl}/api/sync`, { method: 'POST' })
  if (!response.ok) throw new Error('Impossible de créer un code de synchronisation.')
  const body = (await readJsonOrThrow(response)) as { code: string }
  return body.code
}

/** Récupère l'état stocké pour un code. `null` si le code n'existe pas (ou
 * plus — voir l'expiration côté worker). */
export async function fetchSyncState(workerUrl: string, code: string): Promise<SyncState | null> {
  const response = await fetch(`${workerUrl}/api/sync/${code}`)
  if (response.status === 404) return null
  if (!response.ok) throw new Error('Impossible de récupérer les compteurs synchronisés.')
  return (await readJsonOrThrow(response)) as SyncState
}

export interface PushResult {
  /** `false` si un autre appareil a poussé une version plus récente entre-temps
   * (voir la résolution "dernier écrit gagne" du worker) : `state` porte alors
   * cette version plus récente, à adopter localement plutôt que réessayer. */
  accepted: boolean
  state: SyncState
}

/** Pousse l'état local vers le worker. */
export async function pushSyncState(workerUrl: string, code: string, state: SyncState): Promise<PushResult> {
  const response = await fetch(`${workerUrl}/api/sync/${code}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  })
  if (response.status === 409) return { accepted: false, state: (await readJsonOrThrow(response)) as SyncState }
  if (!response.ok) throw new Error('Impossible de synchroniser les compteurs.')
  return { accepted: true, state: (await readJsonOrThrow(response)) as SyncState }
}
