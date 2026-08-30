import { beforeEach, describe, expect, it } from 'vitest'
import worker, { isValidPayload, kvKey, type Env } from './index'
import { generateSyncCode } from './code'

/** Implémentation en mémoire du sous-ensemble de KVNamespace utilisé par le
 * worker (get/put) : suffisant pour tester le routage et la logique sans
 * dépendre du runtime Cloudflare. */
function createMockKv() {
  const store = new Map<string, string>()
  return {
    store,
    get: (async (key: string) => store.get(key) ?? null) as KVNamespace['get'],
    put: (async (key: string, value: string) => {
      store.set(key, value)
    }) as KVNamespace['put'],
  } as unknown as KVNamespace
}

function makeEnv(): Env {
  return { SYNC_KV: createMockKv(), ALLOWED_ORIGIN: '*' }
}

function request(method: string, path: string, body?: unknown): Request {
  const init: RequestInit = { method }
  if (body !== undefined) {
    const json = JSON.stringify(body)
    init.body = json
    init.headers = { 'Content-Type': 'application/json', 'Content-Length': String(json.length) }
  }
  return new Request(`https://sync.example.com${path}`, init)
}

describe('isValidPayload', () => {
  it('accepte updatedAt numérique et counters tableau', () => {
    expect(isValidPayload({ updatedAt: 1, counters: [] })).toBe(true)
  })

  it('refuse une valeur qui n\'est pas un objet', () => {
    expect(isValidPayload('nope')).toBe(false)
  })

  it('refuse null', () => {
    expect(isValidPayload(null)).toBe(false)
  })

  it("refuse un updatedAt non numérique", () => {
    expect(isValidPayload({ updatedAt: '1', counters: [] })).toBe(false)
  })

  it("refuse counters qui n'est pas un tableau", () => {
    expect(isValidPayload({ updatedAt: 1, counters: {} })).toBe(false)
  })
})

describe('routage', () => {
  let env: Env

  beforeEach(() => {
    env = makeEnv()
  })

  it('répond au préflight CORS', async () => {
    const res = await worker.fetch(request('OPTIONS', '/api/sync'), env)
    expect(res.status).toBe(204)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it("retombe sur '*' quand ALLOWED_ORIGIN n'est pas configuré", async () => {
    const bareEnv: Env = { SYNC_KV: env.SYNC_KV }
    const res = await worker.fetch(request('OPTIONS', '/api/sync'), bareEnv)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })

  it('renvoie 404 hors du préfixe /api/sync', async () => {
    const res = await worker.fetch(request('GET', '/autre-chose'), env)
    expect(res.status).toBe(404)
  })

  it('renvoie 405 sur /api/sync avec une méthode autre que POST', async () => {
    const res = await worker.fetch(request('GET', '/api/sync'), env)
    expect(res.status).toBe(405)
  })

  it('renvoie 400 pour un code au mauvais format', async () => {
    const res = await worker.fetch(request('GET', '/api/sync/trop-court'), env)
    expect(res.status).toBe(400)
  })

  it('renvoie 405 sur /api/sync/:code avec une méthode autre que GET/PUT', async () => {
    const code = generateSyncCode()
    const res = await worker.fetch(request('DELETE', `/api/sync/${code}`), env)
    expect(res.status).toBe(405)
  })

  it('renvoie 404 pour un chemin plus profond que /api/sync/:code', async () => {
    const code = generateSyncCode()
    const res = await worker.fetch(request('GET', `/api/sync/${code}/extra`), env)
    expect(res.status).toBe(404)
  })
})

describe('POST /api/sync (création)', () => {
  it('crée un nouveau code et le stocke avec un état vide', async () => {
    const env = makeEnv()
    const res = await worker.fetch(request('POST', '/api/sync'), env)
    expect(res.status).toBe(201)
    const body = (await res.json()) as { code: string }
    expect(body.code).toHaveLength(8)

    const stored = await env.SYNC_KV.get(kvKey(body.code))
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored!)).toEqual({ updatedAt: expect.any(Number), counters: [] })
  })

  it('réessaie sur collision plutôt que de renvoyer un code déjà pris', async () => {
    const env = makeEnv()
    const occupied = 'A'.repeat(8)
    await env.SYNC_KV.put(kvKey(occupied), JSON.stringify({ updatedAt: 1, counters: [] }))

    // `Math.random() = 0` produit systématiquement le premier caractère de
    // l'alphabet ('A') : forcé pour les 8 caractères de la première tentative
    // (code == 'AAAAAAAA', déjà occupé), puis relâché pour que la deuxième
    // tentative génère un code différent et réussisse.
    const originalRandom = Math.random
    let calls = 0
    Math.random = () => {
      calls++
      return calls <= 8 ? 0 : originalRandom()
    }
    try {
      const res = await worker.fetch(request('POST', '/api/sync'), env)
      expect(res.status).toBe(201)
      const body = (await res.json()) as { code: string }
      expect(body.code).not.toBe(occupied)
      expect(calls).toBeGreaterThan(8)
    } finally {
      Math.random = originalRandom
    }
  })

  it('renvoie 500 si aucun code libre trouvé après plusieurs essais', async () => {
    const env = makeEnv()
    const originalRandom = Math.random
    Math.random = () => 0 // génère toujours le même code -> toujours en collision
    try {
      await env.SYNC_KV.put(kvKey('A'.repeat(8)), 'occupé')
      const res = await worker.fetch(request('POST', '/api/sync'), env)
      expect(res.status).toBe(500)
    } finally {
      Math.random = originalRandom
    }
  })
})

