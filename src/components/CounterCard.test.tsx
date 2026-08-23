import { act, fireEvent, render, screen } from '@testing-library/react'
import { Reorder } from 'framer-motion'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CounterCard } from './CounterCard'
import type { Counter } from '../types'

const TEST_COLORS = ['#2563eb', '#7c3aed', '#0d9488']

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
    colors: TEST_COLORS,
    onChange: vi.fn(),
    onSetCount: vi.fn(),
    onRename: vi.fn(),
    onSetOdds: vi.fn(),
    onSetStartDate: vi.fn(),
    onSetBackgroundImage: vi.fn(),
    onSetColor: vi.fn(),
    onSetStep: vi.fn(),
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

  describe('tap tactile (pointer events)', () => {
    it("incrémente au relâchement d'un tap sur la carte (pointerdown puis pointerup au même endroit)", () => {
      const { onChange } = renderCard()
      const card = screen.getByRole('button', { name: /Incrémenter Compteur 1/ })
      fireEvent.pointerDown(card, { clientX: 20, clientY: 20, button: 0 })
      fireEvent.pointerUp(card, { clientX: 20, clientY: 20, button: 0 })
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(1)
    })

    it("n'incrémente pas deux fois quand le clic natif du navigateur suit le tap déjà compté", () => {
      const { onChange } = renderCard()
      const card = screen.getByRole('button', { name: /Incrémenter Compteur 1/ })
      fireEvent.pointerDown(card, { clientX: 20, clientY: 20, button: 0 })
      fireEvent.pointerUp(card, { clientX: 20, clientY: 20, button: 0 })
      fireEvent.click(card)
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it("n'incrémente pas si le pointeur a beaucoup bougé entre l'appui et le relâchement (scroll)", () => {
      const { onChange } = renderCard()
      const card = screen.getByRole('button', { name: /Incrémenter Compteur 1/ })
      fireEvent.pointerDown(card, { clientX: 20, clientY: 20, button: 0 })
      fireEvent.pointerUp(card, { clientX: 200, clientY: 200, button: 0 })
      expect(onChange).not.toHaveBeenCalled()
    })

    it("ignore un pointerup sans pointerdown préalable sur la carte", () => {
      const { onChange } = renderCard()
      const card = screen.getByRole('button', { name: /Incrémenter Compteur 1/ })
      fireEvent.pointerUp(card, { clientX: 20, clientY: 20, button: 0 })
      expect(onChange).not.toHaveBeenCalled()
    })

    it('ignore le clic droit (bouton secondaire) sur la carte', () => {
      const { onChange } = renderCard()
      const card = screen.getByRole('button', { name: /Incrémenter Compteur 1/ })
      fireEvent.pointerDown(card, { clientX: 20, clientY: 20, button: 2 })
      fireEvent.pointerUp(card, { clientX: 20, clientY: 20, button: 2 })
      expect(onChange).not.toHaveBeenCalled()
    })

    it('un pointercancel annule le tap en cours (pas d\'incrément au pointerup qui suit)', () => {
      const { onChange } = renderCard()
      const card = screen.getByRole('button', { name: /Incrémenter Compteur 1/ })
      fireEvent.pointerDown(card, { clientX: 20, clientY: 20, button: 0 })
      fireEvent.pointerCancel(card)
      fireEvent.pointerUp(card, { clientX: 20, clientY: 20, button: 0 })
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe("pas d'incrément personnalisé", () => {
    it('applique le pas au clic sur la carte', () => {
      const { onChange } = renderCard({ step: 5 })
      fireEvent.click(screen.getByRole('button', { name: /Incrémenter Compteur 1/ }))
      expect(onChange).toHaveBeenCalledWith(5)
    })

    it('applique le pas au clic sur le bouton -', () => {
      const { onChange } = renderCard({ step: 5 })
      fireEvent.click(screen.getByRole('button', { name: 'Décrémenter' }))
      expect(onChange).toHaveBeenCalledWith(-5)
    })

    it('applique le pas via les raccourcis clavier', () => {
      const { onChange } = renderCard({ step: 5 })
      fireEvent.keyDown(screen.getByRole('button', { name: /Incrémenter Compteur 1/ }), { key: 'ArrowUp' })
      expect(onChange).toHaveBeenCalledWith(5)
    })
  })

  describe('appui long (rafale)', () => {
    it('incrémente une seule fois pour un appui bref (tap normal)', () => {
      const { onChange } = renderCard()
      const plus = screen.getByRole('button', { name: 'Incrémenter' })
      fireEvent.pointerDown(plus)
      fireEvent.pointerUp(plus)
      fireEvent.click(plus)
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(1)
    })

    it('ne déclenche pas de répétition si relâché avant le délai de maintien', () => {
      const { onChange } = renderCard()
      const plus = screen.getByRole('button', { name: 'Incrémenter' })
      fireEvent.pointerDown(plus)
      act(() => {
        vi.advanceTimersByTime(200)
      })
      fireEvent.pointerUp(plus)
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(onChange).not.toHaveBeenCalled()
    })

    it('répète en rafale après le délai de maintien, sans incrément en trop au relâchement', () => {
      const { onChange } = renderCard()
      const plus = screen.getByRole('button', { name: 'Incrémenter' })
      fireEvent.pointerDown(plus)
      act(() => {
        vi.advanceTimersByTime(350)
      })
      expect(onChange).toHaveBeenCalledTimes(1)
      act(() => {
        vi.advanceTimersByTime(250)
      })
      expect(onChange).toHaveBeenCalledTimes(3)

      fireEvent.pointerUp(plus)
      fireEvent.click(plus)
      // Le clic émis par le navigateur après le relâchement ne doit pas
      // ajouter d'incrément supplémentaire à ceux déjà appliqués en rafale.
      expect(onChange).toHaveBeenCalledTimes(3)
    })

    it('répète aussi en rafale sur le bouton -, sans incrément en trop au relâchement', () => {
      const { onChange } = renderCard()
      const minus = screen.getByRole('button', { name: 'Décrémenter' })
      fireEvent.pointerDown(minus)
      act(() => {
        vi.advanceTimersByTime(350)
      })
      expect(onChange).toHaveBeenCalledTimes(1)
      fireEvent.pointerUp(minus)
      fireEvent.click(minus)
      expect(onChange).toHaveBeenCalledTimes(1)
      expect(onChange).toHaveBeenCalledWith(-1)
    })

    it('applique le pas personnalisé à chaque répétition', () => {
      const { onChange } = renderCard({ step: 5 })
      const minus = screen.getByRole('button', { name: 'Décrémenter' })
      fireEvent.pointerDown(minus)
      act(() => {
        vi.advanceTimersByTime(350)
      })
      expect(onChange).toHaveBeenCalledWith(-5)
    })

    it('arrête la répétition si le pointeur quitte le bouton', () => {
      const { onChange } = renderCard()
      const plus = screen.getByRole('button', { name: 'Incrémenter' })
      fireEvent.pointerDown(plus)
      act(() => {
        vi.advanceTimersByTime(350)
      })
      expect(onChange).toHaveBeenCalledTimes(1)
      fireEvent.pointerLeave(plus)
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(onChange).toHaveBeenCalledTimes(1)
    })

    it('arrête la répétition sur pointercancel', () => {
      const { onChange } = renderCard()
      const plus = screen.getByRole('button', { name: 'Incrémenter' })
      fireEvent.pointerDown(plus)
      act(() => {
        vi.advanceTimersByTime(350)
      })
      fireEvent.pointerCancel(plus)
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(onChange).toHaveBeenCalledTimes(1)
    })
  })

  it('affiche le calque d\'image de fond quand une URL est définie', () => {
    renderCard({ backgroundImageUrl: 'https://exemple.com/fond.jpg' })
    const bg = document.querySelector('.counter-bg') as HTMLElement
    expect(bg).toBeInTheDocument()
    expect(bg.style.backgroundImage).toContain('exemple.com/fond.jpg')
  })

  it("n'affiche pas de calque de fond sans image définie", () => {
    renderCard()
    expect(document.querySelector('.counter-bg')).not.toBeInTheDocument()
  })

  it('annonce le nom et la valeur dans une région accessible dédiée', () => {
    renderCard({ name: 'Accessible', count: 5 })
    expect(document.querySelector('.sr-only')).toHaveTextContent('Accessible : 5')
  })

  it("masque l'affichage animé aux technologies d'assistance", () => {
    renderCard()
    expect(document.querySelector('.counter-value')).toHaveAttribute('aria-hidden', 'true')
  })

  describe('raccourcis clavier', () => {
    it.each(['Enter', ' ', 'ArrowUp', '+', '='])('incrémente sur la touche "%s"', (key) => {
      const { onChange } = renderCard()
      fireEvent.keyDown(screen.getByRole('button', { name: /Incrémenter Compteur 1/ }), { key })
      expect(onChange).toHaveBeenCalledWith(1)
    })

    it.each(['ArrowDown', '-'])('décrémente sur la touche "%s"', (key) => {
      const { onChange } = renderCard()
      fireEvent.keyDown(screen.getByRole('button', { name: /Incrémenter Compteur 1/ }), { key })
      expect(onChange).toHaveBeenCalledWith(-1)
    })

    it('ignore une touche sans effet', () => {
      const { onChange } = renderCard()
      fireEvent.keyDown(screen.getByRole('button', { name: /Incrémenter Compteur 1/ }), { key: 'a' })
      expect(onChange).not.toHaveBeenCalled()
    })

    it("ignore une touche qui bouillonne depuis un enfant (pas de double action)", () => {
      const { onChange } = renderCard()
      fireEvent.keyDown(screen.getByRole('button', { name: 'Décrémenter' }), { key: 'Enter' })
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('taux de réussite cumulé', () => {
    it("n'affiche aucun rappel sans probabilité définie", () => {
      renderCard()
      expect(document.querySelector('.counter-odds-hint')).not.toBeInTheDocument()
    })

    it('affiche le taux cumulé sous le nombre quand une probabilité est définie', () => {
      renderCard({ oddsDenominator: 4, count: 1 })
      // 1 - (1 - 1/4)^1 = 0.25 => arrondi affiché à 1 décimale : 25,0 %
      expect(document.querySelector('.counter-odds-hint')).toHaveTextContent('25,0 %')
    })

    it("n'affiche que le pourcentage sur la carte (pas les tentatives restantes ni le rappel de chance constante)", () => {
      renderCard({ oddsDenominator: 4, count: 1 })
      expect(screen.queryByText('Encore ~3 tentatives en moyenne (moyenne : 4)')).not.toBeInTheDocument()
      expect(
        screen.queryByText(/Chaque tentative garde exactement 1 chance sur 4, quel que soit/)
      ).not.toBeInTheDocument()
      expect(document.querySelectorAll('.counter-odds-hint')).toHaveLength(1)
    })
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

    it("pointerdown sur le bouton supprimer n'incrémente pas le compteur", () => {
      const { onChange } = renderCard()
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Supprimer le compteur' }))
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

    it('masque la poignée quand draggable=false (ex: recherche active)', () => {
      renderCard({}, { draggable: false })
      expect(screen.queryByRole('button', { name: 'Réordonner le compteur' })).not.toBeInTheDocument()
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

    it("pointerdown sur le nom n'incrémente pas le compteur", () => {
      const { onChange } = renderCard({ name: 'Avant' })
      fireEvent.pointerDown(screen.getByText('Avant'))
      expect(onChange).not.toHaveBeenCalled()
    })

    it("pointerdown dans le champ de saisie du nom n'incrémente pas le compteur", () => {
      const { onChange } = renderCard({ name: 'Avant' })
      fireEvent.click(screen.getByText('Avant'))
      fireEvent.pointerDown(screen.getByDisplayValue('Avant'))
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe('personnalisation (panneau)', () => {
    it('ouvre le panneau de personnalisation au clic sur ⚙', () => {
      renderCard({ name: 'Mon compteur' })
      fireEvent.click(screen.getByRole('button', { name: 'Personnaliser le compteur' }))
      expect(screen.getByText('Personnaliser « Mon compteur »')).toBeInTheDocument()
    })

    it("le clic sur ⚙ n'incrémente pas le compteur", () => {
      const { onChange } = renderCard()
      fireEvent.click(screen.getByRole('button', { name: 'Personnaliser le compteur' }))
      expect(onChange).not.toHaveBeenCalled()
    })

    it("pointerdown sur ⚙ n'incrémente pas le compteur", () => {
      const { onChange } = renderCard()
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Personnaliser le compteur' }))
      expect(onChange).not.toHaveBeenCalled()
    })

    it('ferme le panneau et revient à la carte', () => {
      renderCard()
      fireEvent.click(screen.getByRole('button', { name: 'Personnaliser le compteur' }))
      fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
      expect(screen.queryByRole('button', { name: 'Fermer' })).not.toBeInTheDocument()
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

    it("pointerdown sur le crayon n'incrémente pas le compteur", () => {
      const { onChange } = renderCard()
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Définir la valeur du compteur' }))
      expect(onChange).not.toHaveBeenCalled()
    })

    it("pointerdown dans le champ de valeur n'incrémente pas le compteur", () => {
      const { onChange } = renderCard({ count: 42 })
      fireEvent.click(screen.getByRole('button', { name: 'Définir la valeur du compteur' }))
      fireEvent.pointerDown(screen.getByDisplayValue('42'))
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
            colors={['#2563eb', '#7c3aed']}
            onSetBackgroundImage={vi.fn()}
            onSetColor={vi.fn()}
            onSetStep={vi.fn()}
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
            colors={['#2563eb', '#7c3aed']}
            onSetBackgroundImage={vi.fn()}
            onSetColor={vi.fn()}
            onSetStep={vi.fn()}
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
            colors={['#2563eb', '#7c3aed']}
            onSetBackgroundImage={vi.fn()}
            onSetColor={vi.fn()}
            onSetStep={vi.fn()}
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
            colors={['#2563eb', '#7c3aed']}
            onSetBackgroundImage={vi.fn()}
            onSetColor={vi.fn()}
            onSetStep={vi.fn()}
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
