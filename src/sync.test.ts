import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildHistoryCsv,
  buildShareUrl,
  decodeCountersFromParam,
  downloadBackup,
  downloadHistoryCsv,
  encodeCountersToParam,
  parseBackupJson,
} from './sync'
import type { Counter } from './types'

/** Générateur déterministe (même seed = même résultat) à forte entropie. */
function pseudoRandomString(seed: number, length: number): string {
  let s = ''
  let x = seed
  for (let i = 0; i < length; i++) {
    x = (x * 1103515245 + 12345) & 0x7fffffff
    s += String.fromCharCode(32 + (x % 95))
  }
  return s
}

function makeCounter(overrides: Partial<Counter> = {}): Counter {
  return {
    id: 'fixed-id',
    name: 'Compteur test',
    count: 5,
    color: '#2563eb',
    createdAt: 1_700_000_000_000,
    ...overrides,
  }
}

describe('downloadBackup', () => {
  let createElementSpy: ReturnType<typeof vi.spyOn>
  let clickSpy: ReturnType<typeof vi.fn<() => void>>
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>
  let lastAnchor: HTMLAnchorElement | null

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 22))
    clickSpy = vi.fn()
    lastAnchor = null
    const originalCreateElement = document.createElement.bind(document)
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') {
        const anchor = el as HTMLAnchorElement
        anchor.click = clickSpy
        lastAnchor = anchor
      }
      return el
    })
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    createElementSpy.mockRestore()
    createObjectURLSpy.mockRestore()
    revokeObjectURLSpy.mockRestore()
  })

  it('crée un blob JSON contenant tous les compteurs', async () => {
    const counters = [makeCounter({ name: 'A' }), makeCounter({ name: 'B', id: 'id-2' })]
    downloadBackup(counters)

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    const blob = createObjectURLSpy.mock.calls[0][0] as Blob
    expect(blob.type).toBe('application/json')
    const text = await blob.text()
    expect(JSON.parse(text)).toEqual(counters)
  })

  it('déclenche le téléchargement avec un nom de fichier daté', () => {
    downloadBackup([makeCounter()])
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('nomme le fichier avec la date du jour', () => {
    downloadBackup([makeCounter()])
    expect(lastAnchor?.download).toBe('compteur-sauvegarde-2026-08-22.json')
  })

  it('révoque l\'URL objet après le téléchargement', () => {
    downloadBackup([makeCounter()])
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
  })

  it('attache le lien au document avant de déclencher le téléchargement', () => {
    const appendChildSpy = vi.spyOn(document.body, 'appendChild')
    downloadBackup([makeCounter()])
    expect(appendChildSpy).toHaveBeenCalledWith(lastAnchor)
    appendChildSpy.mockRestore()
  })

  it('retire le lien du document après le téléchargement', () => {
    downloadBackup([makeCounter()])
    expect(lastAnchor?.isConnected).toBe(false)
  })
})

describe('buildHistoryCsv', () => {
  it("ne génère que l'en-tête pour un compteur sans historique", () => {
    expect(buildHistoryCsv(makeCounter({ history: undefined }))).toBe('Horodatage,Valeur')
  })

  it("ne génère que l'en-tête pour un historique vide", () => {
    expect(buildHistoryCsv(makeCounter({ history: [] }))).toBe('Horodatage,Valeur')
  })

  it('formate chaque point en horodatage ISO et valeur, dans l\'ordre', () => {
    const csv = buildHistoryCsv(
      makeCounter({
        history: [
          { t: Date.UTC(2026, 7, 1, 10, 0, 0), v: 0 },
          { t: Date.UTC(2026, 7, 2, 15, 30, 0), v: 3 },
        ],
      })
    )
    expect(csv).toBe(
      ['Horodatage,Valeur', '2026-08-01T10:00:00.000Z,0', '2026-08-02T15:30:00.000Z,3'].join('\n')
    )
  })
})

