import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { VERDICT_HOLD_MS } from './scan-outcomes'
import { useVerdictHold } from './verdict-hold'

/**
 * The rule under test is that the scanner never clears itself.
 *
 * It is the one behaviour in this slice that cannot be checked by looking at the screen: the
 * failure is a verdict that vanished a moment before somebody read it, and the moment it
 * vanished is exactly when nobody was looking. Everything else about the door is visible.
 */
describe('the verdict hold', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms))

  it('does not advance on its own, however long nobody touches it', () => {
    const dismiss = vi.fn()
    renderHook(() => useVerdictHold('a-verdict', dismiss))

    advance(VERDICT_HOLD_MS * 10)

    expect(dismiss).not.toHaveBeenCalled()
  })

  it('ignores a tap in the first four seconds, and acts on it at four', () => {
    const dismiss = vi.fn()
    const held = renderHook(() => useVerdictHold('a-verdict', dismiss))

    advance(1_000)
    act(() => held.result.current.dismiss())
    expect(dismiss).not.toHaveBeenCalled()

    advance(VERDICT_HOLD_MS)
    expect(dismiss).toHaveBeenCalledTimes(1)
  })

  it('advances at once on a tap after the hold', () => {
    const dismiss = vi.fn()
    const held = renderHook(() => useVerdictHold('a-verdict', dismiss))

    advance(VERDICT_HOLD_MS)
    expect(dismiss).not.toHaveBeenCalled()

    act(() => held.result.current.dismiss())
    expect(dismiss).toHaveBeenCalledTimes(1)
  })

  it('counts down to zero so the operator can see why the control is waiting', () => {
    const dismiss = vi.fn()
    const held = renderHook(() => useVerdictHold('a-verdict', dismiss))

    expect(held.result.current.remaining).toBe(4)
    advance(2_000)
    expect(held.result.current.remaining).toBe(2)
    advance(2_000)
    expect(held.result.current.remaining).toBe(0)
  })

  /**
   * The page rebuilds `onDismiss` on every render - it closes over a mutation object that is
   * new each time - and an effect depending on it would restart the four seconds on every
   * render. The hold would never end, and the scanner would stop after one person.
   */
  it('survives a caller that hands it a new callback on every render', () => {
    const dismiss = vi.fn()
    const held = renderHook(() => useVerdictHold('a-verdict', () => dismiss()))

    advance(2_000)
    held.rerender()
    held.rerender()
    advance(2_000)

    act(() => held.result.current.dismiss())
    expect(dismiss).toHaveBeenCalledTimes(1)
  })

  it('starts the four seconds again for the next person', () => {
    const dismiss = vi.fn()
    const held = renderHook(({ key }) => useVerdictHold(key, dismiss), {
      initialProps: { key: 'first' },
    })

    advance(VERDICT_HOLD_MS)
    held.rerender({ key: 'second' })

    expect(held.result.current.remaining).toBe(4)
    act(() => held.result.current.dismiss())
    expect(dismiss).not.toHaveBeenCalled()
  })
})
