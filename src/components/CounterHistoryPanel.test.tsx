import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CounterHistoryPanel } from './CounterHistoryPanel'
import { downloadHistoryCsv } from '../sync'
import type { Counter } from '../types'

vi.mock('../sync', () => ({
  downloadHistoryCsv: vi.fn(),
}))

function makeCounter(overrides: Partial<Counter> = {}): Counter {
  return {
    id: 'counter-1',
    name: 'Compteur 1',
    count: 0,
    createdAt: new Date(2026, 7, 1).getTime(),
    behavior: {},
    appearance: { color: '#2563eb' },
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
    fireEvent.click(screen.getByRole('button', { name: 'Personnalisation' }))
    expect(onNavigate).toHaveBeenCalledWith('personnalisation')
  })

  describe('export CSV', () => {
    it("n'affiche pas le bouton d'export sans historique du tout", () => {
      renderPanel({ history: undefined })
      expect(screen.queryByRole('button', { name: /Exporter en CSV/ })).not.toBeInTheDocument()
    })

    it("n'affiche pas le bouton d'export avec un historique vide", () => {
      renderPanel({ history: [] })
      expect(screen.queryByRole('button', { name: /Exporter en CSV/ })).not.toBeInTheDocument()
    })

    it("affiche le bouton d'export dès un seul point d'historique (même sans sparkline)", () => {
      renderPanel({ history: [{ t: 1000, v: 0 }] })
      expect(screen.getByRole('button', { name: /Exporter en CSV/ })).toBeInTheDocument()
    })

    it('déclenche le téléchargement CSV du compteur au clic', () => {
      const { counter } = renderPanel({
        history: [
          { t: 1000, v: 0 },
          { t: 2000, v: 1 },
        ],
      })
      fireEvent.click(screen.getByRole('button', { name: /Exporter en CSV/ }))
      expect(downloadHistoryCsv).toHaveBeenCalledWith(counter)
    })
  })
})
