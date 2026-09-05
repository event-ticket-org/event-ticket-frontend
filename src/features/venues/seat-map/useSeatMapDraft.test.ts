import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { SeatMap } from '~/api/types'
import { useSeatMapDraft } from './useSeatMapDraft'

/**
 * The rule under test is that a seat is identified by its index and never by its label.
 *
 * A label is unique only in a *valid* map, and the interval where it is not is exactly what
 * an editor is for. Keyed by label, renaming B1 to A1 selected both seats, moved both and
 * renamed both - so a duplicate could not be repaired without discarding the whole draft.
 * That shipped once and looked entirely reasonable in the code.
 */

const saved: SeatMap = {
  seats: [
    { label: 'A1', x: 0, y: 0, tierName: 'Standard' },
    { label: 'B1', x: 0, y: 1, tierName: 'Standard' },
    { label: 'B2', x: 1, y: 1, tierName: 'Standard' },
  ],
  elements: [],
}

describe('a seat is identified by index, not by label', () => {
  it('selects one of two seats that share a label', () => {
    const { result } = renderHook(() => useSeatMapDraft(saved))

    act(() => result.current.relabelSeat(1, 'A1'))
    expect(result.current.problems).toContainEqual({
      kind: 'DUPLICATE_LABEL',
      label: 'A1',
      count: 2,
    })

    act(() => result.current.toggle(1, false))
    expect(result.current.selection).toEqual(new Set([1]))
  })

  it('repairs a duplicate rather than renaming both halves of it', () => {
    const { result } = renderHook(() => useSeatMapDraft(saved))

    act(() => result.current.relabelSeat(1, 'A1'))
    act(() => result.current.relabelSeat(1, 'B1'))

    expect(result.current.map.seats.map((seat) => seat.label)).toEqual(['A1', 'B1', 'B2'])
    expect(result.current.problems).toEqual([])
  })

  it('moves only the selected seat when two share a label', () => {
    const { result } = renderHook(() => useSeatMapDraft(saved))

    act(() => result.current.relabelSeat(1, 'A1'))
    act(() => result.current.toggle(1, false))
    act(() => result.current.beginDrag([1], null))
    act(() => result.current.dragSelectionTo(5, 0))

    expect(result.current.map.seats[0]).toMatchObject({ x: 0, y: 0 })
    expect(result.current.map.seats[1]).toMatchObject({ x: 5, y: 1 })
  })
})

describe('the draft', () => {
  it('is clean until something changes it, and clean again once it settles', () => {
    const { result } = renderHook(() => useSeatMapDraft(saved))
    expect(result.current.dirty).toBe(false)

    act(() => result.current.relabelSeat(0, 'A9'))
    expect(result.current.dirty).toBe(true)

    // Called only once the server has the map. Leaving it dirty afterwards keeps the Save
    // button live and the unsaved-changes warning firing over a map already saved.
    act(() => result.current.settle())
    expect(result.current.dirty).toBe(false)
    expect(result.current.map.seats[0]?.label).toBe('A1')
  })

  it('discards back to the server copy', () => {
    const { result } = renderHook(() => useSeatMapDraft(saved))
    act(() => result.current.deleteSelection())
    act(() => result.current.relabelSeat(0, 'ZZ9'))
    act(() => result.current.discard())

    expect(result.current.map).toBe(saved)
    expect(result.current.selection.size).toBe(0)
  })

  it('selects what it generated, and only that', () => {
    const { result } = renderHook(() => useSeatMapDraft(saved))

    act(() => {
      result.current.addSeats({
        rows: 2,
        seatsPerRow: 2,
        firstRowLabel: 'M',
        firstSeatNumber: 1,
        originX: 0,
        originY: 10,
        seatGap: 1,
        rowGap: 1,
        tierName: 'VIP',
      })
    })

    // Appending never moves what was already there, which is what makes these stable.
    expect(result.current.selection).toEqual(new Set([3, 4, 5, 6]))
    expect(result.current.map.seats).toHaveLength(7)
    expect(result.current.tiers).toEqual(['Standard', 'VIP'])
  })

  it('retiers only the selection', () => {
    const { result } = renderHook(() => useSeatMapDraft(saved))
    act(() => result.current.toggle(2, false))
    act(() => result.current.retierSelection('VIP'))

    expect(result.current.map.seats.map((seat) => seat.tierName)).toEqual([
      'Standard',
      'Standard',
      'VIP',
    ])
  })

  it('deletes the selection and forgets it, so stale indices cannot be reused', () => {
    const { result } = renderHook(() => useSeatMapDraft(saved))
    act(() => result.current.toggle(0, false))
    act(() => result.current.deleteSelection())

    expect(result.current.map.seats.map((seat) => seat.label)).toEqual(['B1', 'B2'])
    expect(result.current.selection.size).toBe(0)
  })
})

describe('landmarks', () => {
  const stage = { kind: 'STAGE' as const, label: 'Stage', x: 0, y: -3, width: 8, height: 1.5 }

  it('selects what it just placed, so the next move is putting it somewhere', () => {
    const { result } = renderHook(() => useSeatMapDraft(saved))
    act(() => result.current.addElement(stage))

    expect(result.current.elementSelection).toBe(0)
    expect(result.current.map.elements).toHaveLength(1)
  })

  it('can be moved, which is the whole reason it is selectable', () => {
    // It used to land at a fixed position and stay there: the only thing you could do with a
    // stage in the wrong place was delete it.
    const { result } = renderHook(() => useSeatMapDraft(saved))
    act(() => result.current.addElement(stage))
    act(() => result.current.moveElement(0, 4, 1))

    expect(result.current.map.elements[0]).toMatchObject({ x: 4, y: -2 })
  })

  it('is never selected at the same time as seats', () => {
    // The two are edited differently - seats move in bulk and take a tier, a landmark has a
    // kind and a size - so a mixed selection would have to explain which operations apply.
    const { result } = renderHook(() => useSeatMapDraft(saved))
    act(() => result.current.addElement(stage))
    act(() => result.current.toggle(0, false))
    expect(result.current.elementSelection).toBeNull()

    act(() => result.current.selectElement(0))
    expect(result.current.selection.size).toBe(0)
  })

  it('forgets the selection on removal, so a shifted index cannot be reused', () => {
    const { result } = renderHook(() => useSeatMapDraft(saved))
    act(() => result.current.addElement(stage))
    act(() => result.current.addElement({ ...stage, kind: 'BAR', label: 'Bar' }))
    act(() => result.current.removeElement(0))

    expect(result.current.elementSelection).toBeNull()
    expect(result.current.map.elements.map((e) => e.kind)).toEqual(['BAR'])
  })

  it('edits in place', () => {
    const { result } = renderHook(() => useSeatMapDraft(saved))
    act(() => result.current.addElement(stage))
    act(() => result.current.updateElement(0, { kind: 'ENTRANCE', label: 'Cửa vào' }))

    expect(result.current.map.elements[0]).toMatchObject({ kind: 'ENTRANCE', label: 'Cửa vào' })
  })
})
