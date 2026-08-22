import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { encodeCountersToParam } from './sync'
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
    fireEvent.click(screen.getByText('+ probabilité'))
    const input = screen.getByPlaceholderText('4096')
    fireEvent.change(input, { target: { value: '10' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('1 chance sur 10')).toBeInTheDocument()
  })

  it('définit une date de début', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
    fireEvent.click(screen.getByTitle('Toucher pour changer la date de début'))
    const input = document.querySelector('.counter-date-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: '2020-01-01' } })
    expect(screen.getByTitle('Toucher pour changer la date de début')).toHaveTextContent('2020')
  })

  it('définit une image de fond', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
    fireEvent.click(screen.getByText('+ image de fond'))
    const input = screen.getByPlaceholderText('https://exemple.com/image.jpg')
    fireEvent.change(input, { target: { value: 'https://exemple.com/fond.jpg' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(document.querySelector('.counter-bg')).toBeInTheDocument()
  })

  it('supprime un compteur après confirmation', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('button', { name: '+ Nouveau compteur' }))
    const deleteBtn = screen.getByRole('button', { name: 'Supprimer le compteur' })
    fireEvent.click(deleteBtn)
    fireEvent.click(deleteBtn)
    expect(screen.getByText("Aucun compteur pour l'instant.")).toBeInTheDocument()
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

    // Définit une probabilité uniquement sur le premier.
    const firstCard = document.getElementById('a') as HTMLElement
    fireEvent.click(within(firstCard).getByText('+ probabilité'))
    fireEvent.change(within(firstCard).getByPlaceholderText('4096'), { target: { value: '5' } })
    fireEvent.keyDown(within(firstCard).getByPlaceholderText('4096'), { key: 'Enter' })
    const secondCard = document.getElementById('b') as HTMLElement
    expect(within(secondCard).getByText('+ probabilité')).toBeInTheDocument()

    // Définit une date de début uniquement sur le premier.
    fireEvent.click(within(firstCard).getByTitle('Toucher pour changer la date de début'))
    const dateInput = firstCard.querySelector('.counter-date-input') as HTMLInputElement
    fireEvent.change(dateInput, { target: { value: '2020-01-01' } })
    expect(within(secondCard).getByTitle('Toucher pour changer la date de début')).not.toHaveTextContent('2020')

    // Définit une image de fond uniquement sur le premier.
    fireEvent.click(within(firstCard).getByText('+ image de fond'))
    fireEvent.change(within(firstCard).getByPlaceholderText('https://exemple.com/image.jpg'), {
      target: { value: 'https://exemple.com/fond.jpg' },
    })
    fireEvent.keyDown(within(firstCard).getByPlaceholderText('https://exemple.com/image.jpg'), { key: 'Enter' })
    expect(firstCard.querySelector('.counter-bg')).toBeInTheDocument()
    expect(secondCard.querySelector('.counter-bg')).not.toBeInTheDocument()

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
})