describe('downloadHistoryCsv', () => {
  let createElementSpy: ReturnType<typeof vi.spyOn>
  let clickSpy: ReturnType<typeof vi.fn<() => void>>
  let createObjectURLSpy: ReturnType<typeof vi.spyOn>
  let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>
  let lastAnchor: HTMLAnchorElement | null

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 22))
    clickSpy = vi.fn()
    lastAnchor = null
    const originalCreateElement = document.createElement.bind(document)
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') {
        const anchor = el as HTMLAnchorElement
        anchor.click = clickSpy
        lastAnchor = anchor
      }
      return el
    })
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    createElementSpy.mockRestore()
    createObjectURLSpy.mockRestore()
    revokeObjectURLSpy.mockRestore()
  })

  it("crée un blob CSV contenant l'historique du compteur", async () => {
    const counter = makeCounter({ history: [{ t: Date.UTC(2026, 7, 1), v: 2 }] })
    downloadHistoryCsv(counter)

    expect(createObjectURLSpy).toHaveBeenCalledTimes(1)
    const blob = createObjectURLSpy.mock.calls[0][0] as Blob
    expect(blob.type).toBe('text/csv')
    expect(await blob.text()).toBe(buildHistoryCsv(counter))
  })

  it('déclenche le téléchargement', () => {
    downloadHistoryCsv(makeCounter())
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('nomme le fichier avec le nom du compteur et la date du jour', () => {
    downloadHistoryCsv(makeCounter({ name: 'Pompes' }))
    expect(lastAnchor?.download).toBe('compteur-historique-Pompes-2026-08-22.csv')
  })

  it('remplace les caractères non alphanumériques du nom par des tirets', () => {
    downloadHistoryCsv(makeCounter({ name: 'Écrémé 🎲 / café' }))
    expect(lastAnchor?.download).toBe('compteur-historique--cr-m-caf--2026-08-22.csv')
  })

  it("utilise 'compteur' comme nom de secours si le nom est vide", () => {
    downloadHistoryCsv(makeCounter({ name: '' }))
    expect(lastAnchor?.download).toBe('compteur-historique-compteur-2026-08-22.csv')
  })

  it("révoque l'URL objet après le téléchargement", () => {
    downloadHistoryCsv(makeCounter())
    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url')
  })

  it('attache le lien au document avant de déclencher le téléchargement, puis le retire', () => {
    const appendChildSpy = vi.spyOn(document.body, 'appendChild')
    downloadHistoryCsv(makeCounter())
    expect(appendChildSpy).toHaveBeenCalledWith(lastAnchor)
    expect(lastAnchor?.isConnected).toBe(false)
    appendChildSpy.mockRestore()
  })
})

