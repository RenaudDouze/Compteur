import { act, fireEvent, render, screen } from '@testing-library/react'
import { Reorder } from 'framer-motion'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CounterCard } from './CounterCard'
import type { Counter } from '../types'

const realNavigator = window.navigator
const realMatchMedia = window.matchMedia

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

function renderCard(counterOverrides: Partial<Counter> = {}, props: Partial<Parameters<typeof CounterCard>[0]> = {}) {
  const counter = makeCounter(counterOverrides)
  const handlers = {
    onChange: vi.fn(),
    onSetCount: vi.fn(),
    onRename: vi.fn(),
    onSetOdds: vi.fn(),
    onSetStartDate: vi.fn(),
    onSetBackgroundImage: vi.fn(),
    onDelete: vi.fn(),
    ...props,
  }
  const utils = render(
    <Reorder.Group as="div" values={[counter]} onReorder={() => {}}>
      <CounterCard counter={counter} {...handlers} {...props} />
    </Reorder.Group>
  )
  return { counter, ...handlers, ...utils }
}

describe('CounterCard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('affiche le nom et la valeur du compteur', () => {
    renderCard({ name: 'Mon compteur', count: 7 })
    expect(screen.getByText('Mon compteur')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })

  it('incrémente au clic sur la carte', () => {
    const { onChange } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: /Incrémenter Compteur 1/ }))
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('décrémente au clic sur le bouton -', () => {
    const { onChange } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Décrémenter' }))
    expect(onChange).toHaveBeenCalledWith(-1)
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('incrémente uniquement une fois au clic sur le bouton + (pas de double appel via le bubbling)', () => {
    const { onChange } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Incrémenter' }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(1)
  })

  describe('suppression', () => {
    it('demande une confirmation avant de supprimer', () => {
      const { onDelete } = renderCard()
      const deleteBtn = screen.getByRole('button', { name: 'Supprimer le compteur' })
      fireEvent.click(deleteBtn)
      expect(onDelete).not.toHaveBeenCalled()
      expect(deleteBtn).toHaveTextContent('✓')
    })

    it('supprime au second clic de confirmation', () => {
      const { onDelete } = renderCard()
      const deleteBtn = screen.getByRole('button', { name: 'Supprimer le compteur' })
      fireEvent.click(deleteBtn)
      fireEvent.click(deleteBtn)
      expect(onDelete).toHaveBeenCalledTimes(1)
    })

    it('annule la confirmation après le délai', () => {
      renderCard()
      const deleteBtn = screen.getByRole('button', { name: 'Supprimer le compteur' })
      fireEvent.click(deleteBtn)
      expect(deleteBtn).toHaveTextContent('✓')
      act(() => {
        vi.advanceTimersByTime(2600)
      })
      expect(deleteBtn).toHaveTextContent('✕')
    })

    it("le clic sur le bouton supprimer n'incrémente pas le compteur", () => {
      const { onChange } = renderCard()
      fireEvent.click(screen.getByRole('button', { name: 'Supprimer le compteur' }))
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('poignée de glisser', () => {
    it("un simple clic sur la poignée n'incrémente pas le compteur", () => {
      const { onChange } = renderCard()
      fireEvent.click(screen.getByRole('button', { name: 'Réordonner le compteur' }))
      expect(onChange).not.toHaveBeenCalled()
    })

    it("pointerdown sur la poignée n'incrémente pas le compteur", () => {
      const { onChange } = renderCard()
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Réordonner le compteur' }))
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('renommage', () => {
    it('ouvre un champ pré-rempli au clic sur le nom', () => {
      renderCard({ name: 'Avant' })
      fireEvent.click(screen.getByText('Avant'))
      expect(screen.getByDisplayValue('Avant')).toBeInTheDocument()
    })

    it('valide le nouveau nom avec Entrée', () => {
      const { onRename } = renderCard({ name: 'Avant' })
      fireEvent.click(screen.getByText('Avant'))
      const input = screen.getByDisplayValue('Avant')
      fireEvent.change(input, { target: { value: 'Après' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onRename).toHaveBeenCalledWith('Après')
    })

    it('supprime les espaces superflus', () => {
      const { onRename } = renderCard({ name: 'Avant' })
      fireEvent.click(screen.getByText('Avant'))
      const input = screen.getByDisplayValue('Avant')
      fireEvent.change(input, { target: { value: '   Espacé   ' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onRename).toHaveBeenCalledWith('Espacé')
    })

    it('retombe sur "Sans nom" si le champ est vide', () => {
      const { onRename } = renderCard({ name: 'Avant' })
      fireEvent.click(screen.getByText('Avant'))
      const input = screen.getByDisplayValue('Avant')
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onRename).toHaveBeenCalledWith('Sans nom')
    })

    it('annule avec Échap sans appeler onRename', () => {
      const { onRename } = renderCard({ name: 'Avant' })
      fireEvent.click(screen.getByText('Avant'))
      const input = screen.getByDisplayValue('Avant')
      fireEvent.change(input, { target: { value: 'Modifié' } })
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(onRename).not.toHaveBeenCalled()
      expect(screen.getByText('Avant')).toBeInTheDocument()
    })

    it('valide aussi au blur', () => {
      const { onRename } = renderCard({ name: 'Avant' })
      fireEvent.click(screen.getByText('Avant'))
      const input = screen.getByDisplayValue('Avant')
      fireEvent.change(input, { target: { value: 'ParBlur' } })
      fireEvent.blur(input)
      expect(onRename).toHaveBeenCalledWith('ParBlur')
    })

    it("le clic pour renommer n'incrémente pas le compteur", () => {
      const { onChange } = renderCard({ name: 'Avant' })
      fireEvent.click(screen.getByText('Avant'))
      expect(onChange).not.toHaveBeenCalled()
    })

    it("cliquer dans le champ de saisie du nom n'incrémente pas le compteur", () => {
      const { onChange } = renderCard({ name: 'Avant' })
      fireEvent.click(screen.getByText('Avant'))
      fireEvent.click(screen.getByDisplayValue('Avant'))
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('probabilité', () => {
    afterEach(() => {
      vi.stubGlobal('matchMedia', realMatchMedia)
    })

    it('affiche "+ probabilité" quand aucune n\'est définie', () => {
      renderCard()
      expect(screen.getByText('+ probabilité')).toBeInTheDocument()
    })

    it('affiche le format compact quand fill=false', () => {
      renderCard({ oddsDenominator: 4096 }, { fill: false })
      expect(screen.getByText('1/4 096')).toBeInTheDocument()
    })

    it('affiche le format complet quand fill=true et écran large', () => {
      renderCard({ oddsDenominator: 4096 }, { fill: true })
      expect(screen.getByText('1 chance sur 4 096')).toBeInTheDocument()
    })

    it('affiche le format compact même avec fill=true sur petit écran', () => {
      vi.stubGlobal(
        'matchMedia',
        vi.fn().mockImplementation((query: string) => ({
          matches: true,
          media: query,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
        }))
      )
      renderCard({ oddsDenominator: 4096 }, { fill: true })
      expect(screen.getByText('1/4 096')).toBeInTheDocument()
    })

    it('définit une probabilité et affiche le taux de réussite', () => {
      const { onSetOdds } = renderCard({ count: 500 })
      fireEvent.click(screen.getByText('+ probabilité'))
      const input = screen.getByPlaceholderText('4096')
      fireEvent.change(input, { target: { value: '4096' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetOdds).toHaveBeenCalledWith(4096)
    })

    it('ignore les caractères non numériques dans la saisie', () => {
      const { onSetOdds } = renderCard()
      fireEvent.click(screen.getByText('+ probabilité'))
      const input = screen.getByPlaceholderText('4096')
      fireEvent.change(input, { target: { value: '4a0b9c6' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetOdds).toHaveBeenCalledWith(4096)
    })

    it('efface la probabilité si la saisie est vide', () => {
      const { onSetOdds } = renderCard({ oddsDenominator: 10 }, { fill: true })
      fireEvent.click(screen.getByText('1 chance sur 10'))
      const input = screen.getByDisplayValue('10')
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetOdds).toHaveBeenCalledWith(undefined)
    })

    it('efface la probabilité si la saisie est 0', () => {
      const { onSetOdds } = renderCard({ oddsDenominator: 10 }, { fill: true })
      fireEvent.click(screen.getByText('1 chance sur 10'))
      const input = screen.getByDisplayValue('10')
      fireEvent.change(input, { target: { value: '0' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetOdds).toHaveBeenCalledWith(undefined)
    })

    it('annule avec Échap et restaure la valeur précédente', () => {
      const { onSetOdds } = renderCard({ oddsDenominator: 10 }, { fill: true })
      fireEvent.click(screen.getByText('1 chance sur 10'))
      const input = screen.getByDisplayValue('10')
      fireEvent.change(input, { target: { value: '999' } })
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(onSetOdds).not.toHaveBeenCalled()
      expect(screen.getByText('1 chance sur 10')).toBeInTheDocument()
    })

    it('valide aussi au blur', () => {
      const { onSetOdds } = renderCard()
      fireEvent.click(screen.getByText('+ probabilité'))
      const input = screen.getByPlaceholderText('4096')
      fireEvent.change(input, { target: { value: '20' } })
      fireEvent.blur(input)
      expect(onSetOdds).toHaveBeenCalledWith(20)
    })

    it('annule avec Échap en repartant d\'aucune probabilité définie', () => {
      const { onSetOdds } = renderCard()
      fireEvent.click(screen.getByText('+ probabilité'))
      const input = screen.getByPlaceholderText('4096')
      fireEvent.change(input, { target: { value: '999' } })
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(onSetOdds).not.toHaveBeenCalled()
      expect(screen.getByText('+ probabilité')).toBeInTheDocument()
    })

    it("cliquer dans la zone de saisie n'incrémente pas le compteur", () => {
      const { onChange } = renderCard()
      fireEvent.click(screen.getByText('+ probabilité'))
      fireEvent.click(document.querySelector('.counter-odds-edit')!)
      expect(onChange).not.toHaveBeenCalled()
    })

    it("le clic pour éditer n'incrémente pas le compteur", () => {
      const { onChange } = renderCard()
      fireEvent.click(screen.getByText('+ probabilité'))
      expect(onChange).not.toHaveBeenCalled()
    })

    it('affiche le taux de réussite cumulé quand une probabilité est définie', () => {
      renderCard({ count: 500, oddsDenominator: 4096 })
      expect(screen.getByText(/de l'avoir obtenu avant ce stade/)).toBeInTheDocument()
    })

    it("n'affiche pas de taux de réussite sans probabilité définie", () => {
      renderCard()
      expect(screen.queryByText(/de l'avoir obtenu avant ce stade/)).not.toBeInTheDocument()
    })
  })

  describe('date de début', () => {
    it('affiche la date de création par défaut', () => {
      renderCard({ createdAt: new Date(2026, 7, 1).getTime(), startDate: undefined })
      expect(screen.getByTitle('Toucher pour changer la date de début')).toBeInTheDocument()
    })

    it('change la date de début', () => {
      // le compteur par défaut a déjà pour date de début le 2026-08-01
      // (dérivée de createdAt) : on choisit une valeur différente pour que
      // le changement soit réellement détecté.
      const { onSetStartDate } = renderCard()
      fireEvent.click(screen.getByTitle('Toucher pour changer la date de début'))
      const input = document.querySelector('.counter-date-input') as HTMLInputElement
      fireEvent.change(input, { target: { value: '2026-07-15' } })
      expect(onSetStartDate).toHaveBeenCalledWith('2026-07-15')
    })

    it('ne rappelle pas onSetStartDate sur un simple blur sans changement', () => {
      const { onSetStartDate } = renderCard()
      fireEvent.click(screen.getByTitle('Toucher pour changer la date de début'))
      const input = document.querySelector('.counter-date-input') as HTMLInputElement
      fireEvent.blur(input)
      expect(onSetStartDate).not.toHaveBeenCalled()
    })

    it('efface la date de début si le champ est vidé', () => {
      const { onSetStartDate } = renderCard()
      fireEvent.click(screen.getByTitle('Toucher pour changer la date de début'))
      const input = document.querySelector('.counter-date-input') as HTMLInputElement
      fireEvent.change(input, { target: { value: '' } })
      expect(onSetStartDate).toHaveBeenCalledWith(undefined)
    })

    it("le clic pour éditer n'incrémente pas le compteur", () => {
      const { onChange } = renderCard()
      fireEvent.click(screen.getByTitle('Toucher pour changer la date de début'))
      expect(onChange).not.toHaveBeenCalled()
    })

    it("cliquer dans le champ de date n'incrémente pas le compteur", () => {
      const { onChange } = renderCard()
      fireEvent.click(screen.getByTitle('Toucher pour changer la date de début'))
      const input = document.querySelector('.counter-date-input') as HTMLInputElement
      fireEvent.click(input)
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('image de fond', () => {
    it('affiche "+ image de fond" quand aucune n\'est définie', () => {
      renderCard()
      expect(screen.getByText('+ image de fond')).toBeInTheDocument()
    })

    it("n'affiche pas de calque de fond quand aucune image n'est définie", () => {
      renderCard()
      expect(document.querySelector('.counter-bg')).not.toBeInTheDocument()
    })

    it('affiche "Image de fond ✓" en plein écran et le calque de fond quand une URL valide est définie', () => {
      renderCard({ backgroundImageUrl: 'https://exemple.com/fond.jpg' }, { fill: true })
      expect(screen.getByText('Image de fond ✓')).toBeInTheDocument()
      const bg = document.querySelector('.counter-bg') as HTMLElement
      expect(bg).toBeInTheDocument()
      expect(bg.style.backgroundImage).toContain('exemple.com/fond.jpg')
    })

    it('affiche l\'icône compacte quand une image est définie et fill=false', () => {
      renderCard({ backgroundImageUrl: 'https://exemple.com/fond.jpg' }, { fill: false })
      expect(screen.getByText('🖼')).toBeInTheDocument()
    })

    it('définit une image de fond avec une URL http(s) valide', () => {
      const { onSetBackgroundImage } = renderCard()
      fireEvent.click(screen.getByText('+ image de fond'))
      const input = screen.getByPlaceholderText('https://exemple.com/image.jpg')
      fireEvent.change(input, { target: { value: 'https://exemple.com/photo.png' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetBackgroundImage).toHaveBeenCalledWith('https://exemple.com/photo.png')
    })

    it('ignore une URL invalide et conserve la valeur précédente', () => {
      const { onSetBackgroundImage } = renderCard(
        { backgroundImageUrl: 'https://exemple.com/ancien.jpg' },
        { fill: true }
      )
      fireEvent.click(screen.getByText('Image de fond ✓'))
      const input = screen.getByDisplayValue('https://exemple.com/ancien.jpg')
      fireEvent.change(input, { target: { value: 'pas-une-url' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetBackgroundImage).not.toHaveBeenCalled()
      expect(screen.getByText('Image de fond ✓')).toBeInTheDocument()
    })

    it('efface l\'image de fond si la saisie est vidée', () => {
      const { onSetBackgroundImage } = renderCard(
        { backgroundImageUrl: 'https://exemple.com/ancien.jpg' },
        { fill: true }
      )
      fireEvent.click(screen.getByText('Image de fond ✓'))
      const input = screen.getByDisplayValue('https://exemple.com/ancien.jpg')
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetBackgroundImage).toHaveBeenCalledWith(undefined)
    })

    it('annule avec Échap et restaure la valeur précédente', () => {
      const { onSetBackgroundImage } = renderCard(
        { backgroundImageUrl: 'https://exemple.com/ancien.jpg' },
        { fill: true }
      )
      fireEvent.click(screen.getByText('Image de fond ✓'))
      const input = screen.getByDisplayValue('https://exemple.com/ancien.jpg')
      fireEvent.change(input, { target: { value: 'https://exemple.com/autre.jpg' } })
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(onSetBackgroundImage).not.toHaveBeenCalled()
      expect(screen.getByText('Image de fond ✓')).toBeInTheDocument()
    })

    it('valide aussi au blur', () => {
      const { onSetBackgroundImage } = renderCard()
      fireEvent.click(screen.getByText('+ image de fond'))
      const input = screen.getByPlaceholderText('https://exemple.com/image.jpg')
      fireEvent.change(input, { target: { value: 'https://exemple.com/blur.jpg' } })
      fireEvent.blur(input)
      expect(onSetBackgroundImage).toHaveBeenCalledWith('https://exemple.com/blur.jpg')
    })

    it("ignore une URL invalide en repartant d'aucune image définie", () => {
      const { onSetBackgroundImage } = renderCard()
      fireEvent.click(screen.getByText('+ image de fond'))
      const input = screen.getByPlaceholderText('https://exemple.com/image.jpg')
      fireEvent.change(input, { target: { value: 'pas-une-url' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetBackgroundImage).not.toHaveBeenCalled()
      expect(screen.getByText('+ image de fond')).toBeInTheDocument()
    })

    it("annule avec Échap en repartant d'aucune image définie", () => {
      const { onSetBackgroundImage } = renderCard()
      fireEvent.click(screen.getByText('+ image de fond'))
      const input = screen.getByPlaceholderText('https://exemple.com/image.jpg')
      fireEvent.change(input, { target: { value: 'https://exemple.com/x.jpg' } })
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(onSetBackgroundImage).not.toHaveBeenCalled()
      expect(screen.getByText('+ image de fond')).toBeInTheDocument()
    })

    it("cliquer dans la zone de saisie n'incrémente pas le compteur", () => {
      const { onChange } = renderCard()
      fireEvent.click(screen.getByText('+ image de fond'))
      fireEvent.click(document.querySelector('.counter-bg-edit')!)
      expect(onChange).not.toHaveBeenCalled()
    })

    it("le clic pour éditer n'incrémente pas le compteur", () => {
      const { onChange } = renderCard()
      fireEvent.click(screen.getByText('+ image de fond'))
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('partage', () => {
    afterEach(() => {
      vi.stubGlobal('navigator', realNavigator)
    })

    it('utilise navigator.share quand disponible', async () => {
      const shareMock = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...navigator, share: shareMock, clipboard: { writeText: vi.fn() } })
      renderCard({ name: 'Partagé', count: 3 })
      await act(async () => {
        fireEvent.click(screen.getByTitle('Copier ou partager ce compteur (texte, sans lien)'))
      })
      expect(shareMock).toHaveBeenCalledTimes(1)
      expect(shareMock.mock.calls[0][0].text).toContain('Partagé : 3')
    })

    it('ignore silencieusement une annulation de navigator.share', async () => {
      const shareMock = vi.fn().mockRejectedValue(new Error('annulé'))
      vi.stubGlobal('navigator', { ...navigator, share: shareMock, clipboard: { writeText: vi.fn() } })
      renderCard({}, { fill: true })
      await act(async () => {
        fireEvent.click(screen.getByTitle('Copier ou partager ce compteur (texte, sans lien)'))
      })
      // Pas de bascule vers l'état "Copié" : le chemin navigator.share ne
      // passe jamais par le presse-papiers, même en cas d'annulation.
      expect(screen.getByText('⇪ Partager')).toBeInTheDocument()
    })

    it('copie dans le presse-papiers quand navigator.share est indisponible', async () => {
      const writeTextMock = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal('navigator', { ...navigator, share: undefined, clipboard: { writeText: writeTextMock } })
      renderCard({ name: 'Copié', count: 9 }, { fill: true })
      await act(async () => {
        fireEvent.click(screen.getByTitle('Copier ou partager ce compteur (texte, sans lien)'))
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
      renderCard({}, { fill: true })
      await act(async () => {
        fireEvent.click(screen.getByTitle('Copier ou partager ce compteur (texte, sans lien)'))
      })
      expect(screen.getByText('Copié ✓')).toBeInTheDocument()
      await act(async () => {
        vi.advanceTimersByTime(2100)
      })
      expect(screen.getByText('⇪ Partager')).toBeInTheDocument()
    })

    it('ignore silencieusement un échec de copie', async () => {
      vi.stubGlobal('navigator', {
        ...navigator,
        share: undefined,
        clipboard: { writeText: vi.fn().mockRejectedValue(new Error('refusé')) },
      })
      renderCard()
      await act(async () => {
        fireEvent.click(screen.getByTitle('Copier ou partager ce compteur (texte, sans lien)'))
      })
      expect(screen.getByText('⇪')).toBeInTheDocument()
    })

    it("le clic pour partager n'incrémente pas le compteur", async () => {
      vi.stubGlobal('navigator', {
        ...navigator,
        share: undefined,
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      })
      const { onChange } = renderCard()
      await act(async () => {
        fireEvent.click(screen.getByTitle('Copier ou partager ce compteur (texte, sans lien)'))
      })
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('édition directe de la valeur', () => {
    it('ouvre un champ pré-rempli au clic sur le crayon', () => {
      renderCard({ count: 42 })
      fireEvent.click(screen.getByRole('button', { name: 'Définir la valeur du compteur' }))
      expect(screen.getByDisplayValue('42')).toBeInTheDocument()
    })

    it('sélectionne le texte au focus', () => {
      renderCard({ count: 42 })
      fireEvent.click(screen.getByRole('button', { name: 'Définir la valeur du compteur' }))
      const input = screen.getByDisplayValue('42') as HTMLInputElement
      const selectSpy = vi.spyOn(input, 'select')
      fireEvent.focus(input)
      expect(selectSpy).toHaveBeenCalled()
    })

    it('valide la nouvelle valeur avec Entrée', () => {
      const { onSetCount } = renderCard({ count: 0 })
      fireEvent.click(screen.getByRole('button', { name: 'Définir la valeur du compteur' }))
      const input = screen.getByDisplayValue('0')
      fireEvent.change(input, { target: { value: '250' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetCount).toHaveBeenCalledWith(250)
    })

    it('accepte une valeur négative', () => {
      const { onSetCount } = renderCard({ count: 0 })
      fireEvent.click(screen.getByRole('button', { name: 'Définir la valeur du compteur' }))
      const input = screen.getByDisplayValue('0')
      fireEvent.change(input, { target: { value: '-15' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetCount).toHaveBeenCalledWith(-15)
    })

    it('retombe sur la valeur actuelle si la saisie est invalide', () => {
      const { onSetCount } = renderCard({ count: 12 })
      fireEvent.click(screen.getByRole('button', { name: 'Définir la valeur du compteur' }))
      const input = screen.getByDisplayValue('12')
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetCount).toHaveBeenCalledWith(12)
    })

    it('annule avec Échap sans appeler onSetCount', () => {
      const { onSetCount } = renderCard({ count: 5 })
      fireEvent.click(screen.getByRole('button', { name: 'Définir la valeur du compteur' }))
      const input = screen.getByDisplayValue('5')
      fireEvent.change(input, { target: { value: '999' } })
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(onSetCount).not.toHaveBeenCalled()
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('valide aussi au blur', () => {
      const { onSetCount } = renderCard({ count: 5 })
      fireEvent.click(screen.getByRole('button', { name: 'Définir la valeur du compteur' }))
      const input = screen.getByDisplayValue('5')
      fireEvent.change(input, { target: { value: '77' } })
      fireEvent.blur(input)
      expect(onSetCount).toHaveBeenCalledWith(77)
    })

    it("le clic sur le crayon n'incrémente pas le compteur", () => {
      const { onChange } = renderCard()
      fireEvent.click(screen.getByRole('button', { name: 'Définir la valeur du compteur' }))
      expect(onChange).not.toHaveBeenCalled()
    })

    it("cliquer dans le champ de valeur n'incrémente pas le compteur", () => {
      const { onChange } = renderCard({ count: 42 })
      fireEvent.click(screen.getByRole('button', { name: 'Définir la valeur du compteur' }))
      fireEvent.click(screen.getByDisplayValue('42'))
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('mesure dynamique de la taille (fill)', () => {
    it("ne crée pas d'observateur de redimensionnement quand fill=false", () => {
      renderCard({}, { fill: false })
      // Le rendu ne doit pas planter et affiche bien le chiffre.
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('observe le conteneur du chiffre quand fill=true', () => {
      renderCard({}, { fill: true })
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it("calcule et applique une taille de police quand l'espace mesuré est non nul", () => {
      const widthSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(320)
      const heightSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(480)
      renderCard({ count: 12 }, { fill: true })
      const valueEl = document.querySelector('.counter-value') as HTMLElement
      expect(valueEl.style.fontSize).toMatch(/px$/)
      widthSpy.mockRestore()
      heightSpy.mockRestore()
    })

    it("gère le cas où le conteneur n'est pas monté (mode édition) lors d'un changement de compteur", () => {
      const counter = makeCounter({ count: 1 })
      const { rerender } = render(
        <Reorder.Group as="div" values={[counter]} onReorder={() => {}}>
          <CounterCard
            counter={counter}
            fill
            onChange={vi.fn()}
            onSetCount={vi.fn()}
            onRename={vi.fn()}
            onSetOdds={vi.fn()}
            onSetStartDate={vi.fn()}
            onSetBackgroundImage={vi.fn()}
            onDelete={vi.fn()}
          />
        </Reorder.Group>
      )
      fireEvent.click(screen.getByRole('button', { name: 'Définir la valeur du compteur' }))
      const updated = { ...counter, count: 2 }
      rerender(
        <Reorder.Group as="div" values={[updated]} onReorder={() => {}}>
          <CounterCard
            counter={updated}
            fill
            onChange={vi.fn()}
            onSetCount={vi.fn()}
            onRename={vi.fn()}
            onSetOdds={vi.fn()}
            onSetStartDate={vi.fn()}
            onSetBackgroundImage={vi.fn()}
            onDelete={vi.fn()}
          />
        </Reorder.Group>
      )
      // Ne doit pas planter même si le div mesuré n'est pas monté (input affiché à la place).
      expect(screen.getByDisplayValue('1')).toBeInTheDocument()
    })
  })

  describe('animation de rebond', () => {
    it('ne plante pas lors du montage initial', () => {
      renderCard({ count: 3 })
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('se déclenche sans planter quand la valeur change', () => {
      const counter = makeCounter({ count: 1 })
      const { rerender } = render(
        <Reorder.Group as="div" values={[counter]} onReorder={() => {}}>
          <CounterCard
            counter={counter}
            onChange={vi.fn()}
            onSetCount={vi.fn()}
            onRename={vi.fn()}
            onSetOdds={vi.fn()}
            onSetStartDate={vi.fn()}
            onSetBackgroundImage={vi.fn()}
            onDelete={vi.fn()}
          />
        </Reorder.Group>
      )
      const updated = { ...counter, count: 2 }
      rerender(
        <Reorder.Group as="div" values={[updated]} onReorder={() => {}}>
          <CounterCard
            counter={updated}
            onChange={vi.fn()}
            onSetCount={vi.fn()}
            onRename={vi.fn()}
            onSetOdds={vi.fn()}
            onSetStartDate={vi.fn()}
            onSetBackgroundImage={vi.fn()}
            onDelete={vi.fn()}
          />
        </Reorder.Group>
      )
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  it('applique la couleur du compteur en variable CSS --accent', () => {
    renderCard({ color: '#16a34a' })
    const card = screen.getByRole('button', { name: 'Incrémenter Compteur 1' })
    expect(card.style.getPropertyValue('--accent')).toBe('#16a34a')
  })
})
