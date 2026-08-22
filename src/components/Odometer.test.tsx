import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Odometer } from './Odometer'

describe('Odometer', () => {
  it('affiche chaque chiffre d\'un nombre positif', () => {
    render(<Odometer value={123} direction={1} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('affiche 0', () => {
    render(<Odometer value={0} direction={1} />)
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('affiche le signe négatif pour un nombre négatif', () => {
    render(<Odometer value={-5} direction={-1} />)
    const container = screen.getByText('5').closest('.odometer')
    expect(container?.textContent).toBe('-5')
  })

  it('affiche un seul caractère par position (pas de doublon lors du rendu initial)', () => {
    render(<Odometer value={42} direction={1} />)
    const digits = document.querySelectorAll('.odometer-digit')
    expect(digits).toHaveLength(2)
  })

  it('accepte direction=-1 sans erreur', () => {
    render(<Odometer value={87} direction={-1} />)
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })
})
