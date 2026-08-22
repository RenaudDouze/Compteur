import { describe, expect, it } from 'vitest'
import { cumulativeOdds, formatOdds } from './odds'

function expectedPct(pct: number, decimals: number): string {
  return `${pct.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} %`
}

describe('cumulativeOdds', () => {
  it('retourne 0 si le dénominateur est 0', () => {
    expect(cumulativeOdds(0, 100)).toBe(0)
  })

  it('retourne 0 si le dénominateur est négatif', () => {
    expect(cumulativeOdds(-4096, 100)).toBe(0)
  })

  it('retourne 0 si le dénominateur est NaN', () => {
    expect(cumulativeOdds(NaN, 100)).toBe(0)
  })

  it('retourne 0 si le nombre d\'essais est 0', () => {
    expect(cumulativeOdds(4096, 0)).toBe(0)
  })

  it('traite un nombre d\'essais négatif comme 0', () => {
    expect(cumulativeOdds(4096, -10)).toBe(0)
  })

  it('calcule correctement pour un essai unique', () => {
    // 1 - (1 - 1/2)^1 = 0.5
    expect(cumulativeOdds(2, 1)).toBeCloseTo(0.5, 10)
  })

  it('calcule correctement pour plusieurs essais', () => {
    // 1 - (1 - 1/4096)^500
    const expected = 1 - Math.pow(1 - 1 / 4096, 500)
    expect(cumulativeOdds(4096, 500)).toBeCloseTo(expected, 12)
  })

  it('tend vers 1 quand le nombre d\'essais est très grand', () => {
    expect(cumulativeOdds(10, 1000)).toBeGreaterThan(0.999)
  })
})

describe('formatOdds', () => {
  it('affiche "0 %" pour un ratio nul', () => {
    expect(formatOdds(0)).toBe('0 %')
  })

  it('affiche "0 %" pour un ratio négatif', () => {
    expect(formatOdds(-0.5)).toBe('0 %')
  })

  it('affiche "> 99,99 %" au-delà du seuil de 99.995%', () => {
    expect(formatOdds(1)).toBe('> 99,99 %')
  })

  it('affiche "> 99,99 %" exactement au seuil de 99.995%', () => {
    expect(formatOdds(0.99995)).toBe('> 99,99 %')
  })

  it('utilise 4 décimales sous 0,1 %', () => {
    expect(formatOdds(0.0005)).toBe(expectedPct(0.05, 4))
  })

  it('reste à 4 décimales juste sous le seuil de 0,1 %', () => {
    expect(formatOdds(0.00099)).toBe(expectedPct(0.099, 4))
  })

  it('utilise 3 décimales exactement à 0,1 %', () => {
    expect(formatOdds(0.001)).toBe(expectedPct(0.1, 3))
  })

  it('utilise 3 décimales sous 1 %', () => {
    expect(formatOdds(0.005)).toBe(expectedPct(0.5, 3))
  })

  it('reste à 3 décimales juste sous le seuil de 1 %', () => {
    expect(formatOdds(0.0099)).toBe(expectedPct(0.99, 3))
  })

  it('utilise 2 décimales exactement à 1 %', () => {
    expect(formatOdds(0.01)).toBe(expectedPct(1, 2))
  })

  it('utilise 2 décimales sous 10 %', () => {
    expect(formatOdds(0.05)).toBe(expectedPct(5, 2))
  })

  it('reste à 2 décimales juste sous le seuil de 10 %', () => {
    expect(formatOdds(0.099)).toBe(expectedPct(9.9, 2))
  })

  it('utilise 1 décimale exactement à 10 %', () => {
    expect(formatOdds(0.1)).toBe(expectedPct(10, 1))
  })

  it('utilise 1 décimale pour les valeurs élevées', () => {
    expect(formatOdds(0.5)).toBe(expectedPct(50, 1))
  })

  it('utilise 1 décimale juste sous le seuil de 99,995 %', () => {
    expect(formatOdds(0.999)).toBe(expectedPct(99.9, 1))
  })
})
