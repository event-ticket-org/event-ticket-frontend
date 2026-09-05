import type { ReactNode } from 'react'
import type { Money } from '~/api/types'
import { ApiError, OfflineError } from '~/api/errors'
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
  const message =
    error instanceof ApiError || error instanceof OfflineError
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
