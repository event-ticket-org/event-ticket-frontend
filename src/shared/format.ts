import type { Money } from '~/api/types'

/**
 * Money, in the currency's smallest unit.
 *
 * VND has no minor unit - ISO 4217 exponent 0 - so the amount *is* the dong. Dividing
 * by 100 to "convert from cents" is the factory-standard way to be wrong by a factor of
 * a hundred here, and `Intl` already knows the rule, so the amount goes in untouched.
 */
export function formatMoney(money: Money): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: money.currency,
    maximumFractionDigits: 0,
  }).format(money.amount)
}

/**
 * An instant, rendered in the Venue's timezone.
 *
 * Always the Venue's, never the browser's (nfr.md). A buyer in Da Nang looking at a
 * Hanoi event must see Hanoi's local start time, and Vietnam being a single zone with
 * no daylight saving is exactly what makes this easy to get wrong and never notice
 * while developing here.
 *
 * `toLocaleString` and friends are banned by an eslint rule for the same reason - they
 * silently use the browser's zone and look right on every machine that matters to us.
 */
export function formatInZone(iso: string, timeZone: string, options?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
    ...options,
  }).format(new Date(iso))
}

export function formatDateInZone(iso: string, timeZone: string): string {
  return formatInZone(iso, timeZone, { dateStyle: 'full', timeStyle: undefined })
}

export function formatTimeInZone(iso: string, timeZone: string): string {
  return formatInZone(iso, timeZone, { dateStyle: undefined, timeStyle: 'short' })
}

/**
 * A countdown, for the Seat Hold clock a buyer watches during checkout
 * (requirements/004 criterion 8). Returns null once it has run out, so a caller has to
 * decide what to say rather than showing "-0:03".
 */
export function remainingUntil(iso: string, now: number = Date.now()): string | null {
  const seconds = Math.floor((new Date(iso).getTime() - now) / 1000)
  if (seconds <= 0) {
    return null
  }
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

/**
 * The short name for a timezone, for the marker that goes beside every displayed time.
 *
 * A bare clock face is ambiguous in exactly the way that matters here: times render in
 * the Venue's zone, so a buyer in Da Nang reads Hanoi's clock, and nothing on screen
 * tells them it is not their own unless we say so.
 */
export function zoneLabel(timeZone: string): string {
  const city = timeZone.split('/').pop() ?? timeZone
  return city.replace(/_/g, ' ')
}

/**
 * How far away something is, as a duration.
 *
 * Deliberately durations and never calendar words. "Tomorrow" is a question about which day it
 * is somewhere, and this application has two candidate zones for that - the reader's and the
 * Venue's - which is exactly the ambiguity nfr.md's timezone rule exists to remove. A duration
 * has no such problem: three weeks is three weeks in Hanoi and in Da Nang, so this can sit
 * beside a venue-zone clock without contradicting it.
 *
 * Null once the moment has passed, so a caller decides what to say rather than showing
 * "in -2 days" on a listing that should not have contained the event at all.
 */
export function timeUntil(iso: string, now: number = Date.now()): string | null {
  const ms = new Date(iso).getTime() - now
  if (ms <= 0) {
    return null
  }
  const hours = Math.round(ms / 3_600_000)
  if (hours < 1) {
    return 'within the hour'
  }
  if (hours < 24) {
    return `in ${hours} ${plural(hours, 'hour')}`
  }
  const days = Math.round(hours / 24)
  if (days < 14) {
    return `in ${days} ${plural(days, 'day')}`
  }
  const weeks = Math.round(days / 7)
  if (weeks < 9) {
    return `in ${weeks} ${plural(weeks, 'week')}`
  }
  const months = Math.round(days / 30)
  return `in ${months} ${plural(months, 'month')}`
}

function plural(count: number, noun: string): string {
  return count === 1 ? noun : `${noun}s`
}

/**
 * The month an event falls in, for the separators that break a long listing into something
 * scannable.
 *
 * In the Venue's zone, like the date on the card below it - a heading that disagreed with the
 * rows under it would be worse than no heading. Vietnam is a single zone (nfr.md), so the
 * headings of a listing ordered by instant stay in order; a market spanning several zones would
 * need this computing from one chosen zone instead.
 */
export function monthInZone(iso: string, timeZone: string): string {
  return formatInZone(iso, timeZone, {
    dateStyle: undefined,
    timeStyle: undefined,
    month: 'long',
    year: 'numeric',
  })
}
