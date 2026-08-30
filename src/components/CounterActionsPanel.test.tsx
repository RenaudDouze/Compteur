import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CounterActionsPanel } from './CounterActionsPanel'
import type { Counter } from '../types'

const realNavigator = window.navigator

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
  props: Partial<Parameters<typeof CounterActionsPanel>[0]> = {}
) {
  const counter = makeCounter(counterOverrides)
  const handlers = {
    onClose: vi.fn(),
    onDuplicate: vi.fn(),
    onToggleArchive: vi.fn(),
    onTogglePin: vi.fn(),
    onDelete: vi.fn(),
    onNavigate: vi.fn(),
    ...props,
  }
  const utils = render(<CounterActionsPanel counter={counter} {...handlers} {...props} />)
  return { counter, ...handlers, ...utils }
}

describe('CounterActionsPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('affiche le nom du compteur dans le titre', () => {
    renderPanel({ name: 'Mon compteur' })
    expect(screen.getByText('Actions « Mon compteur »')).toBeInTheDocument()
  })

  it('ferme au clic sur la croix', () => {
    const { onClose } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('navigue vers un autre panneau au clic sur un lien dédié', () => {
    const { onNavigate } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Valeur & réglages' }))
    expect(onNavigate).toHaveBeenCalledWith('comportement')
  })

  describe('partage', () => {
    afterEach(() => {
      vi.stubGlobal('navigator', realNavigator)
    })

    it('utilise navigator.share quand disponible', async () => {
      const shareMock = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...navigator, share: shareMock, clipboard: { writeText: vi.fn() } })
      renderPanel({ name: 'Partagé', count: 3 })
      await act(async () => {
        fireEvent.click(screen.getByText('⇪ Partager ce compteur'))
      })
      expect(shareMock).toHaveBeenCalledTimes(1)
      expect(shareMock.mock.calls[0][0].text).toContain('Partagé : 3')
    })

    it('ignore silencieusement une annulation de navigator.share', async () => {
      const shareMock = vi.fn().mockRejectedValue(new Error('annulé'))
      vi.stubGlobal('navigator', { ...navigator, share: shareMock, clipboard: { writeText: vi.fn() } })
      renderPanel()
      await act(async () => {
        fireEvent.click(screen.getByText('⇪ Partager ce compteur'))
      })
      expect(screen.getByText('⇪ Partager ce compteur')).toBeInTheDocument()
    })

    it('copie dans le presse-papiers quand navigator.share est indisponible', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText: writeTextMock } })
      renderPanel({ name: 'Copié', count: 9 })
      await act(async () => {
        fireEvent.click(screen.getByText('⇪ Partager ce compteur'))
      })
      expect(writeTextMock).toHaveBeenCalledTimes(1)
      expect(writeTextMock.mock.calls[0][0]).toContain('Copié : 9')
      expect(screen.getByText('Copié ✓')).toBeInTheDocument()
    })

    it('revient au libellé "Partager" après le délai', async () => {
      vi.stubGlobal('navigator', {
        ...navigator,
        share: undefined,
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      })
      renderPanel()
      await act(async () => {
        fireEvent.click(screen.getByText('⇪ Partager ce compteur'))
      })
      expect(screen.getByText('Copié ✓')).toBeInTheDocument()
      await act(async () => {
        vi.advanceTimersByTime(2100)
      })
      expect(screen.getByText('⇪ Partager ce compteur')).toBeInTheDocument()
    })

    it('ignore silencieusement un échec de copie', async () => {
      vi.stubGlobal('navigator', {
        ...navigator,
        share: undefined,
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error('refusé')) },
      })
      renderPanel()
      await act(async () => {
        fireEvent.click(screen.getByText('⇪ Partager ce compteur'))
      })
      expect(screen.getByText('⇪ Partager ce compteur')).toBeInTheDocument()
    })
  })

  describe('duplication', () => {
    it('déclenche la duplication au clic', () => {
      const { onDuplicate } = renderPanel()
      fireEvent.click(screen.getByText('⧉ Dupliquer ce compteur'))
      expect(onDuplicate).toHaveBeenCalledTimes(1)
    })

    it('ferme le panneau après duplication', () => {
      const { onClose } = renderPanel()
      fireEvent.click(screen.getByText('⧉ Dupliquer ce compteur'))
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('archivage', () => {
    it('propose d\'archiver un compteur actif', () => {
      renderPanel({ archived: false })
      expect(screen.getByText('📦 Archiver ce compteur')).toBeInTheDocument()
      expect(screen.queryByText('📤 Désarchiver ce compteur')).not.toBeInTheDocument()
    })

    it('propose de désarchiver un compteur déjà archivé', () => {
      renderPanel({ archived: true })
      expect(screen.getByText('📤 Désarchiver ce compteur')).toBeInTheDocument()
      expect(screen.queryByText('📦 Archiver ce compteur')).not.toBeInTheDocument()
    })

    it('déclenche le basculement au clic', () => {
      const { onToggleArchive } = renderPanel({ archived: false })
      fireEvent.click(screen.getByText('📦 Archiver ce compteur'))
      expect(onToggleArchive).toHaveBeenCalledTimes(1)
    })

    it('ferme le panneau après le basculement', () => {
      const { onClose } = renderPanel({ archived: false })
      fireEvent.click(screen.getByText('📦 Archiver ce compteur'))
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('épinglage', () => {
    it('propose d\'épingler un compteur non épinglé', () => {
      renderPanel({ pinned: false })
      expect(screen.getByText('📌 Épingler en haut')).toBeInTheDocument()
      expect(screen.queryByText('📌 Détacher ce compteur')).not.toBeInTheDocument()
    })

    it('propose de détacher un compteur déjà épinglé', () => {
      renderPanel({ pinned: true })
      expect(screen.getByText('📌 Détacher ce compteur')).toBeInTheDocument()
      expect(screen.queryByText('📌 Épingler en haut')).not.toBeInTheDocument()
    })

    it('déclenche le basculement au clic', () => {
      const { onTogglePin } = renderPanel({ pinned: false })
      fireEvent.click(screen.getByText('📌 Épingler en haut'))
      expect(onTogglePin).toHaveBeenCalledTimes(1)
    })

    it('ferme le panneau après le basculement', () => {
      const { onClose } = renderPanel({ pinned: false })
      fireEvent.click(screen.getByText('📌 Épingler en haut'))
      expect(onClose).toHaveBeenCalledTimes(1)
    })
  })

  describe('suppression', () => {
    it('affiche la suppression dans une zone de danger séparée', () => {
      renderPanel()
      expect(screen.getByText('Zone de danger')).toBeInTheDocument()
    })

    it('demande une confirmation avant de supprimer', () => {
      const { onDelete } = renderPanel()
      fireEvent.click(screen.getByText('🗑 Supprimer ce compteur'))
      expect(onDelete).not.toHaveBeenCalled()
      expect(screen.getByText('✓ Confirmer la suppression')).toBeInTheDocument()
    })

    it('supprime au second clic de confirmation', () => {
      const { onDelete } = renderPanel()
      fireEvent.click(screen.getByText('🗑 Supprimer ce compteur'))
      fireEvent.click(screen.getByText('✓ Confirmer la suppression'))
      expect(onDelete).toHaveBeenCalledTimes(1)
    })

    it('annule la confirmation après le délai', () => {
      renderPanel()
      fireEvent.click(screen.getByText('🗑 Supprimer ce compteur'))
      expect(screen.getByText('✓ Confirmer la suppression')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(2600)
      })
      expect(screen.getByText('🗑 Supprimer ce compteur')).toBeInTheDocument()
    })
  })
})
