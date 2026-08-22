import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeId } from './id'

describe('makeId', () => {
  it('utilise crypto.randomUUID quand disponible', () => {
    const spy = vi.spyOn(crypto, 'randomUUID').mockReturnValue('00000000-0000-4000-8000-000000000000')
    expect(makeId()).toBe('00000000-0000-4000-8000-000000000000')
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
  })

  it('génère un id au format UUID en environnement normal', () => {
    expect(makeId()).toMatch(/^[0-9a-f-]{36}$/)
  })

  describe('sans crypto.randomUUID', () => {
    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('utilise un identifiant de secours basé sur l\'horloge et l\'aléatoire', () => {
      vi.stubGlobal('crypto', {})
      expect(makeId()).toMatch(/^id-\d+-[0-9a-f]+$/)
    })

    it('utilise aussi le secours quand crypto est totalement indéfini', () => {
      vi.stubGlobal('crypto', undefined)
      expect(makeId()).toMatch(/^id-\d+-[0-9a-f]+$/)
    })
  })
})
