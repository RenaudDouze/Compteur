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
})
