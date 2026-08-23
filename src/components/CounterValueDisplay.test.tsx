import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { CounterValueDisplay } from './CounterValueDisplay'

describe('CounterValueDisplay', () => {
  it("affiche l'odomètre par défaut quand aucun style n'est précisé", () => {
    render(<CounterValueDisplay value={42} direction={1} progress={null} />)
    expect(document.querySelector('.odometer')).toBeInTheDocument()
  })

  it("affiche l'odomètre pour le style 'default'", () => {
    render(<CounterValueDisplay value={42} direction={1} style="default" progress={null} />)
    expect(document.querySelector('.odometer')).toBeInTheDocument()
  })

  describe('style volets', () => {
    it('affiche un volet par chiffre', () => {
      render(<CounterValueDisplay value={247} direction={1} style="flap" progress={null} />)
      const tiles = document.querySelectorAll('.value-flap-tile')
      expect(tiles).toHaveLength(3)
      expect(tiles[0]).toHaveTextContent('2')
      expect(tiles[1]).toHaveTextContent('4')
      expect(tiles[2]).toHaveTextContent('7')
    })

    it('affiche un volet dédié pour le signe moins', () => {
      render(<CounterValueDisplay value={-5} direction={-1} style="flap" progress={null} />)
      const tiles = document.querySelectorAll('.value-flap-tile')
      expect(tiles).toHaveLength(2)
      expect(tiles[0]).toHaveTextContent('-')
    })
  })

  describe('style 7 segments', () => {
    it('allume les bons segments pour chaque chiffre (0-9)', () => {
      render(<CounterValueDisplay value={1234567890} direction={1} style="segment7" progress={null} />)
      const digits = document.querySelectorAll('.value-segment-digit')
      expect(digits).toHaveLength(10)
      // '0' est le dernier caractère : segments a-f allumés, g éteint.
      const zero = digits[9]
      expect(zero.querySelector('.value-segment--a')?.className).toContain('is-on')
      expect(zero.querySelector('.value-segment--g')?.className).not.toContain('is-on')
    })

    it('allume uniquement le segment central pour le signe moins', () => {
      render(<CounterValueDisplay value={-1} direction={-1} style="segment7" progress={null} />)
      const digits = document.querySelectorAll('.value-segment-digit')
      const minus = digits[0]
      expect(minus.querySelector('.value-segment--g')?.className).toContain('is-on')
      expect(minus.querySelector('.value-segment--a')?.className).not.toContain('is-on')
    })

    it("n'échoue pas sur un caractère hors table (notation exponentielle d'une très grande valeur)", () => {
      // (1e21).toString() === '1e+21' : les caractères 'e' et '+' n'ont pas
      // d'entrée dans la table des segments.
      render(<CounterValueDisplay value={1e21} direction={1} style="segment7" progress={null} />)
      const digits = document.querySelectorAll('.value-segment-digit')
      expect(digits).toHaveLength(5)
      const eDigit = digits[1]
      expect(eDigit.querySelectorAll('.is-on')).toHaveLength(0)
    })
  })

  describe('style anneau', () => {
    it("n'affiche pas d'arc ni de pourcentage sans progression", () => {
      render(<CounterValueDisplay value={8} direction={1} style="ring" progress={null} />)
      expect(document.querySelector('.value-ring-fill')).not.toBeInTheDocument()
      expect(document.querySelector('.value-ring-pct')).not.toBeInTheDocument()
      expect(screen.getByText('8')).toBeInTheDocument()
    })

    it('affiche un arc et le pourcentage arrondi quand une progression est fournie', () => {
      render(<CounterValueDisplay value={8} direction={1} style="ring" progress={0.62} />)
      expect(document.querySelector('.value-ring-fill')).toBeInTheDocument()
      expect(screen.getByText('62 %')).toBeInTheDocument()
    })
  })

  it('style éditorial : affiche le nombre et une règle discrète', () => {
    render(<CounterValueDisplay value={8} direction={1} style="editorial" progress={null} />)
    expect(document.querySelector('.value-editorial-number')).toHaveTextContent('8')
    expect(document.querySelector('.value-editorial-rule')).toBeInTheDocument()
  })

  it('style pastille : affiche le nombre dans une pastille', () => {
    render(<CounterValueDisplay value={8} direction={1} style="badge" progress={null} />)
    expect(document.querySelector('.value-badge-pill')).toHaveTextContent('8')
  })
})
