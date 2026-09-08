import { Link } from 'react-router'
import type { Event, Membership, Venue } from '~/api/types'
import { summarise, type Summary } from './dashboard'
import { useActiveMembership } from '~/features/auth/session-hooks'
import { useEvents } from '~/features/events/event-hooks'
import { useVenues } from '~/features/venues/venue-hooks'
import { Card, EmptyState, MoneyTotal, Problem, StatusChip, cx } from '~/shared/ui'
import { formatInZone, formatMoney } from '~/shared/format'

/**
 * What an organizer sees when they arrive.
 *
 * This route rendered a dashed box reading "The organization dashboard — arrives in slice 2"
 * for the whole life of the deployment, which is how it was found: somebody clicked Manage on
 * a live site and got a development note. A landing page that says nothing is worse than no
 * landing page, because it also says the product is unfinished.
 *
 * Ordered by what would ruin somebody's day, not by what is easiest to compute. An
 * Organization that cannot sell comes first, then money owed back to buyers, then events that
 * cannot go on sale, then how the sale is going. Anything with nothing to say renders nothing
 * at all - a dashboard of empty panels is the thing this replaces.
 */
export function DashboardPage() {
  const { membership, isLoading: loadingMembership, canManageEvents } = useActiveMembership()

  // Gate Staff are refused `/events` outright (requirements/007 criterion 13), so the question
  // is not what to hide from them - it is not to ask. A page that fires a request it knows
  // will 403 spends a round trip to draw an error nobody needed.
  if (!canManageEvents) {
    return <GateStaffHome membership={membership} />
  }
  return (
    <ManagerHome membership={membership} loadingMembership={loadingMembership} />
  )
}

function ManagerHome({
  membership,
  loadingMembership,
}: {
  membership: Membership | undefined
  loadingMembership: boolean
}) {
  const events = useEvents('ALL')
  const venues = useVenues()

  const all = events.data?.pages.flatMap((page) => page.items ?? []) ?? []
  const summary = summarise(all)
  const loading = loadingMembership || events.isLoading || venues.isLoading

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-title">{membership?.organizationName ?? 'Your organization'}</h1>
        {membership && <StatusChip status={membership.organizationStatus ?? 'APPROVED'} />}
      </div>

      <Problem error={events.error ?? venues.error} />

      {loading ? (
        <p className="text-body text-ink-soft">Loading…</p>
      ) : (
        <>
          <Standing membership={membership} />
          <NeedsAttention summary={summary} />
          {all.length > 0 && <Totals summary={summary} />}
          <NextUp summary={summary} venues={venues.data ?? []} />
          <GettingStarted venues={venues.data ?? []} events={all} />
        </>
      )}
    </div>
  )
}

/**
 * requirements/001 criterion 16. Approved says nothing, because approved is the ordinary state
 * and a banner on every visit is a banner nobody reads.
 *
 * The two that speak are the two that change what this person can do today.
 */
function Standing({ membership }: { membership: Membership | undefined }) {
  const status = membership?.organizationStatus
  if (!status || status === 'APPROVED') {
    return null
  }

  if (status === 'REJECTED') {
    return (
      <Card className="border-stop">
        <h2 className="text-heading">This organization was not approved</h2>
        {/* The administrator's own words. Shown here as well as emailed, because the email is
            the copy that gets lost - and a rejection nobody can re-read is one nobody can
            act on. */}
        {membership?.decisionReason && (
          <p className="mt-2 text-body">“{membership.decisionReason}”</p>
        )}
        <p className="mt-2 text-body text-ink-soft">
          You can still build venues and events, but nothing can go on sale. Put right what the
          message asks for and ask the platform to look again.
        </p>
      </Card>
    )
  }

  return (
    <Card>
      <h2 className="text-heading">Waiting for approval</h2>
      <p className="mt-2 text-body text-ink-soft">
        {/* The whole point of criterion 16: waiting can last days, and somebody who cannot see
            they are in it reads it as the product being broken. Saying what still works
            matters as much as saying what does not. */}
        A platform administrator has to approve this organization before its events can go on
        sale. Building venues, seat maps and events works meanwhile — publishing is the only
        thing that waits.
      </p>
    </Card>
  )
}

/**
 * The things somebody has to do something about. Nothing to say means nothing rendered: a
 * standing "all clear" panel trains people to skip the place where the alarms appear.
 */
