import { describe, expect, it } from 'vitest'
import { sanitizeCounterName } from './counterName'

describe('sanitizeCounterName', () => {
  it('renvoie le nom tel quel une fois débarrassé des espaces en trop', () => {
    expect(sanitizeCounterName('  Pompes  ')).toBe('Pompes')
  })

  it("retombe sur 'Sans nom' si la saisie est vide", () => {
    expect(sanitizeCounterName('')).toBe('Sans nom')
  })

  it("retombe sur 'Sans nom' si la saisie ne contient que des espaces", () => {
    expect(sanitizeCounterName('   ')).toBe('Sans nom')
  })
})
