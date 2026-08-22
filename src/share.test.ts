import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildShareText } from './share'
import { formatOdds, cumulativeOdds } from './odds'
import { formatStartDate, toIsoDate } from './date'
import type { Counter } from './types'

function makeCounter(overrides: Partial<Counter> = {}): Counter {
  return {
    id: 'id-1',
    name: 'Compteur test',
    count: 5,
    color: '#2563eb',
    createdAt: new Date(2026, 7, 1).getTime(),
    ...overrides,
  }
}

describe('buildShareText', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 22))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('inclut le nom et la valeur du compteur', () => {
    const text = buildShareText(makeCounter({ name: 'Mon compteur', count: 12 }))
    expect(text).toContain('Mon compteur : 12')
  })

  it("n'inclut pas de ligne de probabilité quand oddsDenominator est absent", () => {
    const text = buildShareText(makeCounter({ oddsDenominator: undefined }))
    expect(text).not.toContain('chance sur')
  })

  it('inclut la probabilité formatée quand oddsDenominator est défini', () => {
    const counter = makeCounter({ count: 500, oddsDenominator: 4096 })
    const text = buildShareText(counter)
    const odds = cumulativeOdds(4096, 500)
    expect(text).toContain(`1 chance sur ${(4096).toLocaleString('fr-FR')}`)
    expect(text).toContain(formatOdds(odds))
  })

  it("utilise startDate quand fourni plutôt que createdAt", () => {
    const counter = makeCounter({ startDate: '2026-08-15', createdAt: new Date(2020, 0, 1).getTime() })
    const text = buildShareText(counter)
    expect(text).toContain(formatStartDate('2026-08-15'))
  })

  it("retombe sur createdAt quand startDate est absent", () => {
    const createdAt = new Date(2026, 7, 10).getTime()
    const counter = makeCounter({ startDate: undefined, createdAt })
    const text = buildShareText(counter)
    expect(text).toContain(formatStartDate(toIsoDate(createdAt)))
  })

  it('place chaque information sur sa propre ligne', () => {
    const counter = makeCounter({ count: 3, oddsDenominator: 10, startDate: '2026-08-01' })
    const text = buildShareText(counter)
    const lines = text.split('\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain(': 3')
    expect(lines[1]).toContain('chance sur')
    expect(lines[2]).toContain('·')
  })
})
