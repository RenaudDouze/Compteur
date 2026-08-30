import { expect, test } from '@playwright/test'
import { addCounter, gotoFresh, openMenu } from './helpers'

test.describe('Fonctionnalités avancées', () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page)
    await addCounter(page)
  })

  test('définit une probabilité et affiche le taux de réussite cumulé (avec stats) sous le nombre', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    await page.getByRole('button', { name: 'Valeur & réglages', exact: true }).click()
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

    // Le panneau affiche le détail complet (probabilité de succès cumulée et
    // sa complémentaire, l'enchaînement d'échecs), avec en plus une barre de
    // progression visuelle.
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    await page.getByRole('button', { name: 'Valeur & réglages', exact: true }).click()
    const panel = page.locator('.modal-panel')
    await expect(panel.getByText(/de l'avoir obtenu avant ce stade/)).toHaveText(/25,0\s?%/)
    await expect(panel.getByText(/d'échecs d'affilée/)).toHaveText(/75,0\s?%/)
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

  test('définit un objectif libre et affiche sa progression', async ({ page }) => {
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    await page.getByRole('button', { name: 'Valeur & réglages', exact: true }).click()
    const input = page.getByPlaceholder('ex : 50')
    await input.fill('20')
    await input.press('Enter')
    await expect(page.locator('.odds-progress')).toHaveAttribute('aria-valuenow', '0')
    await expect(page.getByText('0 / 20 (0 %)')).toBeVisible()
    await page.getByRole('button', { name: 'Fermer' }).click()

    for (let i = 0; i < 5; i++) {
      await page.getByRole('button', { name: 'Incrémenter', exact: true }).click()
    }

    // La progression suit le compteur, y compris depuis la carte via
    // l'anneau (choisi ici pour vérifier que l'objectif pilote bien
    // l'anneau plutôt qu'une probabilité, qui n'est pas définie ici).
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    await page.getByRole('button', { name: 'Valeur & réglages', exact: true }).click()
    await expect(page.locator('.odds-progress')).toHaveAttribute('aria-valuenow', '25')
    await expect(page.getByText('5 / 20 (25 %)')).toBeVisible()
    await page.getByRole('button', { name: 'Fermer' }).click()

    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    await page.getByRole('button', { name: 'Choisir le style Anneau' }).click()
    await page.getByRole('button', { name: 'Fermer' }).click()
    await expect(page.locator('.value-ring-pct')).toHaveText('25 %')
  })

  test('duplique un compteur avec sa configuration mais repart de zéro', async ({ page }) => {
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    await page.getByRole('button', { name: `Choisir la couleur` }).first().click()
    await page.getByRole('button', { name: 'Choisir le style Volets' }).click()
    await page.getByRole('button', { name: 'Actions', exact: true }).click()
    await page.getByRole('button', { name: '⧉ Dupliquer ce compteur' }).click()

    await expect(page.getByText('Compteur 1', { exact: true })).toBeVisible()
    await expect(page.getByText('Compteur 1 (copie)').first()).toBeVisible()
    const cards = page.locator('.counter-card')
    await expect(cards).toHaveCount(2)
    // Le style est repris, mais pas le compte.
    await expect(cards.nth(1).locator('.value-flap')).toBeVisible()
    await expect(cards.nth(1).locator('.value-flap-tile')).toHaveText('0')
  })

  test("affiche un sparkline dans l'historique après plusieurs changements espacés", async ({ page }) => {
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    await page.getByRole('button', { name: 'Historique', exact: true }).click()
    await expect(page.getByText(/Pas encore assez d'historique/)).toBeVisible()
    await page.getByRole('button', { name: 'Fermer' }).click()

    const plus = page.getByRole('button', { name: 'Incrémenter', exact: true })
    await plus.click()
    // Au-delà du seuil de regroupement des changements rapprochés (2s).
    await page.waitForTimeout(2100)
    await plus.click()

    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    await page.getByRole('button', { name: 'Historique', exact: true }).click()
    await expect(page.locator('.sparkline')).toBeVisible()
    await expect(page.getByText(/Min : \d+ · Max : 2/)).toBeVisible()
  })

  test("exporte l'historique en CSV", async ({ page }) => {
    const plus = page.getByRole('button', { name: 'Incrémenter', exact: true })
    await plus.click()

    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    await page.getByRole('button', { name: 'Historique', exact: true }).click()
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /Exporter en CSV/ }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^\+1-historique-Compteur-1-\d{4}-\d{2}-\d{2}\.csv$/)

    const path = await download.path()
    const fs = await import('fs')
    const content = fs.readFileSync(path!, 'utf8')
    expect(content.split('\n')[0]).toBe('Horodatage,Valeur')
    expect(content).toMatch(/,1$/)
  })

  test("définit un pas d'incrément personnalisé et l'applique aux boutons +/-", async ({ page }) => {
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    await page.getByRole('button', { name: 'Valeur & réglages', exact: true }).click()
    const input = page.getByPlaceholder('1')
    await input.fill('5')
    await input.press('Enter')
    await expect(page.getByText('+5 / −5 à chaque appui')).toBeVisible()
    await page.getByRole('button', { name: 'Fermer' }).click()

    await expect(page.getByRole('button', { name: 'Incrémenter', exact: true })).toHaveText('+5')
    await expect(page.getByRole('button', { name: 'Décrémenter' })).toHaveText('−5')

    await page.getByRole('button', { name: 'Incrémenter', exact: true }).click()
    await expect(page.locator('.counter-value')).toHaveText('5')
    await page.getByRole('button', { name: 'Décrémenter' }).click()
    await expect(page.locator('.counter-value')).toHaveText('0')
  })

  test("affiche une erreur pour un pas d'incrément invalide, sans faire disparaître l'erreur au changement de focus", async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    await page.getByRole('button', { name: 'Valeur & réglages', exact: true }).click()
    const input = page.getByPlaceholder('1')
    await input.fill('0')
    await input.press('Enter')
    await expect(page.getByText('Nombre entier positif requis.')).toBeVisible()

    // Cliquer ailleurs dans le panneau (perte de focus) ne doit pas faire
    // disparaître silencieusement l'erreur.
    await page.getByRole('heading', { name: 'Objectif' }).click()
    await expect(page.getByText('Nombre entier positif requis.')).toBeVisible()

    await input.fill('3')
    await input.press('Enter')
    await expect(page.getByText('Nombre entier positif requis.')).not.toBeVisible()
    await expect(page.getByText('+3 / −3 à chaque appui')).toBeVisible()
  })

  test('modifie la date de début et affiche un rappel textuel', async ({ page }) => {
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    await page.getByRole('button', { name: 'Valeur & réglages', exact: true }).click()
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

  test("vide l'image de fond via le bouton dédié", async ({ page }) => {
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    const input = page.getByPlaceholder('https://exemple.com/image.jpg')
    await expect(page.getByRole('button', { name: "Vider l'image de fond" })).not.toBeVisible()

    await input.fill('https://exemple.com/fond.jpg')
    await input.press('Enter')
    await page.getByRole('button', { name: 'Fermer' }).click()
    await expect(page.locator('.counter-bg')).toBeAttached()

    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    await page.getByRole('button', { name: "Vider l'image de fond" }).click()
    await expect(input).toHaveValue('')
    await expect(page.getByRole('button', { name: "Vider l'image de fond" })).not.toBeVisible()
    await page.getByRole('button', { name: 'Fermer' }).click()
    await expect(page.locator('.counter-bg')).not.toBeAttached()
  })

  test('ignore une URL invalide comme image de fond et affiche une erreur', async ({ page }) => {
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    const input = page.getByPlaceholder('https://exemple.com/image.jpg')
    await input.fill('pas-une-url')
    await input.press('Enter')
    await expect(page.locator('.counter-bg')).not.toBeAttached()
    await expect(page.getByText('URL http(s) invalide.')).toBeVisible()
    // La saisie reste affichée pour que l'utilisateur puisse la corriger.
    await expect(input).toHaveValue('pas-une-url')
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

  test('définit directement une valeur depuis la modale Valeur & réglages', async ({ page }) => {
    await page.getByRole('button', { name: 'Régler le comportement du compteur' }).click()
    const input = page.locator('.modal-section:has-text("Valeur actuelle") input')
    await input.fill('250')
    await input.press('Enter')
    await page.getByRole('button', { name: 'Fermer' }).click()
    await expect(page.locator('.counter-value')).toHaveText('250')
  })

  test('accepte une valeur négative via édition directe', async ({ page }) => {
    await page.getByRole('button', { name: 'Régler le comportement du compteur' }).click()
    const input = page.locator('.modal-section:has-text("Valeur actuelle") input')
    await input.fill('-42')
    await input.press('Enter')
    await page.getByRole('button', { name: 'Fermer' }).click()
    await expect(page.locator('.counter-value')).toHaveText('-42')
  })

  test('affiche une erreur et ne ferme pas le champ si la saisie directe est invalide', async ({ page }) => {
    await page.getByRole('button', { name: 'Régler le comportement du compteur' }).click()
    const input = page.locator('.modal-section:has-text("Valeur actuelle") input')
    await input.fill('abc')
    await input.press('Enter')
    await expect(page.getByText('Nombre entier requis.')).toBeVisible()
    await expect(input).toBeVisible()
    // Corrige la saisie : l'erreur disparaît et le compteur adopte la valeur.
    await input.fill('7')
    await input.press('Enter')
    await page.getByRole('button', { name: 'Fermer' }).click()
    await expect(page.locator('.counter-value')).toHaveText('7')
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

  test('réordonne par glisser-déposer avec une recherche active, sans déplacer les compteurs masqués', async ({
    page,
  }) => {
    await addCounter(page)
    await addCounter(page)
    await addCounter(page)

    // Ordre de création : Pomme1, Autre, Pomme2, Pomme3 (« Autre » intercalé,
    // pas en bord de liste, pour vérifier qu'il garde sa place même entouré
    // de compteurs déplacés).
    const names = ['Pomme1', 'Autre', 'Pomme2', 'Pomme3']
    const cards = page.locator('.counter-card')
    for (let i = 0; i < 4; i++) {
      await cards.nth(i).locator('.counter-name').click()
      await cards.nth(i).locator('.counter-name-input').fill(names[i])
      await cards.nth(i).locator('.counter-name-input').press('Enter')
    }

    await openMenu(page)
    await page.getByRole('button', { name: 'Rechercher' }).click()
    await page.getByPlaceholder('Rechercher un compteur…').fill('Pomme')
    await expect(page.locator('.counter-name')).toHaveText(['Pomme1', 'Pomme2', 'Pomme3'])

    const handleFirst = cards.nth(0).locator('.counter-drag-handle')
    const boxFirst = await handleFirst.boundingBox()
    const boxLast = await cards.nth(2).boundingBox()
    if (!boxFirst || !boxLast) throw new Error('bounding box manquante')

    await page.mouse.move(boxFirst.x + boxFirst.width / 2, boxFirst.y + boxFirst.height / 2)
    await page.mouse.down()
    const steps = 10
    for (let i = 1; i <= steps; i++) {
      const y = boxFirst.y + (boxLast.y + boxLast.height - boxFirst.y) * (i / steps)
      await page.mouse.move(boxFirst.x + boxFirst.width / 2, y)
      await page.waitForTimeout(20)
    }
    await page.mouse.up()

    await expect(page.locator('.counter-name')).toHaveText(['Pomme2', 'Pomme3', 'Pomme1'])

    await page.getByRole('button', { name: 'Fermer la recherche' }).click()
    // « Autre » retrouve exactement sa place d'origine (2ᵈ position), les 3
    // compteurs visibles pendant le glisser gardent leur nouvel ordre relatif.
    await expect(page.locator('.counter-name')).toHaveText(['Pomme2', 'Autre', 'Pomme3', 'Pomme1'])
  })

  test("le clic sur la poignée de glisser n'incrémente pas", async ({ page }) => {
    await page.locator('.counter-drag-handle').click()
    await expect(page.locator('.counter-value')).toHaveText('0')
  })

  test('épingle un compteur pour le faire remonter en tête de liste, plus vite que le glisser-déposer', async ({
    page,
  }) => {
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

    await cards.nth(2).getByRole('button', { name: 'Actions du compteur' }).click()
    await page.getByText('📌 Épingler en haut').click()
    await expect(page.locator('.counter-name')).toHaveText(['C', 'A', 'B'])
    await expect(cards.first().locator('.counter-pin-badge')).toBeVisible()

    await cards.first().getByRole('button', { name: 'Actions du compteur' }).click()
    await page.getByText('📌 Détacher ce compteur').click()
    await expect(page.locator('.counter-name')).toHaveText(['A', 'B', 'C'])
  })

  test("affiche un confetti à l'atteinte de l'objectif", async ({ page }) => {
    await page.getByRole('button', { name: 'Personnaliser le compteur' }).click()
    await page.getByRole('button', { name: 'Valeur & réglages', exact: true }).click()
    await page.getByPlaceholder('ex : 50').fill('2')
    await page.getByPlaceholder('ex : 50').press('Enter')
    await page.getByRole('button', { name: 'Fermer' }).click()

    await expect(page.locator('.counter-celebration')).not.toBeVisible()
    await page.getByRole('button', { name: 'Incrémenter', exact: true }).click()
    await expect(page.locator('.counter-celebration')).not.toBeVisible()
    await page.getByRole('button', { name: 'Incrémenter', exact: true }).click()
    await expect(page.locator('.counter-celebration')).toBeVisible()
    await expect(page.getByText('Objectif atteint')).toBeAttached()
    await expect(page.locator('.counter-celebration')).not.toBeVisible({ timeout: 2000 })
  })
})
