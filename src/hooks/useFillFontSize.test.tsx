import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useFillFontSize } from './useFillFontSize'

function Harness({ active, digitsSource }: { active: boolean; digitsSource: number }) {
  const { ref, fontSize } = useFillFontSize(active, digitsSource)
  return <div ref={ref} data-testid="target" style={fontSize ? { fontSize: `${fontSize}px` } : undefined} />
}

describe('useFillFontSize', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ne calcule rien quand inactif', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(320)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(480)
    const { getByTestId } = render(<Harness active={false} digitsSource={12} />)
    expect(getByTestId('target').style.fontSize).toBe('')
  })

  it("ne calcule rien tant que l'espace mesuré est nul (élément non visible)", () => {
    const { getByTestId } = render(<Harness active digitsSource={12} />)
    expect(getByTestId('target').style.fontSize).toBe('')
  })

  it("calcule et applique une taille de police quand l'espace mesuré est non nul", () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(320)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(480)
    const { getByTestId } = render(<Harness active digitsSource={12} />)
    expect(getByTestId('target').style.fontSize).toMatch(/px$/)
  })

  it('plafonne à un minimum de 48px', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(10)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(10)
    const { getByTestId } = render(<Harness active digitsSource={999999} />)
    expect(getByTestId('target').style.fontSize).toBe('48px')
  })

  it('se désabonne du ResizeObserver au démontage', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(320)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(480)
    const { unmount } = render(<Harness active digitsSource={12} />)
    expect(() => unmount()).not.toThrow()
  })

  it("ne réattache pas le ResizeObserver (ni ne remesure) quand la valeur change sans changer le nombre de chiffres", () => {
    // Sans ça, chaque incrément (donc chaque tap sur +/-) réattacherait un
    // nouveau ResizeObserver et forcerait une lecture de layout synchrone
    // même quand le nombre de chiffres affichés n'a pas changé — un coût
    // superflu à chaque appui, plus sensible sur du matériel ancien.
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(320)
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(480)
    let instantiations = 0
    class TrackedResizeObserver {
      observe = vi.fn()
      unobserve = vi.fn()
      disconnect = vi.fn()
      constructor() {
        instantiations++
      }
    }
    vi.stubGlobal('ResizeObserver', TrackedResizeObserver)

    const { rerender } = render(<Harness active digitsSource={12} />)
    expect(instantiations).toBe(1)

    rerender(<Harness active digitsSource={34} />) // toujours 2 chiffres
    expect(instantiations).toBe(1)

    rerender(<Harness active digitsSource={345} />) // 3 chiffres désormais
    expect(instantiations).toBe(2)
  })
})
