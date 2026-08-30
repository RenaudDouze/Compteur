import { expect, test } from '@playwright/test'
import { addCounter, gotoFresh, openMenu } from './helpers'

test.describe('Parcours de base', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page)
  })

  test("affiche l'état vide au premier lancement", async ({ page }) => {
    await expect(page.getByText("Aucun compteur pour l'instant.")).toBeVisible()
  })

  test('crée un premier compteur', async ({ page }) => {
    await addCounter(page)
    await expect(page.getByText('Compteur 1', { exact: true })).toBeVisible()
    await expect(page.locator('.counter-value')).toHaveText('0')
  })

  test("le toast d'annulation ne bloque pas les taps sur ce qu'il recouvre", async ({ page }) => {
    await addCounter(page)
    // Modifier la valeur déclenche le toast "Annuler", qui reste affiché 5s
    // en position fixe : il peut visuellement recouvrir le bouton + d'un
    // compteur en bas d'écran. Le tap doit quand même atteindre le bouton.
    await page.getByRole('button', { name: 'Régler le comportement du compteur' }).click()
    const input = page.locator('.modal-section:has-text("Valeur actuelle") input')
    await input.fill('10')
    await input.press('Enter')
    await page.getByRole('button', { name: 'Fermer' }).click()
    await expect(page.getByRole('button', { name: 'Annuler' })).toBeVisible()

    const plus = page.getByRole('button', { name: 'Incrémenter', exact: true })
    const box = (await plus.boundingBox())!
    // Clic par coordonnées (comme un vrai tap à l'aveugle), pas via le
    // locator qui refuserait de cliquer un élément visuellement recouvert.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await expect(page.locator('.counter-value')).toHaveText('11')
  })

  test('incrémente au clic sur la carte', async ({ page }) => {
    await addCounter(page)
    await page.locator('.counter-card').click()
    await expect(page.locator('.counter-value')).toHaveText('1')
    await page.locator('.counter-card').click()
    await page.locator('.counter-card').click()
    await expect(page.locator('.counter-value')).toHaveText('3')
  })

  test('décrémente avec le bouton -', async ({ page }) => {
    await addCounter(page)
    const plus = page.getByRole('button', { name: 'Incrémenter', exact: true })
    await plus.click()
    await plus.click()
    await page.getByRole('button', { name: 'Décrémenter' }).click()
    await expect(page.locator('.counter-value')).toHaveText('1')
  })

  test('un appui long sur + incrémente en rafale', async ({ page }) => {
    await addCounter(page)
    const plus = page.getByRole('button', { name: 'Incrémenter', exact: true })
    const box = await plus.boundingBox()
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
    await page.mouse.down()
    // Délai de maintien (350ms) + plusieurs répétitions à 100ms.
    await page.waitForTimeout(900)
    await page.mouse.up()
    const value = Number(await page.locator('.counter-value').textContent())
    expect(value).toBeGreaterThanOrEqual(3)
  })

  test('autorise un compteur négatif', async ({ page }) => {
    await addCounter(page)
    await page.getByRole('button', { name: 'Décrémenter' }).click()
    await expect(page.locator('.counter-value')).toHaveText('-1')
  })

  test('renomme un compteur', async ({ page }) => {
    await addCounter(page)
    await page.getByText('Compteur 1', { exact: true }).click()
    const input = page.locator('.counter-name-input')
    await input.fill('Mon compteur')
    await input.press('Enter')
    await expect(page.getByText('Mon compteur', { exact: true })).toBeVisible()
  })

  test('ouvre directement le champ de nom en édition à la création', async ({ page }) => {
    await page.getByRole('button', { name: 'Créer mon premier compteur' }).click()
    const input = page.locator('.counter-name-input')
    await expect(input).toBeFocused()
    await input.fill('Dès la création')
    await input.press('Enter')
    await expect(page.getByText('Dès la création', { exact: true })).toBeVisible()
  })

  test('renomme un compteur depuis la modale Personnalisation', async ({ page }) => {
    await addCounter(page)
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    const input = page.locator('.modal-panel input').first()
    await expect(input).toHaveValue('Compteur 1')
    await input.fill('Depuis la modale')
    await input.press('Enter')
    await page.getByRole('button', { name: 'Fermer' }).click()
    await expect(page.getByText('Depuis la modale', { exact: true })).toBeVisible()
  })

  test("affiche le bouton Comportement avant Personnalisation dans la rangée d'icônes", async ({ page }) => {
    await addCounter(page)
    const icons = page.locator('.counter-options-row button:not(.counter-drag-handle)')
    await expect(icons.nth(0)).toHaveAttribute('aria-label', 'Régler le comportement du compteur')
    await expect(icons.nth(1)).toHaveAttribute('aria-label', 'Personnaliser le compteur')
  })

  test('supprime un compteur après double confirmation', async ({ page }) => {
    await addCounter(page)
    await page.getByRole('button', { name: 'Actions du compteur' }).click()
    const deleteBtn = page.getByText('🗑 Supprimer ce compteur')
    await deleteBtn.click()
    await expect(page.getByText('✓ Confirmer la suppression')).toBeVisible()
    await page.getByText('✓ Confirmer la suppression').click()
    await expect(page.getByText("Aucun compteur pour l'instant.")).toBeVisible()
  })

  test('gère plusieurs compteurs indépendamment', async ({ page }) => {
    await addCounter(page)
    await addCounter(page)
    await expect(page.locator('.counter-card')).toHaveCount(2)
    await page.locator('.counter-card').first().click()
    const values = page.locator('.counter-value')
    await expect(values.nth(0)).toHaveText('1')
    await expect(values.nth(1)).toHaveText('0')
  })

  test('persiste les compteurs après rechargement', async ({ page }) => {
    await addCounter(page)
    await page.locator('.counter-card').click()
    await page.reload()
    await expect(page.locator('.counter-value')).toHaveText('1')
  })

  test('passe en grille compacte à partir de 3 compteurs', async ({ page }) => {
    await addCounter(page)
    await addCounter(page)
    await addCounter(page)
    await expect(page.locator('.counter-grid--pack')).toBeVisible()
  })

  test('masque l\'en-tête en mode plein écran, restauré par le bouton de sortie ou Échap', async ({ page }) => {
    await addCounter(page)
    await openMenu(page)
    await page.getByRole('button', { name: 'Mode plein écran' }).click()
    await expect(page.getByRole('heading', { name: '+1', exact: true })).not.toBeVisible()
    const exitBtn = page.getByRole('button', { name: 'Quitter le mode plein écran' })
    await expect(exitBtn).toBeVisible()

    await exitBtn.click()
    await expect(page.getByRole('heading', { name: '+1', exact: true })).toBeVisible()

    await openMenu(page)
    await page.getByRole('button', { name: 'Mode plein écran' }).click()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: '+1', exact: true })).toBeVisible()
  })
})
