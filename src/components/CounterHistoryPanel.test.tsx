import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CounterHistoryPanel } from './CounterHistoryPanel'
import type { Counter } from '../types'

function makeCounter(overrides: Partial<Counter> = {}): Counter {
  return {
    id: 'counter-1',
    name: 'Compteur 1',
    count: 0,
    color: '#2563eb',
    createdAt: new Date(2026, 7, 1).getTime(),
    ...overrides,
  }
}

function renderPanel(
  counterOverrides: Partial<Counter> = {},
  props: Partial<Parameters<typeof CounterHistoryPanel>[0]> = {}
) {
  const counter = makeCounter(counterOverrides)
  const handlers = { onClose: vi.fn(), onNavigate: vi.fn(), ...props }
  const utils = render(<CounterHistoryPanel counter={counter} {...handlers} {...props} />)
  return { counter, ...handlers, ...utils }
}

describe('CounterHistoryPanel', () => {
  it('affiche le nom du compteur dans le titre', () => {
    renderPanel({ name: 'Mon compteur' })
    expect(screen.getByText('Historique « Mon compteur »')).toBeInTheDocument()
  })

  it('ferme au clic sur la croix', () => {
    const { onClose } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("indique l'absence d'historique suffisant sans historique du tout", () => {
    renderPanel({ history: undefined })
    expect(screen.getByText(/Pas encore assez d'historique/)).toBeInTheDocument()
    expect(document.querySelector('.sparkline')).not.toBeInTheDocument()
  })

  it("indique l'absence d'historique suffisant avec un seul point", () => {
    renderPanel({ history: [{ t: 1000, v: 0 }] })
    expect(screen.getByText(/Pas encore assez d'historique/)).toBeInTheDocument()
    expect(document.querySelector('.sparkline')).not.toBeInTheDocument()
  })

  it('affiche le sparkline et les extrêmes avec au moins deux points', () => {
    renderPanel({
      history: [
        { t: 1000, v: 0 },
        { t: 2000, v: 5 },
        { t: 3000, v: 2 },
      ],
    })
    expect(document.querySelector('.sparkline')).toBeInTheDocument()
    expect(screen.getByText('Min : 0 · Max : 5')).toBeInTheDocument()
  })

  it('navigue vers un autre panneau au clic sur un lien dédié', () => {
    const { onNavigate } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: '→ Personnalisation' }))
    expect(onNavigate).toHaveBeenCalledWith('personnalisation')
  })
})
