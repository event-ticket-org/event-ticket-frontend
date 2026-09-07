import { useEffect, useState, type ReactNode } from 'react'
import type { CoverImageSize, Money } from '~/api/types'
import { ApiError, OfflineError, ReadableError } from '~/api/errors'
import { formatInZone, formatMoney, zoneLabel } from './format'

/**
 * The primitives of DESIGN.md. Where a component here and that document disagree, the
 * document is right and this file is the bug.
 */

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

/**
 * The press: the object travels by its own shadow offset and meets the page.
 *
 * Sixty milliseconds, linear. Not eased and not bouncy - the whole point of depicting a
 * physical object is that pressing it should feel mechanical.
 */
const press =
  'transition-[transform,box-shadow] duration-[60ms] ease-linear ' +
  'active:translate-x-1 active:translate-y-1 active:shadow-none motion-reduce:transition-none'

/**
 * The one way a failure is shown.
 *
 * The backend writes messages meant to be read by the person who hit them - they say what
 * went wrong and what to do next - so this shows the message rather than mapping codes to
 * prose of our own, which would only be worse and would drift.
 *
 * It lays out a full sentence rather than a chip. "These seats were taken while you were
 * choosing: A1." is the shape these messages have, and a component built for five words
 * clips the only part worth reading. The border carries stop, not the text: ink on stop is
 * 5.3:1, which is AA rather than AAA, so body prose never sits on it.
 */
export function Problem({ error }: { error: unknown }) {
  if (!error) {
    return null
  }
  // Three kinds of error carry a message somebody wrote on purpose. Everything else is a
  // failure nobody anticipated, and a stack trace is not something to put in front of a
  // person - so it gets the one sentence that is true of all of them.
  const message =
    error instanceof ApiError || error instanceof OfflineError || error instanceof ReadableError
      ? error.message
      : 'Something went wrong. Please try again.'

  return (
    <p role="alert" className="border-[3px] border-stop bg-paper px-4 py-3 text-body text-ink">
      {message}
    </p>
  )
}

/**
 * Label above the input, never a placeholder standing in for one - a placeholder
 * disappears exactly when the person needs it. Placeholders are for format examples.
 */
export function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-label uppercase text-ink">{label}</span>
      {children}
      {hint && <span className="mt-2 block text-body text-ink-soft">{hint}</span>}
    </label>
  )
}

/**
 * 16px, and never smaller: iOS zooms the viewport when an input under 16px takes focus,
 * which on a checkout form throws the buyer's layout away in the middle of the task.
 */
export const inputClass =
  'w-full border-2 border-ink bg-paper px-3 py-3 text-body text-ink ' +
  'placeholder:text-ink-soft focus:border-[3px] disabled:bg-paper-sunk disabled:text-ink'

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'ghost'

const variants: Record<ButtonVariant, string> = {
  // ghost, not solid: an ink shadow behind an ink button is invisible.
  primary: `border-2 border-ink bg-ink text-chalk shadow-raised-ghost hover:shadow-hover-ghost ${press}`,
  secondary: `border-2 border-ink bg-paper text-ink shadow-raised hover:shadow-hover ${press}`,
  // ink on stop, not chalk: the rule is that text on any state fill is ink.
  destructive: `border-2 border-ink bg-stop text-ink shadow-raised hover:shadow-hover ${press}`,
  ghost: 'text-ink underline underline-offset-4',
}

export function Button({
  children,
  pending,
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  pending?: boolean
  variant?: ButtonVariant
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || pending}
      className={cx(
        'inline-flex min-h-11 items-center justify-center px-6 py-3 text-body-strong',
        variants[variant],
        variant !== 'ghost' &&
          // Raised means actionable, flat means not - losing the shadow is the whole
          // signal, so the text keeps full contrast and the border stays ink.
          'disabled:cursor-not-allowed disabled:bg-paper-sunk disabled:text-ink disabled:shadow-none',
        className ?? 'w-full',
      )}
    >
      {/* No spinner. An animation that says nothing costs the same space as a word that
          does, and the word survives prefers-reduced-motion. */}
      {pending ? 'Working…' : children}
    </button>
  )
}

