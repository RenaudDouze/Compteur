import { act, fireEvent, render, screen } from '@testing-library/react'
import { Reorder } from 'framer-motion'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CounterCard } from './CounterCard'
import { playDecrementSound, playIncrementSound } from '../sound'
import type { Counter, CounterAppearance, CounterBehavior } from '../types'

vi.mock('../sound', () => ({
  playIncrementSound: vi.fn(),
  playDecrementSound: vi.fn(),
}))

const TEST_COLORS = ['#2563eb', '#7c3aed', '#0d9488']

type CounterOverrides = Partial<Omit<Counter, 'behavior' | 'appearance'>> &
  Partial<CounterBehavior> &
  Partial<CounterAppearance>

function makeCounter(overrides: CounterOverrides = {}): Counter {
  const { oddsDenominator, startDate, step, target, color, displayStyle, backgroundImageUrl, ...rest } = overrides
  return {
    id: 'counter-1',
    name: 'Compteur 1',
    count: 0,
    createdAt: new Date(2026, 7, 1).getTime(),
    ...rest,
    behavior: { oddsDenominator, startDate, step, target },
    appearance: { color: color ?? '#2563eb', displayStyle, backgroundImageUrl },
  }
}

function renderCard(counterOverrides: CounterOverrides = {}, props: Partial<Parameters<typeof CounterCard>[0]> = {}) {
  const counter = makeCounter(counterOverrides)
  const handlers = {
    colors: TEST_COLORS,
    onChange: vi.fn(),
    onSetCount: vi.fn(),
    onUpdate: vi.fn(),
    onDuplicate: vi.fn(),
    onToggleArchive: vi.fn(),
    onTogglePin: vi.fn(),
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

  describe('progression du style anneau', () => {
    it("n'affiche pas de progression sans objectif ni probabilité", () => {
      renderCard({ displayStyle: 'ring' })
      expect(document.querySelector('.value-ring-pct')).not.toBeInTheDocument()
    })

    it("utilise la probabilité pour la progression quand aucun objectif n'est défini", () => {
      renderCard({ displayStyle: 'ring', oddsDenominator: 4, count: 1 })
      expect(document.querySelector('.value-ring-pct')).toHaveTextContent('25 %')
    })

    it("privilégie l'objectif à la probabilité pour la progression quand les deux sont définis", () => {
      renderCard({ displayStyle: 'ring', target: 20, count: 5, oddsDenominator: 4 })
      expect(document.querySelector('.value-ring-pct')).toHaveTextContent('25 %')
    })
  })

  describe('suppression', () => {
    // Le double-clic de confirmation lui-même est testé dans
    // CounterActionsPanel.test.tsx : ici on vérifie seulement que la carte
    // relie bien `onDelete` à la modale Actions qui le porte désormais.
    it('supprime via la modale Actions après double confirmation', () => {
      const { onDelete } = renderCard()
      fireEvent.click(screen.getByRole('button', { name: 'Actions du compteur' }))
      fireEvent.click(screen.getByText('Supprimer ce compteur'))
      fireEvent.click(screen.getByText('Confirmer la suppression'))
      expect(onDelete).toHaveBeenCalledTimes(1)
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
    it("ouvre directement le champ de nom en édition si autoEdit est activé", () => {
      renderCard({ name: 'Nouveau' }, { autoEdit: true })
      expect(screen.getByDisplayValue('Nouveau')).toBeInTheDocument()
    })

    it("n'ouvre pas le champ de nom par défaut", () => {
      renderCard({ name: 'Existant' })
      expect(screen.queryByDisplayValue('Existant')).not.toBeInTheDocument()
      expect(screen.getByText('Existant')).toBeInTheDocument()
    })

    it('ouvre un champ pré-rempli au clic sur le nom', () => {
      renderCard({ name: 'Avant' })
      fireEvent.click(screen.getByText('Avant'))
      expect(screen.getByDisplayValue('Avant')).toBeInTheDocument()
    })

    it('valide le nouveau nom avec Entrée', () => {
      const { onUpdate } = renderCard({ name: 'Avant' })
      fireEvent.click(screen.getByText('Avant'))
      const input = screen.getByDisplayValue('Avant')
      fireEvent.change(input, { target: { value: 'Après' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onUpdate).toHaveBeenCalledWith({ name: 'Après' })
    })

    it('supprime les espaces superflus', () => {
      const { onUpdate } = renderCard({ name: 'Avant' })
      fireEvent.click(screen.getByText('Avant'))
      const input = screen.getByDisplayValue('Avant')
      fireEvent.change(input, { target: { value: '   Espacé   ' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onUpdate).toHaveBeenCalledWith({ name: 'Espacé' })
    })

    it('retombe sur "Sans nom" si le champ est vide', () => {
      const { onUpdate } = renderCard({ name: 'Avant' })
      fireEvent.click(screen.getByText('Avant'))
      const input = screen.getByDisplayValue('Avant')
      fireEvent.change(input, { target: { value: '   ' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onUpdate).toHaveBeenCalledWith({ name: 'Sans nom' })
    })

    it('annule avec Échap sans appeler onUpdate', () => {
      const { onUpdate } = renderCard({ name: 'Avant' })
      fireEvent.click(screen.getByText('Avant'))
      const input = screen.getByDisplayValue('Avant')
      fireEvent.change(input, { target: { value: 'Modifié' } })
      fireEvent.keyDown(input, { key: 'Escape' })
      expect(onUpdate).not.toHaveBeenCalled()
      expect(screen.getByText('Avant')).toBeInTheDocument()
    })

    it('valide aussi au blur', () => {
      const { onUpdate } = renderCard({ name: 'Avant' })
      fireEvent.click(screen.getByText('Avant'))
      const input = screen.getByDisplayValue('Avant')
      fireEvent.change(input, { target: { value: 'ParBlur' } })
      fireEvent.blur(input)
      expect(onUpdate).toHaveBeenCalledWith({ name: 'ParBlur' })
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

    it('ouvre le panneau "Valeur & réglages" depuis la personnalisation', () => {
      renderCard({ name: 'Mon compteur' })
      fireEvent.click(screen.getByRole('button', { name: 'Personnaliser le compteur' }))
      fireEvent.click(screen.getByRole('button', { name: 'Valeur & réglages' }))
      expect(screen.getByText('Valeur & réglages « Mon compteur »')).toBeInTheDocument()
    })

  })

  describe('icônes d\'accès direct (comportement, actions)', () => {
    it('ouvre directement le panneau "Valeur & réglages" au clic sur ±', () => {
      renderCard({ name: 'Mon compteur' })
      fireEvent.click(screen.getByRole('button', { name: 'Régler le comportement du compteur' }))
      expect(screen.getByText('Valeur & réglages « Mon compteur »')).toBeInTheDocument()
    })

    it("le clic sur ± n'incrémente pas le compteur", () => {
      const { onChange } = renderCard()
      fireEvent.click(screen.getByRole('button', { name: 'Régler le comportement du compteur' }))
      expect(onChange).not.toHaveBeenCalled()
    })

    it("pointerdown sur ± n'incrémente pas le compteur", () => {
      const { onChange } = renderCard()
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Régler le comportement du compteur' }))
      expect(onChange).not.toHaveBeenCalled()
    })

    it('ouvre directement le panneau "Actions" au clic sur ⋯', () => {
      renderCard({ name: 'Mon compteur' })
      fireEvent.click(screen.getByRole('button', { name: 'Actions du compteur' }))
      expect(screen.getByText('Actions « Mon compteur »')).toBeInTheDocument()
    })

    it("le clic sur ⋯ n'incrémente pas le compteur", () => {
      const { onChange } = renderCard()
      fireEvent.click(screen.getByRole('button', { name: 'Actions du compteur' }))
      expect(onChange).not.toHaveBeenCalled()
    })

    it("pointerdown sur ⋯ n'incrémente pas le compteur", () => {
      const { onChange } = renderCard()
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Actions du compteur' }))
      expect(onChange).not.toHaveBeenCalled()
    })
  })

  describe("style d'affichage", () => {
    it("rend l'odomètre par défaut sans classe modificatrice, sans style d'affichage défini", () => {
      renderCard({ count: 3 })
      const valueEl = document.querySelector('.counter-value')
      expect(valueEl?.className).toBe('counter-value')
      expect(document.querySelector('.odometer')).toBeInTheDocument()
    })

    it("rend l'odomètre avec la classe modificatrice quand le style est explicitement 'default'", () => {
      renderCard({ count: 3, displayStyle: 'default' })
      const valueEl = document.querySelector('.counter-value')
      expect(valueEl?.className).toBe('counter-value counter-value--default')
      expect(document.querySelector('.odometer')).toBeInTheDocument()
    })

    it('rend le style choisi avec sa classe modificatrice sur .counter-value', () => {
      renderCard({ count: 247, displayStyle: 'flap' })
      const valueEl = document.querySelector('.counter-value')
      expect(valueEl?.className).toBe('counter-value counter-value--flap')
      expect(document.querySelectorAll('.value-flap-tile')).toHaveLength(3)
    })

    it("ne calcule pas de taille de police en mode fill pour un style autre que 'default'", () => {
      const widthSpy = vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(320)
      const heightSpy = vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(480)
      renderCard({ count: 12, displayStyle: 'flap' }, { fill: true })
      const valueEl = document.querySelector('.counter-value') as HTMLElement
      expect(valueEl.style.fontSize).toBe('')
      widthSpy.mockRestore()
      heightSpy.mockRestore()
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
            onUpdate={vi.fn()}
            colors={['#2563eb', '#7c3aed']}
            onDuplicate={vi.fn()}
            onToggleArchive={vi.fn()}
            onTogglePin={vi.fn()}
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
            onUpdate={vi.fn()}
            colors={['#2563eb', '#7c3aed']}
            onDuplicate={vi.fn()}
            onToggleArchive={vi.fn()}
            onTogglePin={vi.fn()}
            onDelete={vi.fn()}
          />
        </Reorder.Group>
      )
      expect(screen.getByText('2')).toBeInTheDocument()
    })
  })

  describe('son de comptage', () => {
    beforeEach(() => {
      vi.mocked(playIncrementSound).mockClear()
      vi.mocked(playDecrementSound).mockClear()
    })

    it('ne joue aucun son au montage initial', () => {
      renderCard({ count: 3 })
      expect(playIncrementSound).not.toHaveBeenCalled()
      expect(playDecrementSound).not.toHaveBeenCalled()
    })

    it("joue un son après l'incrémentation, une fois la nouvelle valeur affichée (pas au clic)", () => {
      const counter = makeCounter({ count: 1 })
      const { rerender } = render(
        <Reorder.Group as="div" values={[counter]} onReorder={() => {}}>
          <CounterCard
            counter={counter}
            onChange={vi.fn()}
            onSetCount={vi.fn()}
            onUpdate={vi.fn()}
            colors={['#2563eb', '#7c3aed']}
            onDuplicate={vi.fn()}
            onToggleArchive={vi.fn()}
            onTogglePin={vi.fn()}
            onDelete={vi.fn()}
          />
        </Reorder.Group>
      )
      fireEvent.click(screen.getByRole('button', { name: 'Incrémenter' }))
      // Le clic seul (onChange mocké, ne met pas à jour `counter.count`) ne
      // doit pas encore avoir déclenché le son.
      expect(playIncrementSound).not.toHaveBeenCalled()

      const updated = { ...counter, count: 2 }
      rerender(
        <Reorder.Group as="div" values={[updated]} onReorder={() => {}}>
          <CounterCard
            counter={updated}
            onChange={vi.fn()}
            onSetCount={vi.fn()}
            onUpdate={vi.fn()}
            colors={['#2563eb', '#7c3aed']}
            onDuplicate={vi.fn()}
            onToggleArchive={vi.fn()}
            onTogglePin={vi.fn()}
            onDelete={vi.fn()}
          />
        </Reorder.Group>
      )
      expect(playIncrementSound).toHaveBeenCalledTimes(1)
    })

    it("joue le son de décrémentation (pas celui d'incrémentation) après une décrémentation", () => {
      const counter = makeCounter({ count: 2 })
      const { rerender } = render(
        <Reorder.Group as="div" values={[counter]} onReorder={() => {}}>
          <CounterCard
            counter={counter}
            onChange={vi.fn()}
            onSetCount={vi.fn()}
            onUpdate={vi.fn()}
            colors={['#2563eb', '#7c3aed']}
            onDuplicate={vi.fn()}
            onToggleArchive={vi.fn()}
            onTogglePin={vi.fn()}
            onDelete={vi.fn()}
          />
        </Reorder.Group>
      )
      fireEvent.click(screen.getByRole('button', { name: 'Décrémenter' }))
      const updated = { ...counter, count: 1 }
      rerender(
        <Reorder.Group as="div" values={[updated]} onReorder={() => {}}>
          <CounterCard
            counter={updated}
            onChange={vi.fn()}
            onSetCount={vi.fn()}
            onUpdate={vi.fn()}
            colors={['#2563eb', '#7c3aed']}
            onDuplicate={vi.fn()}
            onToggleArchive={vi.fn()}
            onTogglePin={vi.fn()}
            onDelete={vi.fn()}
          />
        </Reorder.Group>
      )
      expect(playDecrementSound).toHaveBeenCalledTimes(1)
      expect(playIncrementSound).not.toHaveBeenCalled()
    })

    it('joue un son quel que soit le style d\'affichage (pas réservé au style par défaut)', () => {
      const counter = makeCounter({ count: 1, displayStyle: 'flap' })
      const { rerender } = render(
        <Reorder.Group as="div" values={[counter]} onReorder={() => {}}>
          <CounterCard
            counter={counter}
            onChange={vi.fn()}
            onSetCount={vi.fn()}
            onUpdate={vi.fn()}
            colors={['#2563eb', '#7c3aed']}
            onDuplicate={vi.fn()}
            onToggleArchive={vi.fn()}
            onTogglePin={vi.fn()}
            onDelete={vi.fn()}
          />
        </Reorder.Group>
      )
      fireEvent.click(screen.getByRole('button', { name: 'Incrémenter' }))
      const updated = { ...counter, count: 2 }
      rerender(
        <Reorder.Group as="div" values={[updated]} onReorder={() => {}}>
          <CounterCard
            counter={updated}
            onChange={vi.fn()}
            onSetCount={vi.fn()}
            onUpdate={vi.fn()}
            colors={['#2563eb', '#7c3aed']}
            onDuplicate={vi.fn()}
            onToggleArchive={vi.fn()}
            onTogglePin={vi.fn()}
            onDelete={vi.fn()}
          />
        </Reorder.Group>
      )
      expect(playIncrementSound).toHaveBeenCalledTimes(1)
    })

    it('déduit le sens depuis une nouvelle valeur définie via la modale Valeur & réglages (augmentation → son joué)', () => {
      const counter = makeCounter({ count: 1 })
      const { rerender } = render(
        <Reorder.Group as="div" values={[counter]} onReorder={() => {}}>
          <CounterCard
            counter={counter}
            onChange={vi.fn()}
            onSetCount={vi.fn()}
            onUpdate={vi.fn()}
            colors={['#2563eb', '#7c3aed']}
            onDuplicate={vi.fn()}
            onToggleArchive={vi.fn()}
            onTogglePin={vi.fn()}
            onDelete={vi.fn()}
          />
        </Reorder.Group>
      )
      fireEvent.click(screen.getByRole('button', { name: 'Régler le comportement du compteur' }))
      const input = screen.getByDisplayValue('1')
      fireEvent.change(input, { target: { value: '5' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      const updated = { ...counter, count: 5 }
      rerender(
        <Reorder.Group as="div" values={[updated]} onReorder={() => {}}>
          <CounterCard
            counter={updated}
            onChange={vi.fn()}
            onSetCount={vi.fn()}
            onUpdate={vi.fn()}
            colors={['#2563eb', '#7c3aed']}
            onDuplicate={vi.fn()}
            onToggleArchive={vi.fn()}
            onTogglePin={vi.fn()}
            onDelete={vi.fn()}
          />
        </Reorder.Group>
      )
      expect(playIncrementSound).toHaveBeenCalledTimes(1)
    })

    it('déduit le sens depuis une nouvelle valeur définie via la modale Valeur & réglages (diminution → son de décrémentation)', () => {
      const counter = makeCounter({ count: 5 })
      const { rerender } = render(
        <Reorder.Group as="div" values={[counter]} onReorder={() => {}}>
          <CounterCard
            counter={counter}
            onChange={vi.fn()}
            onSetCount={vi.fn()}
            onUpdate={vi.fn()}
            colors={['#2563eb', '#7c3aed']}
            onDuplicate={vi.fn()}
            onToggleArchive={vi.fn()}
            onTogglePin={vi.fn()}
            onDelete={vi.fn()}
          />
        </Reorder.Group>
      )
      fireEvent.click(screen.getByRole('button', { name: 'Régler le comportement du compteur' }))
      const input = screen.getByDisplayValue('5')
      fireEvent.change(input, { target: { value: '1' } })
      fireEvent.keyDown(input, { key: 'Enter' })

      const updated = { ...counter, count: 1 }
      rerender(
        <Reorder.Group as="div" values={[updated]} onReorder={() => {}}>
          <CounterCard
            counter={updated}
            onChange={vi.fn()}
            onSetCount={vi.fn()}
            onUpdate={vi.fn()}
            colors={['#2563eb', '#7c3aed']}
            onDuplicate={vi.fn()}
            onToggleArchive={vi.fn()}
            onTogglePin={vi.fn()}
            onDelete={vi.fn()}
          />
        </Reorder.Group>
      )
      expect(playDecrementSound).toHaveBeenCalledTimes(1)
      expect(playIncrementSound).not.toHaveBeenCalled()
    })
  })

  describe('épinglage', () => {
    it('affiche un repère quand le compteur est épinglé', () => {
      renderCard({ pinned: true })
      expect(document.querySelector('.counter-pin-badge')).toBeInTheDocument()
    })

    it("n'affiche pas de repère quand le compteur n'est pas épinglé", () => {
      renderCard({ pinned: false })
      expect(document.querySelector('.counter-pin-badge')).not.toBeInTheDocument()
    })
  })

  describe("célébration à l'atteinte de l'objectif", () => {
    it('affiche un confetti quand le compte franchit l\'objectif en incrémentant', () => {
      const { rerender, counter, ...handlers } = renderCard({ target: 5, count: 4 })
      const updated = { ...counter, count: 5 }
      rerender(
        <Reorder.Group as="div" values={[updated]} onReorder={() => {}}>
          <CounterCard counter={updated} {...handlers} />
        </Reorder.Group>
      )
      expect(document.querySelector('.counter-celebration')).toBeInTheDocument()
      expect(screen.getByText('Objectif atteint')).toBeInTheDocument()
    })

    it('ne célèbre pas au montage même si le compte est déjà à l\'objectif', () => {
      renderCard({ target: 5, count: 5 })
      expect(document.querySelector('.counter-celebration')).not.toBeInTheDocument()
    })

    it("ne célèbre pas sans objectif défini", () => {
      const { rerender, counter, ...handlers } = renderCard({ count: 4 })
      const updated = { ...counter, count: 5 }
      rerender(
        <Reorder.Group as="div" values={[updated]} onReorder={() => {}}>
          <CounterCard counter={updated} {...handlers} />
        </Reorder.Group>
      )
      expect(document.querySelector('.counter-celebration')).not.toBeInTheDocument()
    })

    it('ne célèbre pas en décrémentant sous l\'objectif', () => {
      const { rerender, counter, ...handlers } = renderCard({ target: 5, count: 6 })
      const updated = { ...counter, count: 5 }
      rerender(
        <Reorder.Group as="div" values={[updated]} onReorder={() => {}}>
          <CounterCard counter={updated} {...handlers} />
        </Reorder.Group>
      )
      expect(document.querySelector('.counter-celebration')).not.toBeInTheDocument()
    })

    it("ne re-célèbre pas en continuant d'incrémenter au-delà d'un objectif déjà atteint", () => {
      const { rerender, counter, ...handlers } = renderCard({ target: 5, count: 5 })
      const updated = { ...counter, count: 6 }
      rerender(
        <Reorder.Group as="div" values={[updated]} onReorder={() => {}}>
          <CounterCard counter={updated} {...handlers} />
        </Reorder.Group>
      )
      expect(document.querySelector('.counter-celebration')).not.toBeInTheDocument()
    })

    it('célèbre à nouveau après être repassé sous l\'objectif puis l\'avoir de nouveau atteint', () => {
      const { rerender, counter, ...handlers } = renderCard({ target: 5, count: 4 })
      const wrap = (c: Counter) => (
        <Reorder.Group as="div" values={[c]} onReorder={() => {}}>
          <CounterCard counter={c} {...handlers} />
        </Reorder.Group>
      )
      rerender(wrap({ ...counter, count: 5 }))
      rerender(wrap({ ...counter, count: 4 }))
      rerender(wrap({ ...counter, count: 5 }))
      expect(document.querySelector('.counter-celebration')).toBeInTheDocument()
    })

    it("gère un pas d'incrément qui saute par-dessus l'objectif sans tomber pile dessus", () => {
      const { rerender, counter, ...handlers } = renderCard({ target: 10, count: 9, step: 3 })
      const updated = { ...counter, count: 12 }
      rerender(
        <Reorder.Group as="div" values={[updated]} onReorder={() => {}}>
          <CounterCard counter={updated} {...handlers} />
        </Reorder.Group>
      )
      expect(document.querySelector('.counter-celebration')).toBeInTheDocument()
    })

    it('masque le confetti après le délai', () => {
      const { rerender, counter, ...handlers } = renderCard({ target: 5, count: 4 })
      const updated = { ...counter, count: 5 }
      rerender(
        <Reorder.Group as="div" values={[updated]} onReorder={() => {}}>
          <CounterCard counter={updated} {...handlers} />
        </Reorder.Group>
      )
      expect(document.querySelector('.counter-celebration')).toBeInTheDocument()
      act(() => {
        vi.advanceTimersByTime(1200)
      })
      expect(document.querySelector('.counter-celebration')).not.toBeInTheDocument()
    })
  })

  it('applique la couleur du compteur en variable CSS --accent', () => {
    renderCard({ color: '#16a34a' })
    const card = screen.getByRole('button', { name: 'Incrémenter Compteur 1' })
    expect(card.style.getPropertyValue('--accent')).toBe('#16a34a')
  })

  describe('compteur archivé (lecture seule)', () => {
    it("n'incrémente pas au clic sur la carte", () => {
      const { onChange } = renderCard({ archived: true })
      fireEvent.click(screen.getByRole('button', { name: /Compteur 1/ }))
      expect(onChange).not.toHaveBeenCalled()
    })

    it("n'incrémente pas via les boutons +/-, qui sont désactivés", () => {
      const { onChange } = renderCard({ archived: true })
      expect(screen.getByRole('button', { name: 'Incrémenter' })).toBeDisabled()
      expect(screen.getByRole('button', { name: 'Décrémenter' })).toBeDisabled()
      fireEvent.click(screen.getByRole('button', { name: 'Incrémenter' }))
      fireEvent.click(screen.getByRole('button', { name: 'Décrémenter' }))
      expect(onChange).not.toHaveBeenCalled()
    })

    it("n'incrémente pas via le clavier", () => {
      const { onChange } = renderCard({ archived: true })
      fireEvent.keyDown(screen.getByRole('button', { name: /Compteur 1/ }), { key: 'ArrowUp' })
      expect(onChange).not.toHaveBeenCalled()
    })

    it('ne passe pas en mode renommage au clic sur le nom', () => {
      renderCard({ archived: true, name: 'Figé' })
      fireEvent.click(screen.getByText('Figé'))
      expect(screen.queryByDisplayValue('Figé')).not.toBeInTheDocument()
    })

    it('masque la poignée de glisser', () => {
      renderCard({ archived: true })
      expect(document.querySelector('.counter-drag-handle')).not.toBeInTheDocument()
    })

    it('adapte le libellé accessible de la carte', () => {
      renderCard({ archived: true, name: 'Figé' })
      expect(screen.getByRole('button', { name: 'Figé, archivé, lecture seule' })).toBeInTheDocument()
    })

    it('laisse les icônes de réglage accessibles (personnalisation, comportement, actions)', () => {
      renderCard({ archived: true, name: 'Figé' })
      fireEvent.click(screen.getByRole('button', { name: 'Actions du compteur' }))
      expect(screen.getByText('Actions « Figé »')).toBeInTheDocument()
    })

    describe('durée totale', () => {
      it("affiche la durée totale entre le début du comptage et l'archivage", () => {
        renderCard({ archived: true, archivedAt: new Date(2026, 7, 10).getTime() })
        expect(screen.getByText(/Durée totale : /)).toBeInTheDocument()
        expect(screen.getByText(/9 jours/)).toBeInTheDocument()
      })

      it('utilise la date de début personnalisée plutôt que la date de création si définie', () => {
        renderCard({ archived: true, startDate: '2026-08-05', archivedAt: new Date(2026, 7, 10).getTime() })
        expect(screen.getByText(/5 jours/)).toBeInTheDocument()
      })

      it("n'affiche pas de durée si archivedAt est absent (compteur archivé avant l'ajout de ce champ)", () => {
        renderCard({ archived: true, archivedAt: undefined })
        expect(screen.queryByText(/Durée totale/)).not.toBeInTheDocument()
      })

      it("n'affiche pas de durée pour un compteur actif même avec un archivedAt résiduel", () => {
        renderCard({ archived: false, archivedAt: new Date(2026, 7, 10).getTime() })
        expect(screen.queryByText(/Durée totale/)).not.toBeInTheDocument()
      })

      it("affiche la moyenne d'incrément par jour", () => {
        renderCard({ archived: true, count: 90, archivedAt: new Date(2026, 7, 10).getTime() })
        expect(screen.getByText(/Moyenne : 10 \/ jour/)).toBeInTheDocument()
      })

      it("n'affiche pas de moyenne si archivedAt est absent", () => {
        renderCard({ archived: true, count: 90, archivedAt: undefined })
        expect(screen.queryByText(/Moyenne : /)).not.toBeInTheDocument()
      })
    })
  })

  describe('affichage du pas sur les boutons +/-', () => {
    it('affiche le pas par défaut (1) sur les boutons', () => {
      renderCard()
      expect(screen.getByRole('button', { name: 'Incrémenter' })).toHaveTextContent('+1')
      expect(screen.getByRole('button', { name: 'Décrémenter' })).toHaveTextContent('−1')
    })

    it('affiche le pas personnalisé sur les boutons', () => {
      renderCard({ step: 5 })
      expect(screen.getByRole('button', { name: 'Incrémenter' })).toHaveTextContent('+5')
      expect(screen.getByRole('button', { name: 'Décrémenter' })).toHaveTextContent('−5')
    })
  })
})
