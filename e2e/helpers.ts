import type { Page } from '@playwright/test'

/** Ouvre l'app avec un stockage local vierge. */
export async function gotoFresh(page: Page) {
  await page.goto('/')
  await page.evaluate(() => window.localStorage.clear())
  await page.reload()
}

/** Crée un compteur, puis ferme le champ de nom qui s'ouvre directement en
 * édition (garde le nom par défaut) : les tests qui n'ont pas besoin de
 * cette édition immédiate peuvent ainsi continuer sans s'en soucier. */
export async function addCounter(page: Page) {
  const empty = page.getByRole('button', { name: 'Créer mon premier compteur' })
  if (await empty.isVisible().catch(() => false)) {
    await empty.click()
  } else {
    await page.locator('.app-header-actions .add-btn:not(.icon-btn)').click()
  }
  await page.locator('.counter-name-input').last().press('Escape')
}