/**
 * The chip carries the status word; it is never a bare coloured dot. Colour is the second
 * signal here, not the only one - which is what makes it work for a colour-blind organizer
 * scanning a list of forty orders.
 */
export const statusColours: Record<string, string> = {
  // Every value of every status enum in the contract, so nothing falls through to the
  // neutral fill by accident - PENDING_APPROVAL did, and rendered a waiting organization
  // as though it had no status at all.
  //
  // OrganizationStatus
  PENDING_APPROVAL: 'bg-hold',
  APPROVED: 'bg-go',
  REJECTED: 'bg-stop',
  // EventStatus
  DRAFT: 'bg-hold',
  PUBLISHED: 'bg-go',
  SALES_CLOSED: 'bg-paper-sunk',
  COMPLETED: 'bg-paper-sunk',
  CANCELLED: 'bg-stop',
  // OrderStatus
  AWAITING_PAYMENT: 'bg-hold',
  PAID: 'bg-go',
  EXPIRED: 'bg-stop',
  REFUNDED: 'bg-go',
  // Ticket status
  VALID: 'bg-go',
  REDEEMED: 'bg-paper-sunk',
  VOID: 'bg-stop',
  // RefundStatus
  REFUND_PENDING: 'bg-hold',
  REFUND_FAILED: 'bg-stop',
  // ScanOutcome
  ADMITTED: 'bg-go',
  ALREADY_REDEEMED: 'bg-stop',
  WRONG_EVENT: 'bg-stop',
  TICKET_VOID: 'bg-stop',
  EVENT_NOT_OPEN: 'bg-hold',
  EVENT_ENDED: 'bg-hold',
  UNKNOWN_CODE: 'bg-stop',
}

export function StatusChip({ status }: { status: string }) {
  return (
    <span
      className={cx(
        'inline-block border-2 border-ink px-2 py-1 text-label uppercase text-ink',
        statusColours[status] ?? 'bg-paper-sunk',
      )}
    >
      {status.replace(/_/g, ' ')}
    </span>
  )
}

