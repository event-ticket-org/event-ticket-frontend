/**
 * Wall-clock times in a Venue's timezone, both directions.
 *
 * An organizer types "19:30" meaning half past seven *at the venue*, and the contract carries
 * instants. `<input type="datetime-local">` gives back a naive string with no zone attached,
 * and every obvious way of turning one into an instant - `new Date(local)`, `Date.parse` -
 * silently uses the *browser's* zone. On a laptop in Hanoi that produces the right answer for
 * a Hanoi venue, which is precisely why it survives to production and then breaks for the
 * first organizer in Bangkok, or for a Da Nang venue when the person editing is abroad.
 *
 * `nfr.md` calls this out: Vietnam is a single zone with no daylight saving, which is what
 * makes it easy to get wrong and never notice. So these are written to be correct for zones
 * that do have daylight saving, and tested against one.
 */

/**
 * How far the named zone is from UTC at a given instant, in milliseconds.
 *
 * Read out of `Intl` rather than from a table: it is the only source in the platform that
 * knows the rules, including the ones that changed last year.
 */
function offsetAt(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(instant))

  const field = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? '0')

  // `hour` comes back as 24 at midnight under hour12: false in some engines.
  const asIfUtc = Date.UTC(
    field('year'),
    field('month') - 1,
    field('day'),
    field('hour') % 24,
    field('minute'),
    field('second'),
  )
  return asIfUtc - instant
}

/**
 * A wall-clock string in a zone, to the instant it names.
 *
 * Two passes, because the offset depends on the instant we are trying to find. The first
 * guess uses the offset at the naive time; the second uses the offset at that guess, which
 * settles it either side of a daylight-saving boundary.
 *
 * @param local `YYYY-MM-DDTHH:mm`, as a `datetime-local` input produces
 */
export function instantFromZoned(local: string, timeZone: string): string {
  // Checked by shape rather than by asking Date.parse to fail. V8 accepts a great deal and
  // returns a date for much of it, so a malformed value would become a confidently wrong
  // instant instead of an error - and this one ends up on a ticket.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) {
    throw new RangeError(`not a local date-time: ${JSON.stringify(local)}`)
  }
  const naive = Date.parse(`${local}:00Z`)
  if (Number.isNaN(naive)) {
    throw new RangeError(`not a real date-time: ${JSON.stringify(local)}`)
  }
  const firstGuess = naive - offsetAt(naive, timeZone)
  const settled = naive - offsetAt(firstGuess, timeZone)
  return new Date(settled).toISOString()
}

/**
 * An instant, as the wall-clock string a `datetime-local` input wants.
 *
 * `sv-SE` because its date format is ISO-shaped, which is what the input parses; the locale
 * is a formatting trick and says nothing about the person reading.
 */
export function zonedInputValue(iso: string, timeZone: string): string {
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) {
    return ''
  }
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(at)

  const field = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00'

  return `${field('year')}-${field('month')}-${field('day')}T${field('hour') === '24' ? '00' : field('hour')}:${field('minute')}`
}

/** Whether an instant is in the past, for a form that must not schedule backwards. */
export function isPast(iso: string | null | undefined, now: number = Date.now()): boolean {
  return iso != null && new Date(iso).getTime() <= now
}
