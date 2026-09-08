import { instantFromZoned } from './zoned-time'

/**
 * The schedule rules, checked where the person can still see the field.
 *
 * <p>nfr.md is explicit that this is a courtesy and never a control: the server enforces every
 * one of these whatever a client does, and this file exists so that somebody is told while
 * they are still looking at the box rather than after a round trip. The two are not
 * alternatives.
 *
 * <p>Which makes the important property of this file that it says the *same* thing the server
 * says. Each rule below names the server rule it mirrors, so a divergence is visible while
 * reading rather than only when a client refuses something the API would have accepted - which
 * is the worse of the two failures, because there is no error message to notice and no way to
 * proceed.
 *
 * <p>Pure, and taking `now` rather than reading the clock, so the interesting cases are
 * reachable from a test without waiting for them.
 */

export type ScheduleFields = {
  startsAt: string
  doorsOpenAt: string
  endsAt: string
}

export type ScheduleProblems = Partial<Record<keyof ScheduleFields, string>>

/**
 * `Event.requireWindowOrdered` and `Event.requireStillAhead`, in the same order and with the
 * same bounds. Each optional instant is judged on its own, because either may be absent - the
 * server checked them together until half a window turned out to be checked not at all.
 */
export function scheduleProblems(
  form: ScheduleFields,
  { timeZone, published, now }: { timeZone: string; published: boolean; now: Date },
): ScheduleProblems {
  const problems: ScheduleProblems = {}
  const at = (value: string) => {
    if (!value) return null
    try {
      return new Date(instantFromZoned(value, timeZone))
    } catch {
      // A half-typed value is not a mistake worth shouting about. The field's own `required`
      // and the browser's date parsing cover an empty or malformed one, and the server covers
      // everything.
      return null
    }
  }

  const starts = at(form.startsAt)
  const doors = at(form.doorsOpenAt)
  const ends = at(form.endsAt)
  if (!starts) return problems

  // requireStillAhead: only a published event, and only the start time. A draft may sit in the
  // past on purpose - that is how somebody records an event that already happened.
  if (published && starts <= now) {
    problems.startsAt =
      'This event is on sale, so it cannot be moved into the past. Everyone holding a ticket ' +
      'would be emailed a date that has already gone.'
  }

  // requireWindowOrdered, first bound.
  if (doors && doors > starts) {
    problems.doorsOpenAt = 'Doors cannot open after the event has started.'
  }

  // requireWindowOrdered, second bound. Strictly after: an event that ends the instant it
  // starts admits nobody.
  if (ends && ends <= starts) {
    problems.endsAt = 'The event has to end after it starts.'
  }

  return problems
}

export function hasProblem(problems: ScheduleProblems): boolean {
  return Object.keys(problems).length > 0
}
