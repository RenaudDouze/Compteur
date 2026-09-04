import { describe, expect, it } from 'vitest'
import { computeArchiveStats } from './archiveStats'
import type { Counter } from './types'

function makeCounter(overrides: Partial<Counter> = {}): Counter {
  return {
    id: 'c1',
    name: 'Compteur',
    count: 0,
    createdAt: new Date(2026, 0, 1).getTime(),
    behavior: {},
    appearance: { color: '#2563eb' },
    ...overrides,
  }
}

describe('computeArchiveStats', () => {
  it("retourne des statistiques vides sans compteur archivé", () => {
    expect(computeArchiveStats([])).toEqual({ count: 0, totalValue: 0, averagePerDay: null })
  })

  it('ignore les compteurs actifs (non archivés)', () => {
    const stats = computeArchiveStats([makeCounter({ count: 10 })])
    expect(stats).toEqual({ count: 0, totalValue: 0, averagePerDay: null })
  })

  it("cumule le total sur tous les compteurs archivés, même sans date d'archivage connue", () => {
    const stats = computeArchiveStats([
      makeCounter({ id: 'a', count: 5, archived: true }),
      makeCounter({ id: 'b', count: 7, archived: true }),
    ])
    expect(stats.count).toBe(2)
    expect(stats.totalValue).toBe(12)
    // Aucun `archivedAt` connu : pas de moyenne devinée.
    expect(stats.averagePerDay).toBeNull()
  })

  it("calcule la moyenne par jour cumulée sur les seuls compteurs dont la durée est connue", () => {
    const stats = computeArchiveStats([
      makeCounter({
        id: 'a',
        count: 10,
        archived: true,
        createdAt: new Date(2026, 0, 1).getTime(),
        archivedAt: new Date(2026, 0, 11).getTime(), // 10 jours, 1/jour
      }),
      // Sans archivedAt : compte dans le total mais pas dans la moyenne.
      makeCounter({ id: 'b', count: 100, archived: true }),
    ])
    expect(stats.totalValue).toBe(110)
    expect(stats.averagePerDay).toBe('1 / jour')
  })

  it('utilise startDate plutôt que createdAt quand défini', () => {
    const stats = computeArchiveStats([
      makeCounter({
        count: 4,
        archived: true,
        createdAt: new Date(2026, 0, 1).getTime(),
        behavior: { startDate: '2026-01-09' },
        archivedAt: new Date(2026, 0, 11).getTime(), // 2 jours depuis startDate
      }),
    ])
    expect(stats.averagePerDay).toBe('2 / jour')
  })

  it('compte un archivage le jour même pour au moins 1 jour (pas de division par zéro)', () => {
    const sameDay = new Date(2026, 0, 5).getTime()
    const stats = computeArchiveStats([
      makeCounter({ count: 3, archived: true, createdAt: sameDay, archivedAt: sameDay }),
    ])
    expect(stats.averagePerDay).toBe('3 / jour')
  })

  it('cumule correctement plusieurs compteurs archivés avec des durées différentes', () => {
    const stats = computeArchiveStats([
      makeCounter({
        id: 'a',
        count: 20,
        archived: true,
        createdAt: new Date(2026, 0, 1).getTime(),
        archivedAt: new Date(2026, 0, 11).getTime(), // 10 jours
      }),
      makeCounter({
        id: 'b',
        count: 30,
        archived: true,
        createdAt: new Date(2026, 0, 1).getTime(),
        archivedAt: new Date(2026, 0, 21).getTime(), // 20 jours
      }),
    ])
    // (20 + 30) / (10 + 20) = 50 / 30 ≈ 1,7 / jour
    expect(stats.totalValue).toBe(50)
    expect(stats.averagePerDay).toBe('1,7 / jour')
  })
})
