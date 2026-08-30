import { generateSyncCode, isValidSyncCode, normalizeSyncCode } from './code'

export interface Env {
  SYNC_KV: KVNamespace
  ALLOWED_ORIGIN?: string
}

export interface SyncPayload {
  updatedAt: number
  counters: unknown[]
}

// Largement suffisant pour une liste de compteurs (même avec historique) ;
// borne la taille acceptée plutôt que de laisser un client remplir le KV
// sans limite.
const MAX_BODY_BYTES = 256 * 1024
// Un code inutilisé pendant 180 jours libère sa place plutôt que de rester
// indéfiniment dans le stockage.
const KV_TTL_SECONDS = 60 * 60 * 24 * 180

export function kvKey(code: string): string {
  return `sync:${code}`
}

export function isValidPayload(value: unknown): value is SyncPayload {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.updatedAt === 'number' && Array.isArray(v.counters)
}

function corsHeaders(env: Env): HeadersInit {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, PUT, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function json(body: unknown, init: ResponseInit, env: Env): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env), ...(init.headers ?? {}) },
  })
}

// Collisions astronomiquement improbables (29^8 ≈ 500 milliards de
// combinaisons) : quelques essais suffisent largement à s'en prémunir sans
// jamais boucler longtemps.
const CREATE_ATTEMPTS = 5

async function handleCreate(env: Env): Promise<Response> {
  for (let attempt = 0; attempt < CREATE_ATTEMPTS; attempt++) {
    const code = generateSyncCode()
    const existing = await env.SYNC_KV.get(kvKey(code))
    if (existing !== null) continue
    const payload: SyncPayload = { updatedAt: Date.now(), counters: [] }
    await env.SYNC_KV.put(kvKey(code), JSON.stringify(payload), { expirationTtl: KV_TTL_SECONDS })
    return json({ code }, { status: 201 }, env)
  }
  return json({ error: 'Impossible de générer un code, réessaie.' }, { status: 500 }, env)
}

async function handleGet(env: Env, code: string): Promise<Response> {
  const stored = await env.SYNC_KV.get(kvKey(code))
  if (stored === null) return json({ error: 'Code inconnu.' }, { status: 404 }, env)
  return json(JSON.parse(stored), { status: 200 }, env)
}

async function handlePut(request: Request, env: Env, code: string): Promise<Response> {
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > MAX_BODY_BYTES) {
    return json({ error: 'Trop volumineux.' }, { status: 413 }, env)
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'JSON invalide.' }, { status: 400 }, env)
  }
  if (!isValidPayload(payload)) {
    return json({ error: 'Format invalide (updatedAt et counters requis).' }, { status: 400 }, env)
  }

  const existingRaw = await env.SYNC_KV.get(kvKey(code))
  const existing: SyncPayload | null = existingRaw ? JSON.parse(existingRaw) : null

  // Dernier écrit gagne : si un autre appareil a déjà poussé une version plus
  // récente entre-temps, on la renvoie telle quelle plutôt que de l'écraser —
  // l'appelant s'aligne dessus au prochain rendu plutôt que de perdre les
  // changements de l'autre appareil.
  if (existing && existing.updatedAt > payload.updatedAt) {
    return json(existing, { status: 409 }, env)
  }

  await env.SYNC_KV.put(kvKey(code), JSON.stringify(payload), { expirationTtl: KV_TTL_SECONDS })
  return json(payload, { status: 200 }, env)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) })
    }

    const url = new URL(request.url)
    const segments = url.pathname.split('/').filter(Boolean)

    if (segments[0] !== 'api' || segments[1] !== 'sync') {
      return json({ error: 'Not found' }, { status: 404 }, env)
    }

    if (segments.length === 2) {
      if (request.method !== 'POST') return json({ error: 'Method not allowed' }, { status: 405 }, env)
      return handleCreate(env)
    }

    if (segments.length === 3) {
      const code = normalizeSyncCode(segments[2])
      if (!isValidSyncCode(code)) return json({ error: 'Code invalide.' }, { status: 400 }, env)
      if (request.method === 'GET') return handleGet(env, code)
      if (request.method === 'PUT') return handlePut(request, env, code)
      return json({ error: 'Method not allowed' }, { status: 405 }, env)
    }

    return json({ error: 'Not found' }, { status: 404 }, env)
  },
}