function NeedsAttention({ summary }: { summary: Summary }) {
  const { owing: owedRefunds, refundsOwed: owedCount, unpriced } = summary

  if (owedCount === 0 && unpriced.length === 0) {
    return null
  }

  return (
    <section className="space-y-3">
      <h2 className="text-label uppercase text-ink-soft">Needs you</h2>

      {/* requirements/008 criterion 10. It sits on the Event because that is where an organizer
          looks - and until this page existed, an organizer had to open each event to find it. */}
      {owedCount > 0 && (
        <Card className="border-stop">
          <h3 className="text-heading">
            {owedCount} {owedCount === 1 ? 'order is' : 'orders are'} holding money that should
            be given back
          </h3>
          <ul className="mt-2 space-y-1">
            {owedRefunds.map((event) => (
              <li key={event.id} className="text-body">
                <Link className="underline underline-offset-4" to={`/manage/events/${event.id}/orders`}>
                  {event.title}
                </Link>{' '}
                <span className="text-ink-soft">
                  — {event.refundRequiredCount}{' '}
                  {event.refundRequiredCount === 1 ? 'order' : 'orders'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* requirements/003 criterion 3: publishing is refused while any tier is unpriced. Better
          said here than discovered by pressing Publish. */}
      {unpriced.length > 0 && (
        <Card>
          <h3 className="text-heading">
            {unpriced.length === 1 ? 'A draft has' : `${unpriced.length} drafts have`} a tier
            with no price
          </h3>
          <p className="mt-2 text-body text-ink-soft">
            An event cannot be published until every tier on its seat map has a price.
          </p>
          <ul className="mt-2 space-y-1">
            {unpriced.map((event) => (
              <li key={event.id} className="text-body">
                <Link className="underline underline-offset-4" to={`/manage/events/${event.id}`}>
                  {event.title}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </section>
  )
}

/**
 * requirements/003 criterion 23. Money *held*, which is what `salesTotal` reports: a refunded
 * Order has given the money back, so it is not counted here either.
 *
 * Summed across events in the client because each Event already carries its own figure — the
 * thing a client cannot do is compute one event's total from prices and counts, and it is not
 * being asked to.
 */
function Totals({ summary }: { summary: Summary }) {
  const { seatsSold: sold, moneyHeld: held, refundsOwed: owed } = summary

  return (
    <section className="grid gap-4 sm:grid-cols-3">
      <Figure label="Seats sold">
        <span className="font-numeric text-numeric text-ink">{sold}</span>
      </Figure>
      <Figure label="Money held">
        {held ? <MoneyTotal money={held} /> : <span className="text-body text-ink-soft">—</span>}
      </Figure>
      <Figure label="Refunds owed">
        <span className={cx('font-numeric text-numeric', owed > 0 ? 'text-stop' : 'text-ink')}>
          {owed}
        </span>
      </Figure>
    </section>
  )
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-2 border-ink bg-paper p-4">
      <p className="text-label uppercase text-ink-soft">{label}</p>
      <p className="mt-1">{children}</p>
    </div>
  )
}

/**
 * The next few events, soonest first — the same order the public listing uses, because an
 * organizer's question is the buyer's question asked from the other side.
 *
 * Only what is on sale or about to be. A draft for next year is not what somebody opens this
 * page to check, and it is one click away under Events.
 */
function NextUp({ summary, venues }: { summary: Summary; venues: Venue[] }) {
  const { upcoming } = summary

  if (upcoming.length === 0) {
    return null
  }

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-label uppercase text-ink-soft">Next up</h2>
        <Link className="text-label uppercase underline underline-offset-4" to="/manage/events">
          All events
        </Link>
      </div>
      <ul className="border-2 border-ink bg-paper">
        {upcoming.map((event, index) => {
          const venue = venues.find((candidate) => candidate.id === event.venueId)
          return (
            <li key={event.id} className={cx(index > 0 && 'border-t-2 border-ink')}>
              <Link
                to={`/manage/events/${event.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 hover:bg-paper-sunk"
              >
                <span className="min-w-0">
                  <span className="block text-heading">{event.title}</span>
                  {/* Never the browser's zone. A time is the Venue's wall clock or it is a
                      lie somebody drives to. */}
                  <span className="block text-body text-ink-soft">
                    {venue
                      ? `${venue.name} · ${formatInZone(event.startsAt, venue.timezone)}`
                      : venue}
                  </span>
                </span>
                <span className="flex items-center gap-4">
                  {/*
                    A column value, not a total, so not `MoneyTotal` - that component is
                    deliberately the largest object on a screen where money moves, which is
                    right for a checkout and wrong five times over in a list. Used here it
                    drew a row of display-sized zeros that shouted over every event title.

                    And nothing at all when nothing has sold: "0 sold" already says it, and a
                    zero beside it is the same fact twice in a heavier typeface.
                  */}
                  <span className="font-numeric text-numeric">{event.soldCount ?? 0} sold</span>
                  {event.salesTotal && event.salesTotal.amount > 0 && (
                    <span className="font-numeric text-numeric">
                      {formatMoney(event.salesTotal)}
                    </span>
                  )}
                  <StatusChip status={event.status} />
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * The first run. An approved Organization with no Venue cannot have an Event, so the order of
 * these is the order the product forces — and saying so beats a screen of empty tables that
 * leaves somebody guessing which button starts.
 */
function GettingStarted({ venues, events }: { venues: Venue[]; events: Event[] }) {
  if (venues.length > 0 && events.length > 0) {
    return null
  }

  return (
    <Card>
      <h2 className="text-heading">{venues.length === 0 ? 'Start with a venue' : 'Now add an event'}</h2>
      <p className="mt-2 text-body text-ink-soft">
        {venues.length === 0
          ? 'An event happens somewhere, so the room comes first: a venue and the seat map people will pick from.'
          : 'You have a venue. An event is a date in it, with a price for each tier on its seat map.'}
      </p>
      <div className="mt-4">
        {/* A link, styled as the primary action, because it navigates - the same shape the
            no-organization state next door already uses. `Button` is for things that submit. */}
        <Link
          to={venues.length === 0 ? '/manage/venues' : '/manage/events'}
          className="inline-flex min-h-11 items-center border-2 border-ink bg-ink px-6 py-3 text-body-strong text-chalk shadow-raised-ghost"
        >
          {venues.length === 0 ? 'Venues' : 'Events'}
        </Link>
      </div>
    </Card>
  )
}

/**
 * requirements/007 criterion 13: Gate Staff see no sales figures, no revenue, no buyer details.
 * So this is not the manager's page with the numbers removed — it is the only screen they have
 * a use for, which is the door.
 */
function GateStaffHome({ membership }: { membership: Membership | undefined }) {
  return (
    <EmptyState headline="You work the door">
      You are gate staff for {membership?.organizationName ?? 'this organization'}. Venues,
      events and takings belong to its owners and managers. Your part is the scanner — the link
      to it comes from whoever asked you to work the gate.
    </EmptyState>
  )
}
