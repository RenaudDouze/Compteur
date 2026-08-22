import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { daysSince, formatStartDate, toIsoDate, todayIsoDate } from './date'

const dateFormatter = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
const compactDateFormatter = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit' })

describe('toIsoDate', () => {
  it('formate une date avec mois et jour à deux chiffres', () => {
    const d = new Date(2026, 0, 5) // 5 janvier 2026
    expect(toIsoDate(d.getTime())).toBe('2026-01-05')
  })

  it('formate une date avec mois et jour déjà à deux chiffres', () => {
    const d = new Date(2026, 11, 25) // 25 décembre 2026
    expect(toIsoDate(d.getTime())).toBe('2026-12-25')
  })
})

describe('todayIsoDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("retourne la date du jour au format ISO", () => {
    vi.setSystemTime(new Date(2026, 7, 22, 15, 44))
    expect(todayIsoDate()).toBe('2026-08-22')
  })
})

describe('daysSince', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 22, 15, 44)) // 22 août 2026, 15h44
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('retourne 0 pour aujourd\'hui', () => {
    expect(daysSince('2026-08-22')).toBe(0)
  })

  it("ignore l'heure du jour pour le calcul (0 quel que soit le moment de la journée)", () => {
    vi.setSystemTime(new Date(2026, 7, 22, 0, 1))
    expect(daysSince('2026-08-22')).toBe(0)
    vi.setSystemTime(new Date(2026, 7, 22, 23, 59))
    expect(daysSince('2026-08-22')).toBe(0)
  })

  it('retourne 1 pour hier', () => {
    expect(daysSince('2026-08-21')).toBe(1)
  })

  it('retourne le bon nombre de jours pour une date plus ancienne', () => {
    expect(daysSince('2026-08-01')).toBe(21)
  })

  it('ramène à 0 une date dans le futur', () => {
    expect(daysSince('2026-08-23')).toBe(0)
  })
})

describe('formatStartDate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 7, 22, 12, 0))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('utilise bien la locale française (mois abrégé "août", pas "Aug")', () => {
    expect(formatStartDate('2026-08-22')).toContain('août')
  })

  it('utilise le format jour/mois en locale française pour le mode compact', () => {
    // fr-FR ordonne jour puis mois (22/08) ; d'autres locales inverseraient.
    expect(formatStartDate('2026-08-22', true)).toContain('22/08')
  })

  it("mode complet (par défaut) : aujourd'hui", () => {
    const label = dateFormatter.format(new Date('2026-08-22T00:00:00'))
    expect(formatStartDate('2026-08-22')).toBe(`${label} · aujourd'hui`)
  })

  it('mode complet explicite (compact=false) : au singulier pour 1 jour', () => {
    const label = dateFormatter.format(new Date('2026-08-21T00:00:00'))
    expect(formatStartDate('2026-08-21', false)).toBe(`${label} · 1 jour`)
  })

  it('mode complet : au pluriel pour plusieurs jours', () => {
    const label = dateFormatter.format(new Date('2026-08-01T00:00:00'))
    expect(formatStartDate('2026-08-01', false)).toBe(`${label} · 21 jours`)
  })

  it('mode complet : au pluriel pour 2 jours (limite singulier/pluriel)', () => {
    const label = dateFormatter.format(new Date('2026-08-20T00:00:00'))
    expect(formatStartDate('2026-08-20', false)).toBe(`${label} · 2 jours`)
  })

  it('mode compact : "auj." pour aujourd\'hui', () => {
    const label = compactDateFormatter.format(new Date('2026-08-22T00:00:00'))
    expect(formatStartDate('2026-08-22', true)).toBe(`${label} · auj.`)
  })

  it('mode compact : "N j" pour les jours passés (y compris 1 jour)', () => {
    const label = compactDateFormatter.format(new Date('2026-08-21T00:00:00'))
    expect(formatStartDate('2026-08-21', true)).toBe(`${label} · 1 j`)
  })

  it('mode compact : "N j" pour plusieurs jours', () => {
    const label = compactDateFormatter.format(new Date('2026-08-01T00:00:00'))
    expect(formatStartDate('2026-08-01', true)).toBe(`${label} · 21 j`)
  })
})
