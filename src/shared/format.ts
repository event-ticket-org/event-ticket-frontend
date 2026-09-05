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
