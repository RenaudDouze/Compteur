import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CounterSettingsPanel } from './CounterSettingsPanel'
import type { Counter } from '../types'

const realNavigator = window.navigator
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

function renderPanel(
  counterOverrides: Partial<Counter> = {},
  props: Partial<Parameters<typeof CounterSettingsPanel>[0]> = {}
) {
  const counter = makeCounter(counterOverrides)
  const handlers = {
    colors: TEST_COLORS,
    onClose: vi.fn(),
    onSetOdds: vi.fn(),
    onSetStartDate: vi.fn(),
    onSetBackgroundImage: vi.fn(),
    onSetColor: vi.fn(),
    onSetStep: vi.fn(),
    ...props,
  }
  const utils = render(<CounterSettingsPanel counter={counter} {...handlers} {...props} />)
  return { counter, ...handlers, ...utils }
}

describe('CounterSettingsPanel', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('affiche le nom du compteur dans le titre', () => {
    renderPanel({ name: 'Mon compteur' })
    expect(screen.getByText('Personnaliser « Mon compteur »')).toBeInTheDocument()
  })

  it('ferme au clic sur la croix', () => {
    const { onClose } = renderPanel()
    fireEvent.click(screen.getByRole('button', { name: 'Fermer' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("ferme au clic sur l'arrière-plan", () => {
    // Le panneau est monté via un portail dans document.body : le conteneur
    // de rendu de RTL ne le contient pas, il faut interroger le document.
    const { onClose } = renderPanel()
    fireEvent.click(document.querySelector('.modal-overlay')!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("ne ferme pas au clic à l'intérieur du panneau", () => {
    const { onClose } = renderPanel()
    fireEvent.click(document.querySelector('.modal-panel')!)
    expect(onClose).not.toHaveBeenCalled()
  })

  it("un pointerdown à l'intérieur du panneau ne remonte pas plus haut dans le document (le panneau est un portail : sans ce blocage, il atteindrait quand même le suivi de tap de la carte via l'arbre React)", () => {
    const outerHandler = vi.fn()
    document.addEventListener('pointerdown', outerHandler)
    renderPanel()
    fireEvent.pointerDown(document.querySelector('.modal-panel')!)
    document.removeEventListener('pointerdown', outerHandler)
    expect(outerHandler).not.toHaveBeenCalled()
  })

  it("un pointerdown sur l'arrière-plan du panneau ne remonte pas plus haut dans le document", () => {
    const outerHandler = vi.fn()
    document.addEventListener('pointerdown', outerHandler)
    renderPanel()
    fireEvent.pointerDown(document.querySelector('.modal-overlay')!)
    document.removeEventListener('pointerdown', outerHandler)
    expect(outerHandler).not.toHaveBeenCalled()
  })

  it('ferme avec la touche Échap', () => {
    const { onClose } = renderPanel()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("n'écoute plus Échap après démontage", () => {
    const { onClose, unmount } = renderPanel()
    unmount()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
  })

  describe('couleur', () => {
    it('affiche une option par couleur de la palette', () => {
      renderPanel()
      TEST_COLORS.forEach((c) => {
        expect(screen.getByRole('button', { name: `Choisir la couleur ${c}` })).toBeInTheDocument()
      })
    })

    it('marque la couleur actuellement sélectionnée', () => {
      renderPanel({ color: TEST_COLORS[1] })
      const selected = screen.getByRole('button', { name: `Choisir la couleur ${TEST_COLORS[1]}` })
      expect(selected.className).toContain('selected')
      const other = screen.getByRole('button', { name: `Choisir la couleur ${TEST_COLORS[0]}` })
      expect(other.className).not.toContain('selected')
    })

    it('choisit une couleur de la palette', () => {
      const { onSetColor } = renderPanel({ color: TEST_COLORS[0] })
      fireEvent.click(screen.getByRole('button', { name: `Choisir la couleur ${TEST_COLORS[1]}` }))
      expect(onSetColor).toHaveBeenCalledWith(TEST_COLORS[1])
    })

    it('reste ouvert après avoir choisi une couleur', () => {
      const { onClose } = renderPanel()
      fireEvent.click(screen.getByRole('button', { name: `Choisir la couleur ${TEST_COLORS[1]}` }))
      expect(onClose).not.toHaveBeenCalled()
    })
  })

  describe("pas d'incrément", () => {
    it('préremplit le champ avec le pas actuel', () => {
      renderPanel({ step: 5 })
      expect(screen.getByDisplayValue('5')).toBeInTheDocument()
    })

    it('champ vide sans pas personnalisé', () => {
      renderPanel()
      const input = screen.getByPlaceholderText('1') as HTMLInputElement
      expect(input.value).toBe('')
    })

    it('définit un pas personnalisé (Entrée)', () => {
      const { onSetStep } = renderPanel()
      const input = screen.getByPlaceholderText('1')
      fireEvent.change(input, { target: { value: '5' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetStep).toHaveBeenCalledWith(5)
    })

    it('valide aussi au blur', () => {
      const { onSetStep } = renderPanel()
      const input = screen.getByPlaceholderText('1')
      fireEvent.change(input, { target: { value: '10' } })
      fireEvent.blur(input)
      expect(onSetStep).toHaveBeenCalledWith(10)
    })

    it('ignore les caractères non numériques dans la saisie', () => {
      const { onSetStep } = renderPanel()
      const input = screen.getByPlaceholderText('1')
      fireEvent.change(input, { target: { value: '1a0b' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetStep).toHaveBeenCalledWith(10)
    })

    it('revient au pas par défaut si la saisie est vide', () => {
      const { onSetStep } = renderPanel({ step: 5 })
      const input = screen.getByDisplayValue('5')
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetStep).toHaveBeenCalledWith(undefined)
    })

    it('revient au pas par défaut si la saisie est 0', () => {
      const { onSetStep } = renderPanel({ step: 5 })
      const input = screen.getByDisplayValue('5')
      fireEvent.change(input, { target: { value: '0' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetStep).toHaveBeenCalledWith(undefined)
    })

    it("ne commite pas sur une touche autre qu'Entrée", () => {
      const { onSetStep } = renderPanel()
      const input = screen.getByPlaceholderText('1')
      fireEvent.change(input, { target: { value: '5' } })
      fireEvent.keyDown(input, { key: 'a' })
      expect(onSetStep).not.toHaveBeenCalled()
    })

    it('affiche un rappel du pas effectif (défaut 1)', () => {
      renderPanel()
      expect(screen.getByText('+1 / −1 à chaque appui')).toBeInTheDocument()
    })

    it('affiche un rappel du pas effectif personnalisé', () => {
      renderPanel({ step: 5 })
      expect(screen.getByText('+5 / −5 à chaque appui')).toBeInTheDocument()
    })
  })

  describe('image de fond', () => {
    it('préremplit le champ avec l\'URL actuelle', () => {
      renderPanel({ backgroundImageUrl: 'https://exemple.com/actuel.jpg' })
      expect(screen.getByDisplayValue('https://exemple.com/actuel.jpg')).toBeInTheDocument()
    })

    it('champ vide sans image définie', () => {
      renderPanel()
      const input = screen.getByPlaceholderText('https://exemple.com/image.jpg') as HTMLInputElement
      expect(input.value).toBe('')
    })

    it('définit une image de fond avec une URL http(s) valide (Entrée)', () => {
      const { onSetBackgroundImage } = renderPanel()
      const input = screen.getByPlaceholderText('https://exemple.com/image.jpg')
      fireEvent.change(input, { target: { value: 'https://exemple.com/photo.png' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetBackgroundImage).toHaveBeenCalledWith('https://exemple.com/photo.png')
    })

    it('valide aussi au blur', () => {
      const { onSetBackgroundImage } = renderPanel()
      const input = screen.getByPlaceholderText('https://exemple.com/image.jpg')
      fireEvent.change(input, { target: { value: 'https://exemple.com/blur.jpg' } })
      fireEvent.blur(input)
      expect(onSetBackgroundImage).toHaveBeenCalledWith('https://exemple.com/blur.jpg')
    })

    it('ignore une URL invalide et conserve la valeur précédente', () => {
      const { onSetBackgroundImage } = renderPanel({ backgroundImageUrl: 'https://exemple.com/ancien.jpg' })
      const input = screen.getByDisplayValue('https://exemple.com/ancien.jpg')
      fireEvent.change(input, { target: { value: 'pas-une-url' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetBackgroundImage).not.toHaveBeenCalled()
      expect(screen.getByDisplayValue('https://exemple.com/ancien.jpg')).toBeInTheDocument()
    })

    it('efface l\'image de fond si la saisie est vidée', () => {
      const { onSetBackgroundImage } = renderPanel({ backgroundImageUrl: 'https://exemple.com/ancien.jpg' })
      const input = screen.getByDisplayValue('https://exemple.com/ancien.jpg')
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetBackgroundImage).toHaveBeenCalledWith(undefined)
    })

    it("ignore une URL invalide en repartant d'aucune image définie", () => {
      const { onSetBackgroundImage } = renderPanel()
      const input = screen.getByPlaceholderText('https://exemple.com/image.jpg')
      fireEvent.change(input, { target: { value: 'pas-une-url' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetBackgroundImage).not.toHaveBeenCalled()
      expect((input as HTMLInputElement).value).toBe('')
    })

    it("ne commite pas sur une touche autre qu'Entrée", () => {
      const { onSetBackgroundImage } = renderPanel()
      const input = screen.getByPlaceholderText('https://exemple.com/image.jpg')
      fireEvent.change(input, { target: { value: 'https://exemple.com/photo.png' } })
      fireEvent.keyDown(input, { key: 'a' })
      expect(onSetBackgroundImage).not.toHaveBeenCalled()
    })
  })

  describe('probabilité', () => {
    it('préremplit le champ avec la probabilité actuelle', () => {
      renderPanel({ oddsDenominator: 4096 })
      expect(screen.getByDisplayValue('4096')).toBeInTheDocument()
    })

    it('définit une probabilité (Entrée)', () => {
      const { onSetOdds } = renderPanel({ count: 500 })
      const input = screen.getByPlaceholderText('4096')
      fireEvent.change(input, { target: { value: '4096' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetOdds).toHaveBeenCalledWith(4096)
    })

    it('valide aussi au blur', () => {
      const { onSetOdds } = renderPanel()
      const input = screen.getByPlaceholderText('4096')
      fireEvent.change(input, { target: { value: '20' } })
      fireEvent.blur(input)
      expect(onSetOdds).toHaveBeenCalledWith(20)
    })

    it('ignore les caractères non numériques dans la saisie', () => {
      const { onSetOdds } = renderPanel()
      const input = screen.getByPlaceholderText('4096')
      fireEvent.change(input, { target: { value: '4a0b9c6' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetOdds).toHaveBeenCalledWith(4096)
    })

    it('efface la probabilité si la saisie est vide', () => {
      const { onSetOdds } = renderPanel({ oddsDenominator: 10 })
      const input = screen.getByDisplayValue('10')
      fireEvent.change(input, { target: { value: '' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetOdds).toHaveBeenCalledWith(undefined)
    })

    it('efface la probabilité si la saisie est 0', () => {
      const { onSetOdds } = renderPanel({ oddsDenominator: 10 })
      const input = screen.getByDisplayValue('10')
      fireEvent.change(input, { target: { value: '0' } })
      fireEvent.keyDown(input, { key: 'Enter' })
      expect(onSetOdds).toHaveBeenCalledWith(undefined)
    })

    it("ne commite pas sur une touche autre qu'Entrée", () => {
      const { onSetOdds } = renderPanel()
      const input = screen.getByPlaceholderText('4096')
      fireEvent.change(input, { target: { value: '20' } })
      fireEvent.keyDown(input, { key: 'a' })
      expect(onSetOdds).not.toHaveBeenCalled()
    })

    it('affiche le taux de réussite cumulé quand une probabilité est définie', () => {
      renderPanel({ count: 500, oddsDenominator: 4096 })
      expect(screen.getByText(/de l'avoir obtenu avant ce stade/)).toBeInTheDocument()
    })

    it("n'affiche pas de taux de réussite sans probabilité définie", () => {
      renderPanel()
      expect(screen.queryByText(/de l'avoir obtenu avant ce stade/)).not.toBeInTheDocument()
    })

    it("n'affiche pas les stats complémentaires sans probabilité définie", () => {
      renderPanel()
      expect(document.querySelector('.odds-progress')).not.toBeInTheDocument()
      expect(screen.queryByText(/en moyenne/)).not.toBeInTheDocument()
      expect(screen.queryByText(/chance sur .* quel que soit/)).not.toBeInTheDocument()
    })

    it('affiche la barre de progression vers la moyenne', () => {
      renderPanel({ count: 1024, oddsDenominator: 4096 })
      const bar = document.querySelector('.odds-progress')
      expect(bar).toHaveAttribute('aria-valuenow', '25')
      expect(document.querySelector('.odds-progress-fill')).toHaveStyle({ width: '25%' })
    })

    it('plafonne la barre à 100% quand la moyenne est dépassée', () => {
      renderPanel({ count: 6000, oddsDenominator: 4096 })
      const bar = document.querySelector('.odds-progress')
      expect(bar).toHaveAttribute('aria-valuenow', '100')
      expect(document.querySelector('.odds-progress-fill')).toHaveStyle({ width: '100%' })
    })

    it("indique le nombre de tentatives restantes en moyenne (pluriel)", () => {
      renderPanel({ count: 4000, oddsDenominator: 4096 })
      expect(screen.getByText(/Encore ~96 tentatives en moyenne \(moyenne : 4 096\)/)).toBeInTheDocument()
    })

    it("indique le nombre de tentatives restantes en moyenne (singulier)", () => {
      renderPanel({ count: 4095, oddsDenominator: 4096 })
      expect(screen.getByText(/Encore ~1 tentative en moyenne/)).toBeInTheDocument()
    })

    it('indique que la moyenne est exactement atteinte', () => {
      renderPanel({ count: 4096, oddsDenominator: 4096 })
      expect(screen.getByText(/Moyenne dépassée \(4 096 \/ 4 096\)/)).toBeInTheDocument()
    })

    it('indique que la moyenne est dépassée', () => {
      renderPanel({ count: 5000, oddsDenominator: 4096 })
      expect(screen.getByText(/Moyenne dépassée \(5 000 \/ 4 096\) — la chance cumulée compense/)).toBeInTheDocument()
    })

    it('rappelle que la chance par tentative reste constante', () => {
      renderPanel({ count: 10, oddsDenominator: 4096 })
      expect(
        screen.getByText(/Chaque tentative garde exactement 1 chance sur 4 096, quel que soit/)
      ).toBeInTheDocument()
    })

    it('démarque visuellement le rappel de chance constante des autres stats', () => {
      renderPanel({ count: 10, oddsDenominator: 4096 })
      const reminder = document.querySelector('.modal-hint--reminder')
      expect(reminder).toBeInTheDocument()
      expect(reminder).toHaveTextContent('💡')
    })
  })

  describe('date de début', () => {
    it('affiche la date de création par défaut', () => {
      renderPanel({ createdAt: new Date(2026, 7, 1).getTime(), startDate: undefined })
      expect(document.querySelector('input[type="date"]')).toHaveValue('2026-08-01')
    })

    it('change la date de début', () => {
      const { onSetStartDate } = renderPanel()
      const input = document.querySelector('input[type="date"]') as HTMLInputElement
      fireEvent.change(input, { target: { value: '2026-07-15' } })
      expect(onSetStartDate).toHaveBeenCalledWith('2026-07-15')
    })

    it('efface la date de début si le champ est vidé', () => {
      const { onSetStartDate } = renderPanel()
      const input = document.querySelector('input[type="date"]') as HTMLInputElement
      fireEvent.change(input, { target: { value: '' } })
      expect(onSetStartDate).toHaveBeenCalledWith(undefined)
    })

    it('affiche un rappel textuel de la date de début', () => {
      renderPanel({ createdAt: new Date(2026, 7, 1).getTime(), startDate: undefined })
      expect(screen.getByText(/août/)).toBeInTheDocument()
    })
  })

  describe('historique', () => {
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
})
