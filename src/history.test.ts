import { describe, expect, it } from 'vitest'
import { appendHistoryPoint } from './history'

describe('appendHistoryPoint', () => {
  it('crée un premier point quand il n\'y a pas encore d\'historique', () => {
    const result = appendHistoryPoint(undefined, 0, 1000)
    expect(result).toEqual([{ t: 1000, v: 0 }])
  })

  it("ajoute un nouveau point quand l'écart dépasse le seuil de regroupement", () => {
    const result = appendHistoryPoint([{ t: 1000, v: 0 }], 1, 1000 + 2001)
    expect(result).toEqual([
      { t: 1000, v: 0 },
      { t: 3001, v: 1 },
    ])
  })

  it("ajoute un nouveau point quand l'écart est exactement égal au seuil", () => {
    const result = appendHistoryPoint([{ t: 1000, v: 0 }], 1, 1000 + 2000)
    expect(result).toEqual([
      { t: 1000, v: 0 },
      { t: 3000, v: 1 },
    ])
  })

  it('fusionne avec le dernier point quand les changements sont rapprochés (rafale)', () => {
    const result = appendHistoryPoint([{ t: 1000, v: 0 }], 1, 1000 + 100)
    expect(result).toEqual([{ t: 1100, v: 1 }])
  })

  it('continue de fusionner sur plusieurs changements rapprochés successifs', () => {
    let history = appendHistoryPoint(undefined, 0, 0)
    history = appendHistoryPoint(history, 1, 100)
    history = appendHistoryPoint(history, 2, 200)
    history = appendHistoryPoint(history, 3, 300)
    expect(history).toEqual([{ t: 300, v: 3 }])
  })

  it('utilise Date.now() par défaut quand aucun horodatage explicite n\'est fourni', () => {
    const before = Date.now()
    const result = appendHistoryPoint(undefined, 5)
    expect(result[0].t).toBeGreaterThanOrEqual(before)
  })

  it('cape le nombre de points conservés en retirant les plus anciens', () => {
    let history: ReturnType<typeof appendHistoryPoint> | undefined = undefined
    // Chaque point est assez espacé pour ne jamais fusionner.
    for (let i = 0; i < 201; i++) {
      history = appendHistoryPoint(history, i, i * 10_000)
    }
    expect(history).toHaveLength(200)
    expect(history![0]).toEqual({ t: 10_000, v: 1 })
    expect(history![199]).toEqual({ t: 2_000_000, v: 200 })
  })

  it('ne retire rien tant que le nombre de points n\'excède pas le plafond', () => {
    let history: ReturnType<typeof appendHistoryPoint> | undefined = undefined
    for (let i = 0; i < 200; i++) {
      history = appendHistoryPoint(history, i, i * 10_000)
    }
    expect(history).toHaveLength(200)
    expect(history![0]).toEqual({ t: 0, v: 0 })
  })
})
