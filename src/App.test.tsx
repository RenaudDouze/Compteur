import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { encodeCountersToParam } from './sync'
import { COLORS } from './colors'
import type { Counter } from './types'

vi.mock('qrcode', () => ({
  default: {
    toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,fake'),
  },
}))

function makeCounter(overrides: Partial<Counter> = {}): Counter {
  return {
    id: 'existing-1',
    name: 'Existant',
    count: 1,
    color: '#2563eb',
    createdAt: Date.now(),
    ...overrides,
  }
}

beforeEach(() => {
  window.localStorage.clear()
  window.history.pushState({}, '', '/')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App', () => {
  it("affiche l'état vide au premier lancement", () => {
    render(<App />)
    expect(screen.getByText("Aucun compteur pour l'instant.")).toBeInTheDocument()
  })

  it('crée un premier compteur depuis l\'état vide', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: 'Créer mon premier compteur' }))
    expect(screen.getByText('Compteur 1')).toBeInTheDocument()
    expect(screen.queryByText("Aucun compteur pour l'instant.")).not.toBeInTheDocument()
  })

  it('ajoute un compteur depuis le bouton d\'en-tête', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
    expect(screen.getByText('Compteur 1')).toBeInTheDocument()
  })

  it('numérote les compteurs successifs', () => {
    render(<App />)
    const addBtn = screen.getByRole('button', { name: '+ Nouveau compteur' })
    fireEvent.click(addBtn)
    fireEvent.click(addBtn)
    expect(screen.getByText('Compteur 1')).toBeInTheDocument()
    expect(screen.getByText('Compteur 2')).toBeInTheDocument()
  })

  it('utilise la classe --solo pour un seul compteur', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
    expect(document.querySelector('.counter-grid--solo')).toBeInTheDocument()
  })

  it('utilise la classe --duo pour deux compteurs', () => {
    render(<App />)
    const addBtn = screen.getByRole('button', { name: '+ Nouveau compteur' })
    fireEvent.click(addBtn)
    fireEvent.click(addBtn)
    expect(document.querySelector('.counter-grid--duo')).toBeInTheDocument()
  })

  it('utilise la classe --pack à partir de trois compteurs', () => {
    render(<App />)
    const addBtn = screen.getByRole('button', { name: '+ Nouveau compteur' })
    fireEvent.click(addBtn)
    fireEvent.click(addBtn)
    fireEvent.click(addBtn)
    expect(document.querySelector('.counter-grid--pack')).toBeInTheDocument()
  })

  it('incrémente un compteur au clic', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
    fireEvent.click(screen.getByText('0'))
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('définit directement la valeur via le crayon', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
    fireEvent.click(screen.getByRole('button', { name: 'Définir la valeur du compteur' }))
    const input = screen.getByDisplayValue('0')
    fireEvent.change(input, { target: { value: '99' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(document.querySelector('.counter-value')?.textContent).toBe('99')
  })

  it('renomme un compteur', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
    fireEvent.click(screen.getByText('Compteur 1'))
    const input = screen.getByDisplayValue('Compteur 1')
    fireEvent.change(input, { target: { value: 'Renommé' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('Renommé')).toBeInTheDocument()
  })

  it('définit une probabilité', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: '→ Comportement' }))
    const input = screen.getByPlaceholderText('4096')
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: '→ Comportement' }))
    expect(screen.getByDisplayValue('10')).toBeInTheDocument()
  })

  it("définit un pas d'incrément personnalisé et l'applique au clic", () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: '→ Comportement' }))
    const input = screen.getByPlaceholderText('1')
    fireEvent.change(input, { target: { value: '5' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: '→ Comportement' }))
    expect(screen.getByDisplayValue('5')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    fireEvent.click(screen.getByRole('button', { name: /Incrémenter Compteur 1/ }))
    expect(document.querySelector('.counter-value')).toHaveTextContent('5')
  })

  it('définit une date de début', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: '→ Comportement' }))
    const input = document.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(input, { target: { value: '2020-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: '→ Comportement' }))
    expect(document.querySelector('input[type="date"]')).toHaveValue('2020-01-01')
  })

  it('définit une image de fond', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser le compteur' }))
    const input = screen.getByPlaceholderText('https://exemple.com/image.jpg')
    fireEvent.change(input, { target: { value: 'https://exemple.com/fond.jpg' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(document.querySelector('.counter-bg')).toBeInTheDocument()
  })

  it('change la couleur du compteur', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: `Choisir la couleur ${COLORS[1]}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser le compteur' }))
    const selected = screen.getByRole('button', { name: `Choisir la couleur ${COLORS[1]}` })
    expect(selected.className).toContain('selected')
  })

  it("définit un style d'affichage pour le compteur", () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: 'Choisir le style Volets' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(document.querySelector('.counter-value--flap')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser le compteur' }))
    expect(screen.getByRole('button', { name: 'Choisir le style Volets' }).className).toContain('selected')
  })

  it('définit un objectif pour le compteur', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: '→ Comportement' }))
    const input = screen.getByPlaceholderText('ex : 50')
    fireEvent.change(input, { target: { value: '20' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: '→ Comportement' }))
    expect(screen.getByDisplayValue('20')).toBeInTheDocument()
  })

  it('duplique un compteur avec sa configuration, mais repart de zéro', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
    fireEvent.click(screen.getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: `Choisir la couleur ${COLORS[1]}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Choisir le style Volets' }))
    fireEvent.click(screen.getByRole('button', { name: '→ Actions' }))
    fireEvent.click(screen.getByRole('button', { name: '⧉ Dupliquer ce compteur' }))

    expect(screen.getByText('Compteur 1')).toBeInTheDocument()
    expect(screen.getByText('Compteur 1 (copie)')).toBeInTheDocument()
    expect(document.querySelectorAll('.counter-value--flap')).toHaveLength(2)
    expect(document.querySelectorAll('.counter-value')[1]).toHaveTextContent('0')
  })

  it('supprime un compteur après confirmation', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
    const deleteBtn = screen.getByRole('button', { name: 'Supprimer le compteur' })
    fireEvent.click(deleteBtn)
    fireEvent.click(deleteBtn)
    expect(screen.getByText("Aucun compteur pour l'instant.")).toBeInTheDocument()
  })

  describe('annulation', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it("propose d'annuler après une suppression et restaure le compteur", () => {
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
      fireEvent.click(screen.getByText('Compteur 1'))
      fireEvent.change(screen.getByDisplayValue('Compteur 1'), { target: { value: 'À restaurer' } })
      fireEvent.keyDown(screen.getByDisplayValue('À restaurer'), { key: 'Enter' })

      const deleteBtn = screen.getByRole('button', { name: 'Supprimer le compteur' })
      fireEvent.click(deleteBtn)
      fireEvent.click(deleteBtn)
      expect(screen.getByText("Aucun compteur pour l'instant.")).toBeInTheDocument()
      expect(screen.getByText('Compteur « À restaurer » supprimé')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
      expect(screen.getByText('À restaurer')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument()
    })

    it("propose d'annuler après une modification directe de la valeur", async () => {
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
      fireEvent.click(screen.getByRole('button', { name: 'Définir la valeur du compteur' }))
      const input = screen.getByDisplayValue('0')
      fireEvent.change(input, { target: { value: '99' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      expect(screen.getByText('Valeur de « Compteur 1 » modifiée')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Annuler' }))
      // Les chiffres qui quittent l'affichage restent brièvement montés le
      // temps de leur animation de sortie (AnimatePresence) : le texte
      // combiné ancien/nouveau ne se stabilise qu'une fois celle-ci terminée.
      await waitFor(() => expect(document.querySelector('.counter-value')).toHaveTextContent('0'))
    })

    it("ne propose pas d'annuler si la valeur éditée est identique", () => {
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
      fireEvent.click(screen.getByRole('button', { name: 'Définir la valeur du compteur' }))
      const input = screen.getByDisplayValue('0')
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(screen.queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument()
    })

    it("le message d'annulation disparaît après le délai", () => {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
      const deleteBtn = screen.getByRole('button', { name: 'Supprimer le compteur' })
      fireEvent.click(deleteBtn)
      fireEvent.click(deleteBtn)
      expect(screen.getByRole('button', { name: 'Annuler' })).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(5100)
      })
      expect(screen.queryByRole('button', { name: 'Annuler' })).not.toBeInTheDocument()
    })
  })

  describe('thème', () => {
    afterEach(() => {
      document.documentElement.removeAttribute('data-theme')
    })

    it('démarre en mode automatique et suit la préférence système', () => {
      render(<App />)
      expect(screen.getByRole('button', { name: 'Thème : Auto' })).toBeInTheDocument()
      // matchMedia est mocké sur `matches: false` (clair) dans le setup des tests.
      expect(document.documentElement.dataset.theme).toBe('light')
    })

    it('applique le thème sombre en mode automatique si le système le préfère', () => {
      // vi.spyOn(window, 'matchMedia').mockRestore() ne restaure pas
      // proprement le mock déjà posé par setup.ts : on sauvegarde/remplace
      // la référence à la main pour ne pas casser les tests suivants.
      const original = window.matchMedia
      window.matchMedia = ((query: string) => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as typeof window.matchMedia
      render(<App />)
      expect(document.documentElement.dataset.theme).toBe('dark')
      window.matchMedia = original
    })

    it('permet de forcer le thème clair puis sombre puis de revenir en automatique', () => {
      render(<App />)
      const toggle = screen.getByRole('button', { name: 'Thème : Auto' })

      fireEvent.click(toggle)
      expect(screen.getByRole('button', { name: 'Thème : Clair' })).toBeInTheDocument()
      expect(document.documentElement.dataset.theme).toBe('light')

      fireEvent.click(screen.getByRole('button', { name: 'Thème : Clair' }))
      expect(screen.getByRole('button', { name: 'Thème : Sombre' })).toBeInTheDocument()
      expect(document.documentElement.dataset.theme).toBe('dark')

      fireEvent.click(screen.getByRole('button', { name: 'Thème : Sombre' }))
      expect(screen.getByRole('button', { name: 'Thème : Auto' })).toBeInTheDocument()
    })

    it('retient le thème choisi après rechargement', () => {
      const { unmount } = render(<App />)
      fireEvent.click(screen.getByRole('button', { name: 'Thème : Auto' }))
      expect(screen.getByRole('button', { name: 'Thème : Clair' })).toBeInTheDocument()
      unmount()

      render(<App />)
      expect(screen.getByRole('button', { name: 'Thème : Clair' })).toBeInTheDocument()
    })

    it('adapte la couleur de la barre de statut au thème actif', () => {
      render(<App />)
      const meta = document.querySelector('meta[name="theme-color"]')
      fireEvent.click(screen.getByRole('button', { name: 'Thème : Auto' }))
      fireEvent.click(screen.getByRole('button', { name: 'Thème : Clair' }))
      expect(meta?.getAttribute('content')).toBe('#0f172a')
    })
  })

  it('persiste les compteurs dans le localStorage', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
    const stored = JSON.parse(window.localStorage.getItem('compteur.counters.v1') ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].name).toBe('Compteur 1')
  })

  it('recharge les compteurs déjà stockés', () => {
    window.localStorage.setItem('compteur.counters.v1', JSON.stringify([makeCounter({ name: 'Persisté' })]))
    render(<App />)
    expect(screen.getByText('Persisté')).toBeInTheDocument()
  })

  it("ne modifie que le compteur ciblé quand plusieurs compteurs existent", () => {
    window.localStorage.setItem(
      'compteur.counters.v1',
      JSON.stringify([makeCounter({ id: 'a', name: 'Un', count: 0 }), makeCounter({ id: 'b', name: 'Deux', count: 0 })])
    )
    render(<App />)

    // Incrémente uniquement le premier compteur.
    fireEvent.click(screen.getByRole('button', { name: 'Incrémenter Un' }))
    expect(document.getElementById('a')?.textContent).toContain('1')
    expect(document.getElementById('b')?.textContent).toContain('0')

    // Renomme uniquement le premier.
    fireEvent.click(screen.getByText('Un'))
    fireEvent.change(screen.getByDisplayValue('Un'), { target: { value: 'UnModifié' } })
    fireEvent.keyDown(screen.getByDisplayValue('UnModifié'), { key: 'Enter' })
    expect(screen.getByText('Deux')).toBeInTheDocument()

    // Définit une probabilité uniquement sur le premier (le panneau de
    // personnalisation est affiché via un portail : on le referme après
    // chaque interaction pour ne jamais en avoir deux ouverts à la fois).
    const firstCard = document.getElementById('a') as HTMLElement
    const secondCard = document.getElementById('b') as HTMLElement
    fireEvent.click(within(firstCard).getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: '→ Comportement' }))
    fireEvent.change(screen.getByPlaceholderText('4096'), { target: { value: '5' } })
    fireEvent.keyDown(screen.getByPlaceholderText('4096'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    fireEvent.click(within(secondCard).getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: '→ Comportement' }))
    expect(screen.queryByDisplayValue('5')).not.toBeInTheDocument()

    // Définit une date de début uniquement sur le premier.
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    fireEvent.click(within(firstCard).getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: '→ Comportement' }))
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2020-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    fireEvent.click(within(secondCard).getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: '→ Comportement' }))
    expect(document.querySelector('input[type="date"]')).not.toHaveValue('2020-01-01')
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    // Définit une image de fond uniquement sur le premier.
    fireEvent.click(within(firstCard).getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.change(screen.getByPlaceholderText('https://exemple.com/image.jpg'), {
      target: { value: 'https://exemple.com/fond.jpg' },
    })
    fireEvent.keyDown(screen.getByPlaceholderText('https://exemple.com/image.jpg'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(firstCard.querySelector('.counter-bg')).toBeInTheDocument()
    expect(secondCard.querySelector('.counter-bg')).not.toBeInTheDocument()

    // Change la couleur uniquement sur le premier.
    fireEvent.click(within(firstCard).getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: `Choisir la couleur ${COLORS[1]}` }))
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    fireEvent.click(within(secondCard).getByRole('button', { name: 'Personnaliser le compteur' }))
    const secondSelected = screen.getByRole('button', { name: `Choisir la couleur ${COLORS[0]}` })
    expect(secondSelected.className).toContain('selected')
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    // Définit un pas d'incrément uniquement sur le premier.
    fireEvent.click(within(firstCard).getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: '→ Comportement' }))
    fireEvent.change(screen.getByPlaceholderText('1'), { target: { value: '5' } })
    fireEvent.keyDown(screen.getByPlaceholderText('1'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    fireEvent.click(within(secondCard).getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: '→ Comportement' }))
    expect(screen.queryByDisplayValue('5')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    // Définit un style d'affichage uniquement sur le premier.
    fireEvent.click(within(firstCard).getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: 'Choisir le style Volets' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(firstCard.querySelector('.counter-value--flap')).toBeInTheDocument()
    expect(secondCard.querySelector('.counter-value--flap')).not.toBeInTheDocument()

    // Définit un objectif uniquement sur le premier.
    fireEvent.click(within(firstCard).getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: '→ Comportement' }))
    fireEvent.change(screen.getByPlaceholderText('ex : 50'), { target: { value: '20' } })
    fireEvent.keyDown(screen.getByPlaceholderText('ex : 50'), { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    fireEvent.click(within(secondCard).getByRole('button', { name: 'Personnaliser le compteur' }))
    fireEvent.click(screen.getByRole('button', { name: '→ Comportement' }))
    expect(screen.queryByDisplayValue('20')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))

    // Définit directement la valeur uniquement sur le premier.
    fireEvent.click(within(firstCard).getByRole('button', { name: 'Définir la valeur du compteur' }))
    const countInput = within(firstCard).getByDisplayValue('1')
    fireEvent.change(countInput, { target: { value: '50' } })
    fireEvent.keyDown(countInput, { key: 'Enter' })
    expect(document.getElementById('a')?.textContent).toContain('50')
    expect(document.getElementById('b')?.textContent).toContain('0')
  })

  describe('panneau de synchronisation', () => {
    it("s'ouvre et se ferme", async () => {
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: 'Synchroniser' }))
      expect(screen.getByText('Synchroniser mes compteurs')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
      expect(screen.queryByText('Synchroniser mes compteurs')).not.toBeInTheDocument()
    })

    it('importe des compteurs partagés (remplacement quand la liste est vide)', async () => {
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: 'Synchroniser' }))
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File([JSON.stringify([{ name: 'Depuis fichier', count: 4 }])], 'backup.json', {
        type: 'application/json',
      })
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } })
      })
      expect(screen.getByText('Depuis fichier')).toBeInTheDocument()
    })

    it('fusionne les compteurs importés quand refusé et existants', async () => {
      window.localStorage.setItem('compteur.counters.v1', JSON.stringify([makeCounter({ name: 'Déjà là' })]))
      render(<App />)
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      fireEvent.click(screen.getByRole('button', { name: 'Synchroniser' }))
      const input = document.querySelector('input[type="file"]') as HTMLInputElement
      const file = new File([JSON.stringify([{ name: 'Ajouté', count: 2 }])], 'backup.json', {
        type: 'application/json',
      })
      await act(async () => {
        fireEvent.change(input, { target: { files: [file] } })
      })
      expect(screen.getByText('Déjà là')).toBeInTheDocument()
      expect(screen.getByText('Ajouté')).toBeInTheDocument()
    })
  })

  describe('import automatique via lien de partage', () => {
    it("ne fait rien sans paramètre import dans l'URL", () => {
      render(<App />)
      expect(screen.getByText("Aucun compteur pour l'instant.")).toBeInTheDocument()
    })

    it('retire le paramètre import de l\'URL même si le payload est invalide', () => {
      window.history.pushState({}, '', '/?import=!!!invalide')
      render(<App />)
      expect(window.location.search).toBe('')
      expect(screen.getByText("Aucun compteur pour l'instant.")).toBeInTheDocument()
    })

    it("n'ajoute rien si le lien encode une liste vide", () => {
      const encoded = encodeCountersToParam([])
      window.history.pushState({}, '', `/?import=${encoded}`)
      render(<App />)
      expect(screen.getByText("Aucun compteur pour l'instant.")).toBeInTheDocument()
    })

    it('importe directement quand aucun compteur existant (sans confirmation)', () => {
      const confirmSpy = vi.spyOn(window, 'confirm')
      const encoded = encodeCountersToParam([makeCounter({ name: 'Partagé' })])
      window.history.pushState({}, '', `/?import=${encoded}`)
      render(<App />)
      expect(confirmSpy).not.toHaveBeenCalled()
      expect(screen.getByText('Partagé')).toBeInTheDocument()
      expect(window.location.search).toBe('')
    })

    it('remplace les compteurs existants si confirmé', async () => {
      window.localStorage.setItem('compteur.counters.v1', JSON.stringify([makeCounter({ name: 'Ancien' })]))
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const encoded = encodeCountersToParam([makeCounter({ name: 'Nouveau' })])
      window.history.pushState({}, '', `/?import=${encoded}`)
      render(<App />)
      expect(screen.getByText('Nouveau')).toBeInTheDocument()
      // La carte de l'ancien compteur reste montée le temps de son animation
      // de sortie (AnimatePresence) : on attend qu'elle ait fini de disparaître.
      await waitFor(() => expect(screen.queryByText('Ancien')).not.toBeInTheDocument())
    })

    it('ajoute à la suite des compteurs existants si non confirmé', () => {
      window.localStorage.setItem('compteur.counters.v1', JSON.stringify([makeCounter({ name: 'Ancien' })]))
      vi.spyOn(window, 'confirm').mockReturnValue(false)
      const encoded = encodeCountersToParam([makeCounter({ name: 'Nouveau' })])
      window.history.pushState({}, '', `/?import=${encoded}`)
      render(<App />)
      expect(screen.getByText('Ancien')).toBeInTheDocument()
      expect(screen.getByText('Nouveau')).toBeInTheDocument()
    })
  })

  describe("raccourcis d'app PWA (?action=)", () => {
    it("ne fait rien sans paramètre action dans l'URL", () => {
      render(<App />)
      expect(screen.getByText("Aucun compteur pour l'instant.")).toBeInTheDocument()
    })

    it('?action=new crée un compteur et retire le paramètre de l\'URL', () => {
      window.history.pushState({}, '', '/?action=new')
      render(<App />)
      expect(screen.getByText('Compteur 1')).toBeInTheDocument()
      expect(window.location.search).toBe('')
    })

    it('?action=sync ouvre le panneau de synchronisation et retire le paramètre de l\'URL', () => {
      window.history.pushState({}, '', '/?action=sync')
      render(<App />)
      expect(screen.getByText('Synchroniser mes compteurs')).toBeInTheDocument()
      expect(window.location.search).toBe('')
    })

    it('ignore une valeur inconnue de action et retire quand même le paramètre', () => {
      window.history.pushState({}, '', '/?action=inconnu')
      render(<App />)
      expect(screen.getByText("Aucun compteur pour l'instant.")).toBeInTheDocument()
      expect(window.location.search).toBe('')
    })
  })

  describe('recherche', () => {
    it("n'affiche pas le bouton de recherche sans compteur", () => {
      render(<App />)
      expect(screen.queryByRole('button', { name: 'Rechercher' })).not.toBeInTheDocument()
    })

    it('aucun champ de recherche visible avant un clic sur le bouton', () => {
      window.localStorage.setItem('compteur.counters.v1', JSON.stringify([makeCounter({ name: 'Un' })]))
      render(<App />)
      expect(screen.getByRole('button', { name: 'Rechercher' })).toBeInTheDocument()
      expect(screen.queryByPlaceholderText('Rechercher un compteur…')).not.toBeInTheDocument()
    })

    it('révèle le champ au clic et filtre les compteurs par nom', async () => {
      window.localStorage.setItem(
        'compteur.counters.v1',
        JSON.stringify([makeCounter({ id: 'a', name: 'Pompes' }), makeCounter({ id: 'b', name: 'Squats' })])
      )
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }))
      const input = screen.getByPlaceholderText('Rechercher un compteur…')
      fireEvent.change(input, { target: { value: 'pom' } })
      expect(screen.getByText('Pompes')).toBeInTheDocument()
      // La carte masquée reste montée le temps de son animation de sortie
      // (AnimatePresence) : on attend qu'elle ait fini de disparaître.
      await waitFor(() => expect(screen.queryByText('Squats')).not.toBeInTheDocument())
    })

    it("affiche un message dédié quand aucun compteur ne correspond", () => {
      window.localStorage.setItem('compteur.counters.v1', JSON.stringify([makeCounter({ name: 'Pompes' })]))
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }))
      fireEvent.change(screen.getByPlaceholderText('Rechercher un compteur…'), { target: { value: 'zzz' } })
      expect(screen.getByText('Aucun compteur ne correspond à « zzz ».')).toBeInTheDocument()
      expect(screen.queryByText('Créer mon premier compteur')).not.toBeInTheDocument()
    })

    it('ferme et réinitialise la recherche au clic sur la croix', () => {
      window.localStorage.setItem(
        'compteur.counters.v1',
        JSON.stringify([makeCounter({ id: 'a', name: 'Pompes' }), makeCounter({ id: 'b', name: 'Squats' })])
      )
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }))
      fireEvent.change(screen.getByPlaceholderText('Rechercher un compteur…'), { target: { value: 'pom' } })
      fireEvent.click(screen.getByRole('button', { name: 'Fermer la recherche' }))
      expect(screen.queryByPlaceholderText('Rechercher un compteur…')).not.toBeInTheDocument()
      expect(screen.getByText('Pompes')).toBeInTheDocument()
      expect(screen.getByText('Squats')).toBeInTheDocument()
    })

    it('ferme et réinitialise la recherche sur Échap', () => {
      window.localStorage.setItem(
        'compteur.counters.v1',
        JSON.stringify([makeCounter({ id: 'a', name: 'Pompes' }), makeCounter({ id: 'b', name: 'Squats' })])
      )
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }))
      const input = screen.getByPlaceholderText('Rechercher un compteur…')
      fireEvent.change(input, { target: { value: 'pom' } })
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(screen.queryByPlaceholderText('Rechercher un compteur…')).not.toBeInTheDocument()
      expect(screen.getByText('Squats')).toBeInTheDocument()
    })

    it("ignore une touche sans effet dans le champ de recherche", () => {
      window.localStorage.setItem('compteur.counters.v1', JSON.stringify([makeCounter({ name: 'Pompes' })]))
      render(<App />)
      fireEvent.click(screen.getByRole('button', { name: 'Rechercher' }))
      const input = screen.getByPlaceholderText('Rechercher un compteur…')
      fireEvent.keyDown(input, { key: 'a' })
      expect(screen.getByPlaceholderText('Rechercher un compteur…')).toBeInTheDocument()
    })
  })
})
