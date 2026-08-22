import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNarrowScreen } from './useNarrowScreen'

class FakeMediaQueryList {
  matches: boolean
  media: string
  private listeners = new Set<(e: MediaQueryListEvent) => void>()

  constructor(media: string, matches: boolean) {
    this.media = media
    this.matches = matches
  }

  addEventListener(_: 'change', handler: (e: MediaQueryListEvent) => void) {
    this.listeners.add(handler)
  }

  removeEventListener(_: 'change', handler: (e: MediaQueryListEvent) => void) {
    this.listeners.delete(handler)
  }

  emit(matches: boolean) {
    this.matches = matches
    for (const listener of this.listeners) {
      listener({ matches } as MediaQueryListEvent)
    }
  }

  get listenerCount() {
    return this.listeners.size
  }
}

describe('useNarrowScreen', () => {
  let mql: FakeMediaQueryList
  let matchMediaSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mql = new FakeMediaQueryList('(max-width: 480px)', false)
    matchMediaSpy = vi.spyOn(window, 'matchMedia').mockImplementation(() => mql as unknown as MediaQueryList)
  })

  afterEach(() => {
    matchMediaSpy.mockRestore()
  })

  it('retourne false quand la media query ne matche pas au montage', () => {
    mql.matches = false
    const { result } = renderHook(() => useNarrowScreen())
    expect(result.current).toBe(false)
  })

  it('retourne true quand la media query matche au montage', () => {
    mql = new FakeMediaQueryList('(max-width: 480px)', true)
    matchMediaSpy.mockImplementation(() => mql as unknown as MediaQueryList)
    const { result } = renderHook(() => useNarrowScreen())
    expect(result.current).toBe(true)
  })

  it('utilise le seuil personnalisé fourni', () => {
    renderHook(() => useNarrowScreen(600))
    expect(matchMediaSpy).toHaveBeenCalledWith('(max-width: 600px)')
  })

  it('se met à jour quand la media query change', () => {
    const { result } = renderHook(() => useNarrowScreen())
    expect(result.current).toBe(false)
    act(() => {
      mql.emit(true)
    })
    expect(result.current).toBe(true)
  })

  it('se désabonne au démontage', () => {
    const { unmount } = renderHook(() => useNarrowScreen())
    expect(mql.listenerCount).toBe(1)
    unmount()
    expect(mql.listenerCount).toBe(0)
  })
})