describe('parseBackupJson', () => {
  it('retourne null pour un JSON invalide', () => {
    expect(parseBackupJson('{invalide')).toBeNull()
  })

  it('retourne null si le JSON ne représente pas un tableau', () => {
    expect(parseBackupJson('{"name":"x","count":1}')).toBeNull()
  })

  it('retourne null pour un tableau vide', () => {
    expect(parseBackupJson('[]')).toBeNull()
  })

  it('retourne null si aucun élément du tableau n\'est un compteur valide', () => {
    expect(parseBackupJson('[1, "x", null, {"foo":"bar"}]')).toBeNull()
  })

  it('filtre les éléments invalides et garde les compteurs valides', () => {
    const result = parseBackupJson(
      JSON.stringify([
        { name: 'Valide', count: 3 },
        { name: 'Sans count' },
        { count: 5 },
        null,
        42,
        'texte',
      ])
    )
    expect(result).toHaveLength(1)
    expect(result?.[0].name).toBe('Valide')
    expect(result?.[0].count).toBe(3)
  })

  it('régénère un id pour chaque compteur importé', () => {
    const result = parseBackupJson(JSON.stringify([{ id: 'ancien-id', name: 'A', count: 1 }]))
    expect(result?.[0].id).not.toBe('ancien-id')
    expect(result?.[0].id).toBeTruthy()
  })

  it('utilise un id de secours quand crypto.randomUUID est indisponible', () => {
    vi.stubGlobal('crypto', {})
    const result = parseBackupJson(JSON.stringify([{ name: 'A', count: 1 }]))
    expect(result?.[0].id).toMatch(/^id-\d+-[0-9a-f]+$/)
    vi.unstubAllGlobals()
  })

  it('remplace un nom vide par "Sans nom"', () => {
    const result = parseBackupJson(JSON.stringify([{ name: '', count: 1 }]))
    expect(result?.[0].name).toBe('Sans nom')
  })

  it('conserve un nom non vide', () => {
    const result = parseBackupJson(JSON.stringify([{ name: 'Mon compteur', count: 1 }]))
    expect(result?.[0].name).toBe('Mon compteur')
  })

  it('conserve un count à 0', () => {
    const result = parseBackupJson(JSON.stringify([{ name: 'A', count: 0 }]))
    expect(result?.[0].count).toBe(0)
  })

  it('conserve un count négatif', () => {
    const result = parseBackupJson(JSON.stringify([{ name: 'A', count: -7 }]))
    expect(result?.[0].count).toBe(-7)
  })

  it('applique une couleur par défaut si absente', () => {
    const result = parseBackupJson(JSON.stringify([{ name: 'A', count: 1 }]))
    expect(result?.[0].color).toBe('#2563eb')
  })

  it('conserve la couleur fournie', () => {
    const result = parseBackupJson(JSON.stringify([{ name: 'A', count: 1, color: '#16a34a' }]))
    expect(result?.[0].color).toBe('#16a34a')
  })

  it('applique createdAt = maintenant si absent ou invalide', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 22))
    const result = parseBackupJson(JSON.stringify([{ name: 'A', count: 1 }]))
    expect(result?.[0].createdAt).toBe(new Date(2026, 7, 22).getTime())
    vi.useRealTimers()
  })

  it('conserve createdAt fourni', () => {
    const result = parseBackupJson(JSON.stringify([{ name: 'A', count: 1, createdAt: 123456 }]))
    expect(result?.[0].createdAt).toBe(123456)
  })

  it('conserve oddsDenominator et startDate optionnels', () => {
    const result = parseBackupJson(
      JSON.stringify([{ name: 'A', count: 1, oddsDenominator: 4096, startDate: '2026-08-01' }])
    )
    expect(result?.[0].oddsDenominator).toBe(4096)
    expect(result?.[0].startDate).toBe('2026-08-01')
  })

  it('laisse oddsDenominator et startDate indéfinis si absents', () => {
    const result = parseBackupJson(JSON.stringify([{ name: 'A', count: 1 }]))
    expect(result?.[0].oddsDenominator).toBeUndefined()
    expect(result?.[0].startDate).toBeUndefined()
  })

  it('conserve backgroundImageUrl optionnel', () => {
    const result = parseBackupJson(
      JSON.stringify([{ name: 'A', count: 1, backgroundImageUrl: 'https://exemple.com/x.jpg' }])
    )
    expect(result?.[0].backgroundImageUrl).toBe('https://exemple.com/x.jpg')
  })

  it('laisse backgroundImageUrl indéfini si absent', () => {
    const result = parseBackupJson(JSON.stringify([{ name: 'A', count: 1 }]))
    expect(result?.[0].backgroundImageUrl).toBeUndefined()
  })

  it('conserve step optionnel', () => {
    const result = parseBackupJson(JSON.stringify([{ name: 'A', count: 1, step: 5 }]))
    expect(result?.[0].step).toBe(5)
  })

  it('laisse step indéfini si absent', () => {
    const result = parseBackupJson(JSON.stringify([{ name: 'A', count: 1 }]))
    expect(result?.[0].step).toBeUndefined()
  })

  it('conserve displayStyle et target optionnels', () => {
    const result = parseBackupJson(JSON.stringify([{ name: 'A', count: 1, displayStyle: 'segment7', target: 50 }]))
    expect(result?.[0].displayStyle).toBe('segment7')
    expect(result?.[0].target).toBe(50)
  })

  it('laisse displayStyle et target indéfinis si absents', () => {
    const result = parseBackupJson(JSON.stringify([{ name: 'A', count: 1 }]))
    expect(result?.[0].displayStyle).toBeUndefined()
    expect(result?.[0].target).toBeUndefined()
  })

  it('conserve history optionnel', () => {
    const result = parseBackupJson(
      JSON.stringify([{ name: 'A', count: 1, history: [{ t: 1000, v: 0 }, { t: 2000, v: 1 }] }])
    )
    expect(result?.[0].history).toEqual([
      { t: 1000, v: 0 },
      { t: 2000, v: 1 },
    ])
  })

  it('laisse history indéfini si absent', () => {
    const result = parseBackupJson(JSON.stringify([{ name: 'A', count: 1 }]))
    expect(result?.[0].history).toBeUndefined()
  })

  it('conserve archived optionnel', () => {
    const result = parseBackupJson(JSON.stringify([{ name: 'A', count: 1, archived: true }]))
    expect(result?.[0].archived).toBe(true)
  })

  it('laisse archived indéfini si absent', () => {
    const result = parseBackupJson(JSON.stringify([{ name: 'A', count: 1 }]))
    expect(result?.[0].archived).toBeUndefined()
  })
})

