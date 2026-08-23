import { expect, test } from '@playwright/test'
import { addCounter, gotoFresh } from './helpers'

test.describe('Fonctionnalités avancées', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page)
    await addCounter(page)
  })

  test('définit une probabilité et affiche le taux de réussite cumulé (avec stats) sous le nombre', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    const input = page.getByPlaceholder('4096')
    await input.fill('4')
    await input.press('Enter')
    await page.getByRole('button', { name: 'Fermer' }).click()

    const plus = page.getByRole('button', { name: 'Incrémenter', exact: true })
    await plus.click()
    // 1 - (1 - 1/4)^1 = 0.25 => arrondi affiché à 1 décimale : 25,0 %
    // Directement sur la carte : uniquement le pourcentage, pour ne pas
    // surcharger la carte (le détail complet reste dans le panneau).
    const card = page.locator('.counter-card')
    await expect(card.locator('.counter-odds-hint')).toHaveText(/25,0\s?%/)
    await expect(card.getByText('Encore ~3 tentatives en moyenne (moyenne : 4)')).not.toBeVisible()
    await expect(card.getByText(/Chaque tentative garde exactement 1 chance sur 4,/)).not.toBeVisible()

    // Le panneau affiche le détail complet, avec en plus une barre de
    // progression visuelle (`.modal-hint` a un second usage pour la date de
    // début : on filtre sur le %).
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    const panel = page.locator('.modal-panel')
    await expect(panel.locator('.modal-hint', { hasText: '%' })).toHaveText(/25,0\s?%/)
    await expect(panel.locator('.odds-progress')).toHaveAttribute('aria-valuenow', '25')
    await expect(panel.getByText('Encore ~3 tentatives en moyenne (moyenne : 4)')).toBeVisible()
    await expect(panel.getByText(/Chaque tentative garde exactement 1 chance sur 4,/)).toBeVisible()
  })

  test("change le style d'affichage du chiffre et continue d'incrémenter normalement", async ({ page }) => {
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    await page.getByRole('button', { name: 'Choisir le style 7 segments' }).click()
    await expect(page.getByRole('button', { name: 'Choisir le style 7 segments' })).toHaveClass(/selected/)
    await page.getByRole('button', { name: 'Fermer' }).click()

    const card = page.locator('.counter-card')
    await expect(card.locator('.value-segment7')).toBeVisible()
    await expect(card.locator('.odometer')).toHaveCount(0)

    // Le style choisi n'empêche pas d'incrémenter normalement.
    await page.getByRole('button', { name: 'Incrémenter', exact: true }).click()
    await expect(card.locator('.value-segment-digit')).toHaveCount(1)

    // Persiste après rechargement.
    await page.reload()
    await expect(card.locator('.value-segment7')).toBeVisible()
  })

  test("affiche un sparkline dans l'historique après plusieurs changements espacés", async ({ page }) => {
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    await expect(page.getByText(/Pas encore assez d'historique/)).toBeVisible()
    await page.getByRole('button', { name: 'Fermer' }).click()

    const plus = page.getByRole('button', { name: 'Incrémenter', exact: true })
    await plus.click()
    // Au-delà du seuil de regroupement des changements rapprochés (2s).
    await page.waitForTimeout(2100)
    await plus.click()

    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    await expect(page.locator('.sparkline')).toBeVisible()
    await expect(page.getByText(/Min : \d+ · Max : 2/)).toBeVisible()
  })

  test("définit un pas d'incrément personnalisé et l'applique aux boutons +/-", async ({ page }) => {
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    const input = page.getByPlaceholder('1')
    await input.fill('5')
    await input.press('Enter')
    await expect(page.getByText('+5 / −5 à chaque appui')).toBeVisible()
    await page.getByRole('button', { name: 'Fermer' }).click()

    await page.getByRole('button', { name: 'Incrémenter', exact: true }).click()
    await expect(page.locator('.counter-value')).toHaveText('5')
    await page.getByRole('button', { name: 'Décrémenter' }).click()
    await expect(page.locator('.counter-value')).toHaveText('0')
  })

  test('modifie la date de début et affiche un rappel textuel', async ({ page }) => {
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    const hint = page.locator('.modal-section:has(input[type="date"]) .modal-hint')
    const before = await hint.textContent()
    const input = page.locator('input[type="date"]')
    await input.fill('2020-01-01')
    // Le format complet varie selon "aujourd'hui"/jours écoulés ; on vérifie
    // juste que le rappel a bien changé pour refléter la nouvelle date.
    await expect(hint).not.toHaveText(before ?? '')
  })

  test('définit une image de fond via une URL http(s) valide', async ({ page }) => {
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    const input = page.getByPlaceholder('https://exemple.com/image.jpg')
    await input.fill('https://exemple.com/fond.jpg')
    await input.press('Enter')
    await page.getByRole('button', { name: 'Fermer' }).click()
    await expect(page.locator('.counter-bg')).toBeAttached()
  })

  test('ignore une URL invalide comme image de fond', async ({ page }) => {
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    const input = page.getByPlaceholder('https://exemple.com/image.jpg')
    await input.fill('pas-une-url')
    await input.press('Enter')
    await expect(page.locator('.counter-bg')).not.toBeAttached()
    await expect(input).toHaveValue('')
  })

  test('change la couleur du compteur via la palette', async ({ page }) => {
    const card = page.locator('.counter-card').first()
    const before = await card.evaluate((el) => getComputedStyle(el).getPropertyValue('--accent'))
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    // Le premier compteur créé utilise toujours la première couleur de la
    // palette : la deuxième option est donc garantie différente.
    await page.getByRole('button', { name: /Choisir la couleur/ }).nth(1).click()
    await page.getByRole('button', { name: 'Fermer' }).click()
    const after = await card.evaluate((el) => getComputedStyle(el).getPropertyValue('--accent'))
    expect(after).not.toBe(before)
  })

  test('définit directement une valeur via le crayon', async ({ page }) => {
    await page.getByRole('button', { name: 'Définir la valeur du compteur' }).click()
    const input = page.locator('.counter-value-input')
    await input.fill('250')
    await input.press('Enter')
    await expect(page.locator('.counter-value')).toHaveText('250')
  })

  test('accepte une valeur négative via édition directe', async ({ page }) => {
    await page.getByRole('button', { name: 'Définir la valeur du compteur' }).click()
    const input = page.locator('.counter-value-input')
    await input.fill('-42')
    await input.press('Enter')
    await expect(page.locator('.counter-value')).toHaveText('-42')
  })

  test('réordonne les compteurs par glisser-déposer', async ({ page }) => {
    await addCounter(page)
    await addCounter(page)

    const names = ['A', 'B', 'C']
    const cards = page.locator('.counter-card')
    for (let i = 0; i < 3; i++) {
      await cards.nth(i).locator('.counter-name').click()
      await cards.nth(i).locator('.counter-name-input').fill(names[i])
      await cards.nth(i).locator('.counter-name-input').press('Enter')
    }

    await expect(page.locator('.counter-name')).toHaveText(['A', 'B', 'C'])

    const handleA = cards.nth(0).locator('.counter-drag-handle')
    const boxA = await handleA.boundingBox()
    const boxC = await cards.nth(2).boundingBox()
    if (!boxA || !boxC) throw new Error('bounding box manquante')

    await page.mouse.move(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2)
    await page.mouse.down()
    const steps = 10
    for (let i = 1; i <= steps; i++) {
      const y = boxA.y + (boxC.y + boxC.height - boxA.y) * (i / steps)
      await page.mouse.move(boxA.x + boxA.width / 2, y)
      await page.waitForTimeout(20)
    }
    await page.mouse.up()

    await expect(page.locator('.counter-name')).toHaveText(['B', 'C', 'A'])
  })

  test("le clic sur la poignée de glisser n'incrémente pas", async ({ page }) => {
    await page.locator('.counter-drag-handle').click()
    await expect(page.locator('.counter-value')).toHaveText('0')
  })
})