describe('GET /api/sync/:code (lecture)', () => {
  it('renvoie 404 pour un code inconnu', async () => {
    const env = makeEnv()
    const code = generateSyncCode()
    const res = await worker.fetch(request('GET', `/api/sync/${code}`), env)
    expect(res.status).toBe(404)
  })

  it('renvoie le contenu stocké pour un code existant', async () => {
    const env = makeEnv()
    const code = generateSyncCode()
    const payload = { updatedAt: 42, counters: [{ id: 'a' }] }
    await env.SYNC_KV.put(kvKey(code), JSON.stringify(payload))

    const res = await worker.fetch(request('GET', `/api/sync/${code}`), env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(payload)
  })

  it('normalise le code de la route (tirets, minuscules)', async () => {
    const env = makeEnv()
    const code = generateSyncCode()
    const payload = { updatedAt: 1, counters: [] }
    await env.SYNC_KV.put(kvKey(code), JSON.stringify(payload))

    const spacedOut = `${code.slice(0, 4)}-${code.slice(4)}`.toLowerCase()
    const res = await worker.fetch(request('GET', `/api/sync/${spacedOut}`), env)
    expect(res.status).toBe(200)
  })
})

describe('PUT /api/sync/:code (écriture)', () => {
  it('crée le blob si le code n\'a encore rien stocké', async () => {
    const env = makeEnv()
    const code = generateSyncCode()
    const payload = { updatedAt: 100, counters: [{ id: 'a' }] }

    const res = await worker.fetch(request('PUT', `/api/sync/${code}`, payload), env)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(payload)
  })

  it('accepte et remplace quand la version envoyée est plus récente', async () => {
    const env = makeEnv()
    const code = generateSyncCode()
    await env.SYNC_KV.put(kvKey(code), JSON.stringify({ updatedAt: 10, counters: [] }))

    const fresher = { updatedAt: 20, counters: [{ id: 'b' }] }
    const res = await worker.fetch(request('PUT', `/api/sync/${code}`, fresher), env)
    expect(res.status).toBe(200)
    expect(JSON.parse((await env.SYNC_KV.get(kvKey(code)))!)).toEqual(fresher)
  })

  it('accepte une version dont l\'horodatage est exactement égal (égalité = acceptée)', async () => {
    const env = makeEnv()
    const code = generateSyncCode()
    await env.SYNC_KV.put(kvKey(code), JSON.stringify({ updatedAt: 10, counters: [] }))

    const sameStamp = { updatedAt: 10, counters: [{ id: 'c' }] }
    const res = await worker.fetch(request('PUT', `/api/sync/${code}`, sameStamp), env)
    expect(res.status).toBe(200)
  })

  it('refuse (409) et renvoie la version serveur quand elle est plus récente', async () => {
    const env = makeEnv()
    const code = generateSyncCode()
    const serverVersion = { updatedAt: 999, counters: [{ id: 'serveur' }] }
    await env.SYNC_KV.put(kvKey(code), JSON.stringify(serverVersion))

    const stale = { updatedAt: 1, counters: [{ id: 'périmé' }] }
    const res = await worker.fetch(request('PUT', `/api/sync/${code}`, stale), env)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual(serverVersion)
  })

  it('renvoie 400 pour un JSON invalide', async () => {
    const env = makeEnv()
    const code = generateSyncCode()
    const req = new Request(`https://sync.example.com/api/sync/${code}`, {
      method: 'PUT',
      body: '{ pas du json',
      headers: { 'Content-Length': '20' },
    })
    const res = await worker.fetch(req, env)
    expect(res.status).toBe(400)
  })

  it('renvoie 400 pour un payload de forme invalide', async () => {
    const env = makeEnv()
    const code = generateSyncCode()
    const res = await worker.fetch(request('PUT', `/api/sync/${code}`, { nope: true }), env)
    expect(res.status).toBe(400)
  })

  it("traite l'absence d'en-tête Content-Length comme une taille nulle (accepte le corps)", async () => {
    const env = makeEnv()
    const code = generateSyncCode()
    const payload = { updatedAt: 1, counters: [] }
    const req = new Request(`https://sync.example.com/api/sync/${code}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    const res = await worker.fetch(req, env)
    expect(res.status).toBe(200)
  })

  it('renvoie 413 pour un corps trop volumineux', async () => {
    const env = makeEnv()
    const code = generateSyncCode()
    const req = new Request(`https://sync.example.com/api/sync/${code}`, {
      method: 'PUT',
      body: JSON.stringify({ updatedAt: 1, counters: [] }),
      headers: { 'Content-Length': String(1024 * 1024) },
    })
    const res = await worker.fetch(req, env)
    expect(res.status).toBe(413)
  })
})
