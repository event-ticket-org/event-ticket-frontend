import { useCallback, useMemo, useRef, useState } from 'react'
import type { MapElement, SeatMap } from '~/api/types'
import { boundsOf, padBounds, seatsWithin, snap, type Bounds, type Rect } from './geometry'
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
  // A landmark is selected on its own rather than joining the seat selection: the two are
  // edited differently - seats move in bulk and take a tier, a landmark is one object with a
  // kind and a size - and a mixed selection would have to explain which operations apply.
  const [elementSelection, setElementSelection] = useState<number | null>(null)
  const [view, setView] = useState<Bounds | null>(null)
  /**
   * Where the dragged things were when the drag began.
   *
   * Every move is computed from here plus the total distance travelled, never from the last
   * frame. Applying each frame's delta on top of the previous *snapped* result compounds the
   * rounding: a three-pixel nudge rounds up to a whole quarter-unit, that becomes the new
   * base, and the seat leaves the cursor behind at roughly twice its speed. Absolute from
   * the origin has no accumulated error, and a movement smaller than the snap simply does
   * not move anything rather than being silently lost.
   */
  const dragOrigin = useRef<{
    seats: Map<number, { x: number; y: number }>
    element: { index: number; x: number; y: number } | null
  }>({ seats: new Map(), element: null })

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

  /**
   * Remembers where the things being dragged are, so the drag can be absolute.
   *
   * Takes the indices rather than reading `selection`, because the seat under the pointer is
   * usually selected by the very handler that starts the drag - and a state setter has not
   * taken effect by the next line, so reading `selection` here snapshots the selection as it
   * was *before* the click and the drag moves nothing at all.
   */
  const beginDrag = useCallback(
    (seatIndices: Iterable<number>, element: number | null) => {
      const seats = new Map<number, { x: number; y: number }>()
      for (const index of seatIndices) {
        const seat = map.seats[index]
        if (seat) {
          seats.set(index, { x: seat.x, y: seat.y })
        }
      }
      const target = element === null ? undefined : map.elements[element]
      dragOrigin.current = {
        seats,
        element:
          element !== null && target ? { index: element, x: target.x, y: target.y } : null,
      }
    },
    [map.seats, map.elements],
  )

  /**
   * Total distance from where the drag started, not the step since the last frame.
   *
   * Snapped, so that dropping one seat on another is an exact collision the validator can
   * see - a drag measured in pixels never lands on another seat's coordinates by equality,
   * so overlaps used to pass straight through.
   */
  const dragSelectionTo = useCallback(
    (dx: number, dy: number, step?: number) => {
      const origin = dragOrigin.current.seats
      if (origin.size === 0) {
        return
      }
      edit((current) => ({
        ...current,
        seats: current.seats.map((seat, index) => {
          const from = origin.get(index)
          return from ? { ...seat, x: snap(from.x + dx, step), y: snap(from.y + dy, step) } : seat
        }),
      }))
    },
    [edit],
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

  /** Places a landmark and selects it, so the next thing you do is put it where it goes. */
  const addElement = useCallback(
    (element: MapElement) =>
      edit((current) => {
        setElementSelection(current.elements.length)
        setSelection(new Set())
        return { ...current, elements: [...current.elements, element] }
      }),
    [edit],
  )

  const updateElement = useCallback(
    (target: number, patch: Partial<MapElement>) =>
      edit((current) => ({
        ...current,
        elements: current.elements.map((element, index) =>
          index === target ? { ...element, ...patch } : element,
        ),
      })),
    [edit],
  )

  const dragElementTo = useCallback(
    (dx: number, dy: number, step?: number) => {
      const origin = dragOrigin.current.element
      if (!origin) {
        return
      }
      edit((current) => ({
        ...current,
        elements: current.elements.map((element, index) =>
          index === origin.index
            ? { ...element, x: snap(origin.x + dx, step), y: snap(origin.y + dy, step) }
            : element,
        ),
      }))
    },
    [edit],
  )

  /** Nudging with the keyboard is still relative, and has no cursor to drift from. */
  const moveElement = useCallback(
    (target: number, dx: number, dy: number) =>
      edit((current) => ({
        ...current,
        elements: current.elements.map((element, index) =>
          index === target
            ? { ...element, x: snap(element.x + dx), y: snap(element.y + dy) }
            : element,
        ),
      })),
    [edit],
  )

  const selectElement = useCallback((index: number | null) => {
    setElementSelection(index)
    if (index !== null) {
      setSelection(new Set())
    }
  }, [])

  const removeElement = useCallback(
    (index: number) => {
      edit((current) => ({
        ...current,
        elements: current.elements.filter((_, at) => at !== index),
      }))
      // Indices after this one shift, so holding on to the old number would select a
      // different landmark than the one that was there a moment ago.
      setElementSelection(null)
    },
    [edit],
  )

  const selectWithin = useCallback(
    (rect: Rect, additive: boolean) => {
      setElementSelection(null)
      const inside = map.seats
        .map((seat, index) => [seat, index] as const)
        .filter(([seat]) => seatsWithin([seat], rect).length > 0)
        .map(([, index]) => index)
      setSelection((current) => (additive ? new Set([...current, ...inside]) : new Set(inside)))
    },
    [map.seats],
  )

  /**
   * Nothing selected at all - seats and the landmark both.
   *
   * `selectElement(null)` only puts down the landmark, because a pointer never needs to let go
   * of both at once: a click on the background is already followed by a marquee that replaces
   * the seat selection. Escape has no such second half.
   */
  const clearSelection = useCallback(() => {
    setSelection(new Set())
    setElementSelection(null)
  }, [])

  const toggle = useCallback((index: number, additive: boolean) => {
    setElementSelection(null)
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
    setElementSelection(null)
  }, [])

  return {
    map,
    dirty,
    problems,
    tiers,
    bounds,
    contentBounds,
    selection,
    elementSelection,
    selectElement,
    setView,
    addSeats,
    beginDrag,
    dragSelectionTo,
    dragElementTo,
    retierSelection,
    deleteSelection,
    relabelSeat,
    addElement,
    updateElement,
    moveElement,
    removeElement,
    selectWithin,
    toggle,
    clearSelection,
    settle,
    discard,
  }
}

/** Stable identities, so nothing downstream recomputes because of a new empty object. */
const EMPTY_MAP: SeatMap = { seats: [], elements: [] }
const EMPTY_BOUNDS: Bounds = { minX: -6, minY: -4, maxX: 6, maxY: 4 }