describe('encodeCountersToParam / decodeCountersFromParam', () => {
  it("n'inclut pas l'historique dans le lien/QR (garde le format compact)", () => {
    const counters = [makeCounter({ history: [{ t: 1000, v: 0 }, { t: 2000, v: 1 }] })]
    const encoded = encodeCountersToParam(counters)
    const decoded = decodeCountersFromParam(encoded)
    expect(decoded?.[0].history).toBeUndefined()
  })

  it('fait un aller-retour fidèle avec un tableau vide', () => {
    const encoded = encodeCountersToParam([])
    expect(decodeCountersFromParam(encoded)).toEqual([])
  })

  it('fait un aller-retour fidèle avec tous les champs renseignés', () => {
    const counters = [
      makeCounter({
        name: 'Complet',
        count: 42,
        oddsDenominator: 4096,
        startDate: '2026-08-01',
        backgroundImageUrl: 'https://exemple.com/fond.jpg',
        step: 5,
        displayStyle: 'segment7',
        target: 100,
        archived: true,
      }),
    ]
    const encoded = encodeCountersToParam(counters)
    const decoded = decodeCountersFromParam(encoded)
    expect(decoded).toHaveLength(1)
    expect(decoded?.[0]).toMatchObject({
      name: 'Complet',
      count: 42,
      color: counters[0].color,
      createdAt: counters[0].createdAt,
      oddsDenominator: 4096,
      startDate: '2026-08-01',
      backgroundImageUrl: 'https://exemple.com/fond.jpg',
      step: 5,
      displayStyle: 'segment7',
      target: 100,
      archived: true,
    })
  })

  it('omet les champs optionnels absents lors de l\'aller-retour', () => {
    const counters = [
      makeCounter({
        oddsDenominator: undefined,
        startDate: undefined,
        backgroundImageUrl: undefined,
        step: undefined,
        displayStyle: undefined,
        target: undefined,
        archived: undefined,
      }),
    ]
    const encoded = encodeCountersToParam(counters)
    const decoded = decodeCountersFromParam(encoded)
    expect(decoded?.[0].oddsDenominator).toBeUndefined()
    expect(decoded?.[0].startDate).toBeUndefined()
    expect(decoded?.[0].backgroundImageUrl).toBeUndefined()
    expect(decoded?.[0].step).toBeUndefined()
    expect(decoded?.[0].displayStyle).toBeUndefined()
    expect(decoded?.[0].target).toBeUndefined()
    expect(decoded?.[0].archived).toBeUndefined()
  })

  it('omet archived=false du lien compact (comme les autres champs falsy)', () => {
    const counters = [makeCounter({ archived: false })]
    const encoded = encodeCountersToParam(counters)
    const decoded = decodeCountersFromParam(encoded)
    expect(decoded?.[0].archived).toBeUndefined()
  })

  it('applique count=0 si le champ "c" décodé n\'est pas un nombre (payload corrompu)', () => {
    // Contrairement à parseBackupJson (qui filtre via isValidCounter), le
    // chemin lien/QR ne valide pas le type de "c" avant de le passer à
    // normalizeCounter : c'est le seul chemin qui exerce réellement le
    // fallback `typeof raw.count === 'number' ? raw.count : 0`.
    const corrupted = btoa(JSON.stringify([{ n: 'Corrompu', c: 'pas-un-nombre', k: '#000', t: 1 }]))
    const decoded = decodeCountersFromParam(corrupted)
    expect(decoded?.[0].count).toBe(0)
  })

  it('préserve les caractères spéciaux (accents, emoji) dans le nom', () => {
    const counters = [makeCounter({ name: 'Écrémé 🎲 été – café' })]
    const encoded = encodeCountersToParam(counters)
    const decoded = decodeCountersFromParam(encoded)
    expect(decoded?.[0].name).toBe('Écrémé 🎲 été – café')
  })

  it('produit une chaîne compatible URL et se décode correctement (sans +, / ni =)', () => {
    // Contenu pseudo-aléatoire à forte entropie : garantit de générer, dans
    // le base64 brut, des caractères +, / et = qui doivent être neutralisés
    // pour un usage direct dans une URL. On vérifie aussi l'aller-retour
    // complet pour s'assurer que ce ne sont pas juste supprimés mais bien
    // substitués puis correctement inversés au décodage.
    let seenPlusOrSlashInRawBase64 = false
    for (let i = 0; i < 30; i++) {
      const name = pseudoRandomString(i + 1, 40)
      const rawBase64 = btoa(unescape(encodeURIComponent(name)))
      if (/[+/]/.test(rawBase64)) seenPlusOrSlashInRawBase64 = true

      const encoded = encodeCountersToParam([makeCounter({ name })])
      expect(encoded).not.toMatch(/[+/=]/)
      expect(decodeCountersFromParam(encoded)?.[0].name).toBe(name)
    }
    // Garantit que le test exerce bien le cas qui nous intéresse (sinon il
    // passerait trivialement même avec un remplacement cassé).
    expect(seenPlusOrSlashInRawBase64).toBe(true)
  })

  it('régénère un id à chaque décodage (les ids ne sont pas transmis)', () => {
    const counters = [makeCounter({ id: 'original' })]
    const encoded = encodeCountersToParam(counters)
    const decoded = decodeCountersFromParam(encoded)
    expect(decoded?.[0].id).not.toBe('original')
  })

  it('retourne null pour une chaîne invalide (base64/JSON corrompu)', () => {
    expect(decodeCountersFromParam('!!!pas-du-base64-valide???')).toBeNull()
  })

  it('retourne null si le contenu décodé n\'est pas un tableau', () => {
    const notAnArray = btoa(JSON.stringify({ n: 'x' }))
    expect(decodeCountersFromParam(notAnArray)).toBeNull()
  })
})

describe('buildShareUrl', () => {
  afterEach(() => {
    window.history.pushState({}, '', '/')
  })

  it('ajoute le paramètre import encodant les compteurs', () => {
    window.history.pushState({}, '', '/app')
    const counters = [makeCounter({ name: 'Partagé' })]
    const url = new URL(buildShareUrl(counters))
    const param = url.searchParams.get('import')
    expect(param).toBe(encodeCountersToParam(counters))
  })

  it('retire le hash existant de l\'URL', () => {
    window.history.pushState({}, '', '/app#ancien-hash')
    const url = new URL(buildShareUrl([makeCounter()]))
    expect(url.hash).toBe('')
  })

  it('conserve le chemin existant de l\'URL', () => {
    window.history.pushState({}, '', '/mon-app/')
    const url = new URL(buildShareUrl([makeCounter()]))
    expect(url.pathname).toBe('/mon-app/')
  })
})
