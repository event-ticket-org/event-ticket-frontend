import type { Event, Money } from '~/api/types'

/**
 * What the dashboard says, worked out apart from how it looks.
 *
 * Here rather than inside the components because these are the decisions: which alarms fire,
 * what the totals are, and which events count as next. A component that both computes and
 * draws can only be checked by rendering it, and what would be checked is mostly the markup.
 */
export type Summary = {
  seatsSold: number
  moneyHeld: Money | null
  refundsOwed: number
  /** Events with Orders holding money that should be given back (requirements/008 criterion 10). */
  owing: Event[]
  /** Drafts that cannot be published because a tier has no price (requirements/003 criterion 3). */
  unpriced: Event[]
  /** On sale or lately closed, soonest first - the buyer's order, asked from the other side. */
  upcoming: Event[]
}

const UPCOMING = 5

export function summarise(events: Event[]): Summary {
  return {
    seatsSold: events.reduce((sum, event) => sum + (event.soldCount ?? 0), 0),
    moneyHeld: totalHeld(events),
    refundsOwed: events.reduce((sum, event) => sum + (event.refundRequiredCount ?? 0), 0),
    owing: events.filter((event) => (event.refundRequiredCount ?? 0) > 0),
    unpriced: events.filter(
      (event) =>
        event.status === 'DRAFT' && (event.pricingTiers ?? []).some((tier) => !tier.price),
    ),
    upcoming: events
      .filter((event) => event.status === 'PUBLISHED' || event.status === 'SALES_CLOSED')
      // Safe to sort: `filter` above has already produced a new array, so this never touches
      // the one the query cache holds. Sorting `events` directly would.
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .slice(0, UPCOMING),
  }
}

/**
 * The organization's money, summed from figures the server worked out per Event.
 *
 * Summing across events is arithmetic a client may do; deriving one event's total from prices
 * and counts is not, and is why `salesTotal` exists (requirements/003 criterion 23).
 *
 * Null rather than zero when there is nothing to add, so the screen can say "—" instead of
 * printing a confident 0 ₫ for an organization that has never sold anything - those read
 * differently to somebody checking whether their money arrived.
 *
 * The currency comes from the events rather than from a constant. v1 closes the enum at VND,
 * and an organization whose events somehow disagreed would be a fact worth not hiding behind
 * a sum, so the first one wins and the rest are added to it.
 */
function totalHeld(events: Event[]): Money | null {
  return events.reduce<Money | null>((total, event) => {
    const held = event.salesTotal
    if (!held) {
      return total
    }
    return total ? { amount: total.amount + held.amount, currency: total.currency } : { ...held }
  }, null)
}
