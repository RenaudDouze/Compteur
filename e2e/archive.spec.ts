import { expect, test } from '@playwright/test'
import { addCounter, gotoFresh, openMenu } from './helpers'

// Le filtre Actifs/Archivés est un bouton unique du menu déroulant, qui
// bascule entre les deux vues au clic (comme le thème) plutôt qu'une paire
// d'onglets affichés simultanément.
async function toggleArchiveView(page: import('@playwright/test').Page) {
  await openMenu(page)
  await page.getByRole('button', { name: /^Vue : / }).click()
}

test.describe('Archivage de compteurs', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page)
  })

  test('affiche le filtre Actifs/Archivés même sans compteur (élément fixe du menu)', async ({ page }) => {
    await openMenu(page)
    await expect(page.getByRole('button', { name: 'Vue : Actifs' })).toBeVisible()
  })

  test('archive un compteur, le masque des actifs, et le retrouve via Archivés', async ({ page }) => {
    await addCounter(page)
    await page.getByText('Compteur 1', { exact: true }).click()
    await page.locator('.counter-name-input').fill('À ranger')
    await page.locator('.counter-name-input').press('Enter')

    await page.getByRole('button', { name: 'Actions du compteur' }).click()
    await page.getByText('Archiver ce compteur').click()
    await expect(page.getByText('À ranger', { exact: true })).not.toBeVisible()
    await openMenu(page)
    await expect(page.getByRole('button', { name: 'Vue : Actifs (1 archivé(s))' })).toBeVisible()

    await page.getByRole('button', { name: /^Vue : / }).click()
    await expect(page.getByText('À ranger', { exact: true })).toBeVisible()
  })

  test('désarchive un compteur et le fait réapparaître dans les actifs', async ({ page }) => {
    await addCounter(page)
    await page.getByRole('button', { name: 'Actions du compteur' }).click()
    await page.getByText('Archiver ce compteur').click()

    await toggleArchiveView(page)
    await page.getByRole('button', { name: 'Actions du compteur' }).click()
    await page.getByText('Désarchiver ce compteur').click()

    await toggleArchiveView(page)
    await expect(page.getByText('Compteur 1', { exact: true })).toBeVisible()
  })

  test('la recherche retrouve un compteur archivé au sein de sa vue', async ({ page }) => {
    await addCounter(page)
    await page.getByText('Compteur 1', { exact: true }).click()
    await page.locator('.counter-name-input').fill('Pompes')
    await page.locator('.counter-name-input').press('Enter')
    await page.getByRole('button', { name: 'Actions du compteur' }).click()
    await page.getByText('Archiver ce compteur').click()

    await toggleArchiveView(page)
    await openMenu(page)
    await page.getByRole('button', { name: 'Rechercher' }).click()
    await page.getByPlaceholder('Rechercher un compteur…').fill('pom')
    await expect(page.getByText('Pompes', { exact: true })).toBeVisible()
  })

  test('un compteur archivé est en lecture seule (comptage et réglages bloqués)', async ({ page }) => {
    await addCounter(page)
    await page.getByRole('button', { name: 'Actions du compteur' }).click()
    await page.getByText('Archiver ce compteur').click()
    await toggleArchiveView(page)

    const card = page.locator('.counter-card')
    await card.click()
    await expect(card.locator('.counter-value')).toHaveText('0')
    await expect(page.getByRole('button', { name: 'Incrémenter' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Décrémenter' })).toBeDisabled()
    await expect(card.locator('.counter-drag-handle')).toHaveCount(0)

    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    await expect(page.getByText(/Compteur archivé : lecture seule/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Choisir la couleur/ }).first()).toBeDisabled()
    await page.getByRole('button', { name: 'Fermer' }).click()

    await page.getByRole('button', { name: 'Régler le comportement du compteur' }).click()
    await expect(page.getByText(/Compteur archivé : lecture seule/)).toBeVisible()
    await expect(page.getByPlaceholder('1')).toBeDisabled()
  })

  test('affiche la durée totale figée et la moyenne par jour sur la carte et dans la modale une fois archivé', async ({
    page,
  }) => {
    await addCounter(page)
    await page.getByRole('button', { name: 'Incrémenter', exact: true }).click()
    await page.getByRole('button', { name: 'Incrémenter', exact: true }).click()
    await page.getByRole('button', { name: 'Actions du compteur' }).click()
    await page.getByText('Archiver ce compteur').click()
    await toggleArchiveView(page)

    await expect(page.getByText(/Durée totale : .*→.*aujourd'hui/)).toBeVisible()
    await expect(page.getByText(/Moyenne : 2 \/ jour/)).toBeVisible()

    await page.getByRole('button', { name: 'Régler le comportement du compteur' }).click()
    await expect(page.locator('.modal-panel').getByText(/→.*aujourd'hui/)).toBeVisible()
    await expect(page.locator('.modal-panel').getByText(/Moyenne : 2 \/ jour/)).toBeVisible()
  })

  test('affiche des statistiques cumulées sur tous les compteurs archivés', async ({ page }) => {
    await addCounter(page)
    await page.getByRole('button', { name: 'Incrémenter', exact: true }).click()
    await page.getByRole('button', { name: 'Incrémenter', exact: true }).click()
    await page.getByRole('button', { name: 'Actions du compteur' }).click()
    await page.getByText('Archiver ce compteur').click()

    await addCounter(page)
    await page.getByRole('button', { name: 'Incrémenter', exact: true }).click()
    await page.getByRole('button', { name: 'Actions du compteur' }).click()
    await page.getByText('Archiver ce compteur').click()

    // Aucune barre de statistiques en vue Actifs.
    await expect(page.locator('.archive-stats-bar')).toHaveCount(0)

    await toggleArchiveView(page)
    const bar = page.locator('.archive-stats-bar')
    await expect(bar).toBeVisible()
    await expect(bar.getByText('2')).toBeVisible()
    await expect(bar.getByText('compteurs archivés')).toBeVisible()
    await expect(bar.getByText('3')).toBeVisible()
    await expect(bar.getByText('total cumulé')).toBeVisible()
    // Comptes 2 et 1 : moyenne (2+1)/2 = 1,5, médiane (1+2)/2 = 1,5 aussi
    // (2 valeurs) — coïncidence de ce jeu de données, chaque puce est
    // vérifiée séparément par son libellé pour ne pas dépendre de ça.
    await expect(bar.locator('.archive-stat', { hasText: 'valeur moyenne' }).getByText('1,5', { exact: true })).toBeVisible()
    await expect(bar.locator('.archive-stat', { hasText: 'valeur médiane' }).getByText('1,5', { exact: true })).toBeVisible()
    await expect(bar.getByText('1,5 / jour')).toBeVisible()
    await expect(bar.getByText('en moyenne')).toBeVisible()
    // Les deux compteurs sont archivés le jour même : 1 jour chacun.
    await expect(bar.getByText('1 jour', { exact: true })).toBeVisible()
    await expect(bar.getByText('durée moyenne')).toBeVisible()
  })
})
