import { describe, expect, it } from 'vitest'
import type { Event } from '~/api/types'
import { summarise } from './dashboard'

/** Only the fields this screen reads. A full Event here would hide which ones those are. */
function event(over: Partial<Event> & Pick<Event, 'id' | 'status' | 'startsAt'>): Event {
  return {
    title: 'An event',
    venueId: 'venue',
    organizationId: 'org',
    listed: true,
    ...over,
  } as Event
}

const vnd = (amount: number) => ({ amount, currency: 'VND' as const })

describe('what the organizer dashboard says', () => {
  it('sums the money each event reports, rather than deriving any of it', () => {
    const summary = summarise([
      event({ id: '1', status: 'PUBLISHED', startsAt: '2027-01-01T12:00:00Z',
              soldCount: 5, salesTotal: vnd(1_250_000) }),
      event({ id: '2', status: 'PUBLISHED', startsAt: '2027-02-01T12:00:00Z',
              soldCount: 3, salesTotal: vnd(750_000) }),
    ])

    expect(summary.seatsSold).toBe(8)
    expect(summary.moneyHeld).toEqual(vnd(2_000_000))
  })

  /**
   * An organization that has never sold anything and one whose sales were all refunded read
   * differently to somebody checking whether their money arrived, and a confident `0 ₫` says
   * the second thing about the first.
   */
  it('has no total at all rather than a zero, when nothing reports one', () => {
    const summary = summarise([
      event({ id: '1', status: 'DRAFT', startsAt: '2027-01-01T12:00:00Z' }),
    ])

    expect(summary.moneyHeld).toBeNull()
    expect(summary.seatsSold).toBe(0)
  })

  it('still totals a real zero, which is a different fact', () => {
    const summary = summarise([
      event({ id: '1', status: 'PUBLISHED', startsAt: '2027-01-01T12:00:00Z',
              soldCount: 0, salesTotal: vnd(0) }),
    ])

    expect(summary.moneyHeld).toEqual(vnd(0))
  })

  it('collects the events holding money that should be given back', () => {
    const summary = summarise([
      event({ id: 'quiet', status: 'PUBLISHED', startsAt: '2027-01-01T12:00:00Z' }),
      event({ id: 'owing', status: 'PUBLISHED', startsAt: '2027-02-01T12:00:00Z',
              refundRequiredCount: 2 }),
      event({ id: 'also', status: 'SALES_CLOSED', startsAt: '2027-03-01T12:00:00Z',
              refundRequiredCount: 1 }),
    ])

    expect(summary.refundsOwed).toBe(3)
    expect(summary.owing.map((e) => e.id)).toEqual(['owing', 'also'])
  })

  /** requirements/003 criterion 3: publishing is refused while any tier is unpriced. */
  it('finds drafts that cannot be published, and only drafts', () => {
    const summary = summarise([
      event({ id: 'unpriced', status: 'DRAFT', startsAt: '2027-01-01T12:00:00Z',
              pricingTiers: [{ name: 'VIP', price: vnd(500_000) }, { name: 'Standard', price: null }] }),
      event({ id: 'priced', status: 'DRAFT', startsAt: '2027-01-01T12:00:00Z',
              pricingTiers: [{ name: 'Standard', price: vnd(250_000) }] }),
      // A published Event cannot have an unpriced tier in use, and if one somehow appears it
      // is not something an organizer can act on from this screen.
      event({ id: 'live', status: 'PUBLISHED', startsAt: '2027-01-01T12:00:00Z',
              pricingTiers: [{ name: 'Standard', price: null }] }),
    ])

    expect(summary.unpriced.map((e) => e.id)).toEqual(['unpriced'])
  })

  it('lists what is on sale soonest first, and not the drafts', () => {
    const summary = summarise([
      event({ id: 'later', status: 'PUBLISHED', startsAt: '2027-03-01T12:00:00Z' }),
      event({ id: 'draft', status: 'DRAFT', startsAt: '2027-01-01T12:00:00Z' }),
      event({ id: 'soon', status: 'PUBLISHED', startsAt: '2027-02-01T12:00:00Z' }),
      event({ id: 'closed', status: 'SALES_CLOSED', startsAt: '2027-02-15T12:00:00Z' }),
    ])

    expect(summary.upcoming.map((e) => e.id)).toEqual(['soon', 'closed', 'later'])
  })

  it('shows five at most, because the rest are one click away', () => {
    const many = Array.from({ length: 9 }, (_, index) =>
      event({
        id: `e${index}`,
        status: 'PUBLISHED',
        startsAt: `2027-01-0${index + 1}T12:00:00Z`,
      }),
    )

    expect(summarise(many).upcoming).toHaveLength(5)
  })

})
