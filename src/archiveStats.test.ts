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
    expect(computeArchiveStats([])).toEqual({
      count: 0,
      totalValue: 0,
      averagePerDay: null,
      averageDurationDays: null,
    })
  })

  it('ignore les compteurs actifs (non archivés)', () => {
    const stats = computeArchiveStats([makeCounter({ count: 10 })])
    expect(stats).toEqual({ count: 0, totalValue: 0, averagePerDay: null, averageDurationDays: null })
  })

  it("cumule le total sur tous les compteurs archivés, même sans date d'archivage connue", () => {
    const stats = computeArchiveStats([
      makeCounter({ id: 'a', count: 5, archived: true }),
      makeCounter({ id: 'b', count: 7, archived: true }),
    ])
    expect(stats.count).toBe(2)
    expect(stats.totalValue).toBe(12)
    // Aucun `archivedAt` connu : pas de moyenne ni de durée devinées.
    expect(stats.averagePerDay).toBeNull()
    expect(stats.averageDurationDays).toBeNull()
  })

  it("calcule la moyenne par jour et la durée moyenne sur les seuls compteurs dont la durée est connue", () => {
    const stats = computeArchiveStats([
      makeCounter({
        id: 'a',
        count: 10,
        archived: true,
        createdAt: new Date(2026, 0, 1).getTime(),
        archivedAt: new Date(2026, 0, 11).getTime(), // 10 jours, 1/jour
      }),
      // Sans archivedAt : compte dans le total mais pas dans les moyennes.
      makeCounter({ id: 'b', count: 100, archived: true }),
    ])
    expect(stats.totalValue).toBe(110)
    expect(stats.averagePerDay).toBe('1 / jour')
    expect(stats.averageDurationDays).toBe('10 jours')
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
    expect(stats.averageDurationDays).toBe('2 jours')
  })

  it('compte un archivage le jour même pour au moins 1 jour (pas de division par zéro), au singulier', () => {
    const sameDay = new Date(2026, 0, 5).getTime()
    const stats = computeArchiveStats([
      makeCounter({ count: 3, archived: true, createdAt: sameDay, archivedAt: sameDay }),
    ])
    expect(stats.averagePerDay).toBe('3 / jour')
    expect(stats.averageDurationDays).toBe('1 jour')
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
    // (20 + 30) / (10 + 20) = 50 / 30 ≈ 1,7 / jour ; (10 + 20) / 2 = 15 jours
    expect(stats.totalValue).toBe(50)
    expect(stats.averagePerDay).toBe('1,7 / jour')
    expect(stats.averageDurationDays).toBe('15 jours')
  })

  it("arrondit la durée moyenne à une décimale (division non exacte) et l'affiche au pluriel", () => {
    const stats = computeArchiveStats([
      makeCounter({
        id: 'a',
        count: 1,
        archived: true,
        createdAt: new Date(2026, 0, 1).getTime(),
        archivedAt: new Date(2026, 0, 2).getTime(), // 1 jour
      }),
      makeCounter({
        id: 'b',
        count: 1,
        archived: true,
        createdAt: new Date(2026, 0, 1).getTime(),
        archivedAt: new Date(2026, 0, 2).getTime(), // 1 jour
      }),
      makeCounter({
        id: 'c',
        count: 1,
        archived: true,
        createdAt: new Date(2026, 0, 1).getTime(),
        archivedAt: new Date(2026, 0, 9).getTime(), // 8 jours
      }),
    ])
    // (1 + 1 + 8) / 3 = 3,333... -> arrondi à une décimale : 3,3 jours (et
    // non "3,333 jours", que produirait un arrondi par défaut sans limiter
    // explicitement le nombre de décimales).
    expect(stats.averageDurationDays).toBe('3,3 jours')
  })
})
