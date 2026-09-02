import { afterEach, describe, expect, it, vi } from 'vitest'
import { generateSyncCode, isValidSyncCode, normalizeSyncCode } from './code'

describe('generateSyncCode', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('génère un code de 8 caractères', () => {
    expect(generateSyncCode()).toHaveLength(8)
  })

  it("n'utilise que des caractères sans ambiguïté visuelle", () => {
    const code = generateSyncCode()
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTWXYZ23456789]{8}$/)
  })

  it('ne produit jamais deux fois exactement le même code sur un grand échantillon', () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateSyncCode()))
    expect(codes.size).toBe(500)
  })

  it('rejette les octets hors de la plage uniforme plutôt que de les réduire avec un modulo biaisé', () => {
    // 232 = plus grand multiple de 29 (taille de l'alphabet) sous 256 : tout
    // octet >= 232 doit être rejeté et retiré, jamais transformé en
    // caractère via `% 29` (ce qui biaiserait légèrement l'alphabet).
    const bytes = [232, 255, 0, 1, 2, 3, 4, 5, 6, 7]
    let i = 0
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(((array: Uint8Array) => {
      array[0] = bytes[i++]
      return array
    }) as typeof crypto.getRandomValues)

    const code = generateSyncCode()

    expect(code).toBe('ABCDEFGH')
    expect(i).toBe(bytes.length)
  })
})

describe('normalizeSyncCode', () => {
  it('met en majuscules', () => {
    expect(normalizeSyncCode('abcdefgh')).toBe('ABCDEFGH')
  })

  it('retire les tirets', () => {
    expect(normalizeSyncCode('ABCD-EFGH')).toBe('ABCDEFGH')
  })

  it('retire les espaces', () => {
    expect(normalizeSyncCode('  ABCD EFGH  ')).toBe('ABCDEFGH')
  })

  it('gère plusieurs tirets/espaces consécutifs', () => {
    expect(normalizeSyncCode('ABCD--  EFGH')).toBe('ABCDEFGH')
  })
})

describe('isValidSyncCode', () => {
  it('accepte un code généré', () => {
    expect(isValidSyncCode(generateSyncCode())).toBe(true)
  })

  it('refuse un code trop court', () => {
    expect(isValidSyncCode('ABCDEFG')).toBe(false)
  })

  it('refuse un code trop long', () => {
    expect(isValidSyncCode('ABCDEFGHJ')).toBe(false)
  })

  it('refuse un caractère ambigu exclu de l\'alphabet (ex: O)', () => {
    expect(isValidSyncCode('ABCDEFGO')).toBe(false)
  })

  it('refuse des minuscules non normalisées', () => {
    expect(isValidSyncCode('abcdefgh')).toBe(false)
  })

  it('refuse une chaîne vide', () => {
    expect(isValidSyncCode('')).toBe(false)
  })
})
