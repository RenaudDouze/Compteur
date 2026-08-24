import { expect, test } from '@playwright/test'
import { addCounter, gotoFresh } from './helpers'

test.describe('Synchronisation et partage', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page)
  })

  test('ouvre et ferme le panneau de synchronisation', async ({ page }) => {
    await page.getByRole('button', { name: 'Synchroniser' }).click()
    await expect(page.getByText('Synchroniser mes compteurs')).toBeVisible()
    await page.getByRole('button', { name: 'Fermer' }).click()
    await expect(page.getByText('Synchroniser mes compteurs')).not.toBeVisible()
  })

  test('affiche un QR code une fois un compteur créé', async ({ page }) => {
    await addCounter(page)
    await page.getByRole('button', { name: 'Synchroniser' }).click()
    await expect(page.locator('.sync-qr')).toBeVisible()
  })

  test('exporte un fichier de sauvegarde JSON téléchargeable', async ({ page }) => {
    await addCounter(page)
    await page.getByText('Compteur 1', { exact: true }).click()
    await page.locator('.counter-name-input').fill('Export test')
    await page.locator('.counter-name-input').press('Enter')

    await page.getByRole('button', { name: 'Synchroniser' }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Exporter' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^compteur-sauvegarde-\d{4}-\d{2}-\d{2}\.json$/)

    const path = await download.path()
    const fs = await import('fs')
    const content = JSON.parse(fs.readFileSync(path!, 'utf8'))
    expect(content[0].name).toBe('Export test')
  })

  test('importe un fichier de sauvegarde JSON', async ({ page }) => {
    await page.getByRole('button', { name: 'Synchroniser' }).click()
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Importer' }).click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify([{ name: 'Depuis fichier', count: 7 }])),
    })
    await expect(page.getByText('Depuis fichier', { exact: true })).toBeVisible()
    await expect(page.locator('.counter-value')).toHaveText('7')
  })

  test('un lien de partage importe automatiquement les compteurs', async ({ page, browser, baseURL }) => {
    await addCounter(page)
    await page.locator('.counter-card').click()
    await page.locator('.counter-card').click()
    // Attend que le rebond d'incrémentation soit retombé avant de cliquer sur
    // le nom, sinon le clic peut arriver pendant l'animation encore en cours.
    await expect(page.locator('.counter-value')).toHaveText('2')
    await page.getByText('Compteur 1', { exact: true }).click()
    await page.locator('.counter-name-input').fill('Partagé E2E')
    await page.locator('.counter-name-input').press('Enter')

    await page.getByRole('button', { name: 'Synchroniser' }).click()
    await page.evaluate(() => {
      // @ts-expect-error injection de test pour intercepter le presse-papiers
      navigator.clipboard.writeText = (text: string) => {
        ;(window as unknown as { __copied: string }).__copied = text
        return Promise.resolve()
      }
    })
    await page.getByText('Copier le lien').click()
    const link = await page.evaluate(() => (window as unknown as { __copied: string }).__copied)
    expect(link).toContain(`${baseURL}/?import=`)

    // Contexte de navigateur totalement séparé (stockage vierge) = un autre appareil.
    const otherContext = await browser.newContext()
    const otherPage = await otherContext.newPage()
    await otherPage.goto(link)
    await expect(otherPage.getByText('Partagé E2E', { exact: true })).toBeVisible()
    await expect(otherPage.locator('.counter-value')).toHaveText('2')
    // Le lien est nettoyé après import automatique.
    expect(new URL(otherPage.url()).search).toBe('')
    await otherContext.close()
  })

  test('copie un compteur au format texte sans lien', async ({ page }) => {
    await addCounter(page)
    await page.getByText('Compteur 1', { exact: true }).click()
    await page.locator('.counter-name-input').fill('À partager')
    await page.locator('.counter-name-input').press('Enter')
    await page.locator('.counter-card').click()

    await page.evaluate(() => {
      // Force le chemin presse-papiers même si le navigateur de test
      // supporte navigator.share, pour un comportement déterministe.
      // @ts-expect-error surcharge volontaire pour le test
      navigator.share = undefined
      // @ts-expect-error injection de test
      navigator.clipboard.writeText = (text: string) => {
        ;(window as unknown as { __shared: string }).__shared = text
        return Promise.resolve()
      }
    })
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByText('⇪ Partager ce compteur').click()
    const shared = await page.evaluate(() => (window as unknown as { __shared: string }).__shared)
    expect(shared).toContain('À partager : 1')
    expect(shared).not.toContain('http')
  })
})
