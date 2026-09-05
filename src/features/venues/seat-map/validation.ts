import type { SeatMap, SeatMapSeat } from '~/api/types'

/**
 * The two rules the server enforces, checked here as you edit.
 *
 * The map is saved as one atomic document, so a single duplicate label rejects two thousand
 * good seats and the person is told about one of them. Checking live turns that into a thing
 * you can see and fix before pressing Save, which is the difference between a usable editor
 * and one that punishes bulk work.
 *
 * These mirror `SeatMapDocument.validated()` exactly - exact-match labels, positions keyed
 * `x,y` - because a check that is merely similar to the server's would let through the edits
 * it disagrees about, which is worse than not checking at all.
 */

export type SeatMapProblem =
  | { kind: 'BLANK_LABEL'; count: number }
  | { kind: 'DUPLICATE_LABEL'; label: string; count: number }
  | { kind: 'SHARED_POSITION'; labels: string[]; x: number; y: number }

export function validateSeatMap(map: Pick<SeatMap, 'seats'>): SeatMapProblem[] {
  const problems: SeatMapProblem[] = []

  const blank = map.seats.filter((seat) => seat.label.trim().length === 0).length
  if (blank > 0) {
    problems.push({ kind: 'BLANK_LABEL', count: blank })
  }

  const byLabel = new Map<string, number>()
  const byPosition = new Map<string, SeatMapSeat[]>()

  for (const seat of map.seats) {
    if (seat.label.trim().length > 0) {
      byLabel.set(seat.label, (byLabel.get(seat.label) ?? 0) + 1)
    }
    const key = positionKey(seat)
    byPosition.set(key, [...(byPosition.get(key) ?? []), seat])
  }

  for (const [label, count] of byLabel) {
    if (count > 1) {
      problems.push({ kind: 'DUPLICATE_LABEL', label, count })
    }
  }

  for (const seats of byPosition.values()) {
    const first = seats[0]
    if (seats.length > 1 && first) {
      problems.push({
        kind: 'SHARED_POSITION',
        labels: seats.map((seat) => seat.label),
        x: first.x,
        y: first.y,
      })
    }
  }

  return problems
}

/** Exactly the server's key: `seat.x() + "," + seat.y()`. */
export function positionKey(seat: Pick<SeatMapSeat, 'x' | 'y'>): string {
  return `${seat.x},${seat.y}`
}

export function describeProblem(problem: SeatMapProblem): string {
  switch (problem.kind) {
    case 'BLANK_LABEL':
      return problem.count === 1
        ? 'One seat has no label. Every seat needs one.'
        : `${problem.count} seats have no label. Every seat needs one.`
    case 'DUPLICATE_LABEL':
      return `${problem.count} seats are labelled ${problem.label}. A label is how somebody finds their seat, so it has to be unique.`
    case 'SHARED_POSITION':
      return `${problem.labels.join(' and ')} sit on top of each other. One of them would be unclickable, and so unsellable.`
  }
}

/** The tier names in use, in the order they first appear - the same order the server reports. */
export function tierNamesInUse(seats: SeatMapSeat[]): string[] {
  const names: string[] = []
  for (const seat of seats) {
    if (!names.includes(seat.tierName)) {
      names.push(seat.tierName)
    }
  }
  return names
}
