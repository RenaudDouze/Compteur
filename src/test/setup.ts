import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'
import { cleanup } from '@testing-library/react'

afterEach(() => {
  cleanup()
})

// jsdom n'implémente ni ResizeObserver ni matchMedia : on fournit des
// implémentations minimales réutilisables par tous les tests, que chaque
// test peut surcharger via vi.spyOn si besoin d'un comportement précis.
class MockResizeObserver {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
vi.stubGlobal('ResizeObserver', MockResizeObserver)

if (!window.matchMedia) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

if (!('randomUUID' in crypto)) {
  Object.defineProperty(crypto, 'randomUUID', {
    value: () => '00000000-0000-4000-8000-000000000000',
  })
}

// jsdom part d'un <head> vide : index.html n'est pas chargé en test, donc on
// reproduit la balise que App.tsx met à jour selon le thème actif.
if (!document.querySelector('meta[name="theme-color"]')) {
  const meta = document.createElement('meta')
  meta.name = 'theme-color'
  meta.content = '#f8fafc'
  document.head.appendChild(meta)
}