/** Says what is not here and how to change that. No illustration, no icon. */
export function EmptyState({
  headline,
  children,
  action,
}: {
  headline: string
  children?: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="border-2 border-ink bg-paper p-8">
      <h2 className="text-display">{headline}</h2>
      {children && <p className="mt-4 max-w-[68ch] text-body text-ink-soft">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

/** Cards are bordered objects, not soft surfaces. A shadow here always has a border. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cx('border-2 border-ink bg-paper p-6 shadow-raised', className)}>
      {children}
    </div>
  )
}

/**
 * An Event's cover - somebody else's file on somebody else's server, and handled like it.
 *
 * Renders nothing at all when there is no URL or when the URL fails to load. Not a placeholder,
 * which is a promise of content that is not coming; not a broken-image icon with the title read
 * out beside it. A rotted link, a host that blocks hotlinking and an organizer who pasted a page
 * instead of an image are the ordinary cases here rather than the edge ones.
 *
 * The alt text is the organizer's, and an empty one is an answer rather than an omission: a
 * cover nobody described is marked decorative, because the only other string available is the
 * title - which is already beside the picture, and repeating it makes a screen reader say
 * everything twice. `no-referrer` because a store put behind a CDN we did not choose does not
 * need to be told which of our pages somebody is reading.
 */
/**
 * How wide this picture is drawn, for the browser to pick a rendering by.
 *
 * The public shell is `max-w-[640px] px-4`, so a cover is 608px on anything wider than the
 * shell and the viewport minus its padding below that. Both shapes get the same value, and
 * that is not an oversight: `band` and `hero` differ in height, and `object-fit: cover` crops
 * the difference vertically - the horizontal resolution they need is identical.
 */
const COVER_SIZES = '(min-width: 640px) 608px, calc(100vw - 32px)'

export function CoverImage({
  src,
  alt,
  className,
  eager = false,
  shape = 'hero',
  sizes,
}: {
  src?: string | null
  /** What the picture shows. Absent means nobody described it, not that nobody should hear it. */
  alt?: string | null
  className?: string
  /** For the one cover that is already in the viewport. Deferring that one only makes it late. */
  eager?: boolean
  /**
   * The renderings the server made (requirements/003 criterion 22). Absent or empty is
   * ordinary - a small upload has nothing smaller, and AVIF has no decoder on the server - and
   * `src` is always a real image, so the fallback costs nothing but bandwidth.
   */
  sizes?: readonly CoverImageSize[] | null
  /**
   * `hero` is 16:9, for the event's own page where the picture is the subject. `band` is a
   * fixed 140px strip, for a listing card where it is one line of evidence among five.
   *
   * DESIGN.md carries the reasoning. The short version: 16:9 across a 640px column is a 360px
   * image, which made a card with a cover more than three times the height of one without, and
   * a list whose rows vary that much cannot be scanned. The 16:9 rule was written for a grid,
   * and there is no grid in the public shell.
   */
  shape?: 'hero' | 'band'
}) {
  const [failed, setFailed] = useState(false)
  // A new URL deserves its own attempt - which is the whole point of the manager's live
  // preview, where the previous value failing is exactly why somebody is typing another.
  useEffect(() => setFailed(false), [src])

  if (!src || failed) {
    return null
  }
  // `src` stays the largest and is what a browser without srcset support fetches - and what
  // every browser fetches when the server could not render anything smaller.
  const srcSet = sizes?.length
    ? sizes.map((size) => `${size.url} ${size.width}w`).join(', ')
    : undefined

  return (
    <img
      src={src}
      srcSet={srcSet}
      sizes={srcSet ? COVER_SIZES : undefined}
      alt={alt ?? ''}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cx(
        'w-full border-2 border-ink bg-paper object-cover',
        shape === 'hero' ? 'aspect-[16/9]' : 'h-35',
        className,
      )}
    />
  )
}

/**
 * Every time shown to a person, with the zone it is in.
 *
 * Times render in the Venue's timezone and never the browser's (nfr.md), which makes a
 * bare clock face actively misleading: a buyer in Da Nang sees Hanoi's start time and has
 * no way to know it is not their own. The marker is the whole component.
 */
export function TimeWithZone({
  iso,
  timeZone,
  label,
}: {
  iso: string
  timeZone: string
  label?: string
}) {
  return (
    <span className="inline-flex items-baseline gap-2">
      <time dateTime={iso} className="font-numeric text-numeric text-ink">
        {formatInZone(iso, timeZone)}
      </time>
      <span className="text-label uppercase text-ink-soft">
        {label ?? zoneLabel(timeZone)} time
      </span>
    </span>
  )
}

/**
 * On any screen where money moves, the largest object on it. Never grey, never smaller
 * than the button beneath it, never right-aligned into a corner.
 */
export function MoneyTotal({ money }: { money: Money }) {
  return (
    <span className="font-numeric text-numeric-lg text-ink">{formatMoney(money)}</span>
  )
}

/**
 * A group of related controls that behaves as one physical object.
 *
 * Elevation is the affordance in this system: raised means actionable, flat means not. A row
 * of individually flat buttons therefore reads as a row of disabled ones - and a row of
 * individually raised buttons is three shadows fighting where there is one control. So the
 * *group* carries the border and the shadow, and the segments inside it are keys on it,
 * divided by rules rather than separated by gaps.
 *
 * The first version of the zoom controls had it both ways: two bare flat buttons joined to a
 * secondary Button that brought its own shadow, which is what made the seam obvious.
 */
export function Segmented({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex border-2 border-ink bg-paper shadow-raised [&>*+*]:border-l-2 [&>*]:border-ink"
    >
      {children}
    </div>
  )
}

export function Segment({
  selected,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      {...props}
      aria-pressed={selected}
      className={cx(
        // 48px, so the group - which adds its own 2px top and bottom - stands exactly as
        // tall as a Button beside it. A row of controls that steps by four pixels is the
        // kind of thing you see before you can say what is wrong with it.
        'inline-flex min-h-12 items-center justify-center px-4 text-label uppercase',
        // No press travel: the group is the object that would move, and moving one key of it
        // looks broken. The fill is the feedback instead.
        selected ? 'bg-ink text-chalk' : 'bg-paper text-ink hover:bg-info/20 active:bg-info',
        className,
      )}
    />
  )
}
