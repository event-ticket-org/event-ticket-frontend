import { useCallback, useMemo, useState } from 'react'
import type { MapElement, SeatMap } from '~/api/types'
import { boundsOf, padBounds, seatsWithin, type Bounds, type Rect } from './geometry'
import { generateBlock, type BlockSpec } from './generator'
import { tierNamesInUse, validateSeatMap } from './validation'

/**
 * The editor's state.
 *
 * A draft, not the server's copy: the map is saved as one document, so nothing is written
 * until Save and every edit here is local.
 *
 * Seats are identified by their index in the array. A Seat Map has no ids, and a label is
 * only unique in a *valid* map - which is exactly the state the editor spends its time
 * outside. Keyed by label, renaming B1 to A1 selects both, moves both and renames both, so a
 * duplicate could never be repaired; keyed by index, the two are distinct and one of them can
 * be fixed. Nothing here reorders the array, which is what makes the index stable.
 */
export function useSeatMapDraft(saved: SeatMap | undefined) {
  const [draft, setDraft] = useState<SeatMap | null>(null)
  const [selection, setSelection] = useState<Set<number>>(new Set())
  const [view, setView] = useState<Bounds | null>(null)

  // Memoised, and not for tidiness: `draft ?? saved ?? EMPTY` is a fresh object on every
  // render when both are null, so everything derived from it would recompute over all two
  // thousand seats every time the pointer moves.
  const map = useMemo(() => draft ?? saved ?? EMPTY_MAP, [draft, saved])
  const dirty = draft !== null

  const problems = useMemo(() => validateSeatMap(map), [map])
  const tiers = useMemo(() => tierNamesInUse(map.seats), [map.seats])

  const contentBounds = useMemo(() => {
    const bounds = boundsOf(map)
    return bounds ? padBounds(bounds, 1) : EMPTY_BOUNDS
  }, [map])
  const bounds = view ?? contentBounds

  const edit = useCallback(
    (change: (current: SeatMap) => SeatMap) =>
      setDraft((current) => change(current ?? saved ?? EMPTY_MAP)),
    [saved],
  )

  const addSeats = useCallback(
    (spec: BlockSpec) => {
      const added = generateBlock(spec)
      edit((current) => {
        const seats = [...current.seats, ...added]
        // Selected while we know where they landed: appending never moves what is already
        // there, so these indices stay correct.
        setSelection(new Set(added.map((_, offset) => current.seats.length + offset)))
        return { ...current, seats }
      })
      return added
    },
    [edit],
  )

  const moveSelection = useCallback(
    (dx: number, dy: number) =>
      edit((current) => ({
        ...current,
        seats: current.seats.map((seat, index) =>
          selection.has(index)
            ? { ...seat, x: round(seat.x + dx), y: round(seat.y + dy) }
            : seat,
        ),
      })),
    [edit, selection],
  )

  const retierSelection = useCallback(
    (tierName: string) =>
      edit((current) => ({
        ...current,
        seats: current.seats.map((seat, index) =>
          selection.has(index) ? { ...seat, tierName } : seat,
        ),
      })),
    [edit, selection],
  )

  const deleteSelection = useCallback(() => {
    edit((current) => ({
      ...current,
      seats: current.seats.filter((_, index) => !selection.has(index)),
    }))
    setSelection(new Set())
  }, [edit, selection])

  /** One seat, by index - which is the whole reason the index exists. */
  const relabelSeat = useCallback(
    (target: number, label: string) => {
      edit((current) => ({
        ...current,
        seats: current.seats.map((seat, index) => (index === target ? { ...seat, label } : seat)),
      }))
    },
    [edit],
  )

  const addElement = useCallback(
    (element: MapElement) => edit((current) => ({ ...current, elements: [...current.elements, element] })),
    [edit],
  )

  const removeElement = useCallback(
    (index: number) =>
      edit((current) => ({
        ...current,
        elements: current.elements.filter((_, at) => at !== index),
      })),
    [edit],
  )

  const selectWithin = useCallback(
    (rect: Rect, additive: boolean) => {
      const inside = map.seats
        .map((seat, index) => [seat, index] as const)
        .filter(([seat]) => seatsWithin([seat], rect).length > 0)
        .map(([, index]) => index)
      setSelection((current) => (additive ? new Set([...current, ...inside]) : new Set(inside)))
    },
    [map.seats],
  )

  const toggle = useCallback((index: number, additive: boolean) => {
    setSelection((current) => {
      if (!additive) {
        return new Set([index])
      }
      const next = new Set(current)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }, [])

  /** After a save, the draft is dropped so the server's copy becomes the truth again. */
  const settle = useCallback(() => setDraft(null), [])

  const discard = useCallback(() => {
    setDraft(null)
    setSelection(new Set())
  }, [])

  return {
    map,
    dirty,
    problems,
    tiers,
    bounds,
    selection,
    setView,
    addSeats,
    moveSelection,
    retierSelection,
    deleteSelection,
    relabelSeat,
    addElement,
    removeElement,
    selectWithin,
    toggle,
    settle,
    discard,
  }
}

/** Stable identities, so nothing downstream recomputes because of a new empty object. */
const EMPTY_MAP: SeatMap = { seats: [], elements: [] }
const EMPTY_BOUNDS: Bounds = { minX: -6, minY: -4, maxX: 6, maxY: 4 }

function round(value: number): number {
  return Math.round(value * 1000) / 1000
}
