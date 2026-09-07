import { Link, useLocation, useParams } from 'react-router'
import type { EventSeat, Money, PricingTier } from '~/api/types'
import { useMe, useSessionState } from '~/features/auth/session-hooks'
import { formatMoney, timeUntil } from '~/shared/format'
import { Card, CoverImage, MoneyTotal, Problem, StatusChip, TimeWithZone } from '~/shared/ui'
import { SeatPicker } from './SeatPicker'
import { usePublicEvent, useEventSeatMap } from './public-hooks'
import { useSeatSelection } from './seat-selection'

export function PublicEventPage() {
  const { eventId = '' } = useParams()
  const event = usePublicEvent(eventId)
  const seatMap = useEventSeatMap(eventId)
  const selection = useSeatSelection(eventId)

  if (event.isLoading) {
    return <p className="text-body text-ink-soft">Loading…</p>
  }
  if (event.error || !event.data) {
    return <Problem error={event.error ?? new Error('That event is not here.')} />
  }

  const details = event.data
  const seats = seatMap.data?.seats ?? []
  const chosen = seats.filter((seat) => selection.selected.includes(seat.id))
  const onSale = details.status === 'PUBLISHED'
  // How many seats are left comes from the contract now rather than from counting the map,
  // so the answer is here before the map has loaded - and it is the same number the listing
  // showed, from the same query, so the two pages cannot disagree.
  const soldOut = details.seatsAvailable === 0
  const until = timeUntil(details.startsAt)

  return (
    <div className="space-y-8">
      <div>
        {/*
          Back to the listing, and first, because arriving here from a shared link is the
          common case and there is otherwise nothing on the page that says this product has
          more than one event in it.
        */}
        <Link to="/" className="text-body underline underline-offset-4">
          ← All events
        </Link>

        {/*
          The title leads and the picture follows it.
          
          It used to be the other way round, which put a 360px image between the header and
          the name of the thing somebody had just tapped - on a phone the title was below the
          fold, so the first screen of an event page showed a picture and no answer to "what
          is this". The cover is still the hero shape here, unlike on a listing card: this is
          the one page where the picture is the subject rather than one line of evidence.
        */}
        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-title">{details.title}</h1>
          {!onSale && <StatusChip status={details.status ?? 'DRAFT'} />}
          {onSale && soldOut && (
            <span className="border-2 border-ink bg-paper-sunk px-2 py-0.5 text-label uppercase">
              Sold out
            </span>
          )}
        </div>
        <p className="mt-2 text-body text-ink-soft">
          {details.venueName}, {details.city} · {details.organizationName}
        </p>

        {/* Eager rather than lazy - it is in the first screen, so deferring it only
            guarantees it arrives late. */}
        <CoverImage
          src={details.coverImageUrl}
          alt={details.coverImageAlt}
          sizes={details.coverImageSizes}
          className="mt-6"
          eager
        />

        <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div className="space-y-1">
            <p>
              <TimeWithZone iso={details.startsAt} timeZone={details.timezone} />
              {until && <span className="ml-2 text-body text-ink-soft">{until}</span>}
            </p>
            {details.doorsOpenAt && (
              <p className="text-body text-ink-soft">
                Doors open{' '}
                <TimeWithZone iso={details.doorsOpenAt} timeZone={details.timezone} />
              </p>
            )}
          </div>
          {/* What it costs, before the seat map rather than only inside its legend: a buyer
              deciding whether to read on is asking the price, and a legend is a key to a
              picture they have not looked at yet.

              Not when it is sold out, for the same reason the listing card drops it there:
              DESIGN.md says a seat you cannot buy has no price band worth reading, and a
              price is an invitation to an action that is no longer available. */}
          {details.priceFrom && !soldOut && (
            <p className="text-body">
              from{' '}
              <span className="font-numeric text-numeric-lg">
                {formatMoney(details.priceFrom)}
              </span>
            </p>
          )}
        </div>

        {details.description && (
          <p className="mt-4 max-w-[68ch] whitespace-pre-line text-body">{details.description}</p>
        )}
      </div>

      <Problem error={seatMap.error} />

      {!onSale ? (
        <Card>
          <p className="text-body">
            This event is not on sale.{' '}
            {details.status === 'SALES_CLOSED'
              ? 'Sales have closed — tickets already bought are still valid.'
              : 'Check back closer to the date.'}
          </p>
        </Card>
      ) : seatMap.isLoading ? (
        <p className="text-body text-ink-soft">Loading the seat map…</p>
      ) : (
        <>
          <SeatPicker
            map={seatMap.data ?? { seats: [], elements: [] }}
            tiers={details.pricingTiers ?? []}
            selected={selection.selected}
            onToggle={selection.toggle}
            onClear={selection.clear}
          />
          <Chosen
            seats={chosen}
            tiers={details.pricingTiers ?? []}
            eventId={eventId}
            soldOut={soldOut}
            onToggle={selection.toggle}
          />
        </>
      )}
    </div>
  )
}

/**
 * What is selected, what it costs, and the way onward.
 *
 * Sticky at the bottom because DESIGN.md puts the buyer's primary action in the thumb zone,
 * and because the seat map is tall enough that a total at the foot of the page would be off
 * screen exactly when somebody is deciding whether to buy.
 */
function Chosen({
  seats,
  tiers,
  eventId,
  soldOut,
  onToggle,
}: {
  seats: EventSeat[]
  tiers: PricingTier[]
  eventId: string
  soldOut: boolean
  onToggle: (seatId: string) => void
}) {
  const { signedIn } = useSessionState()
  const { data: me } = useMe()
  const location = useLocation()

  if (seats.length === 0) {
    return (
      <Card>
        <p className="text-body text-ink-soft">
          {soldOut
            ? // Found by looking at a sold-out event: the map showed every seat taken and
              // this still said "pick a seat to get started", which is an instruction nobody
              // can follow. Saying what happened is more use than repeating the happy path.
              'Every seat has been sold. Tickets are sometimes released again if an order is refunded.'
            : 'Pick a seat on the map to get started. Nothing is held until you go to checkout.'}
        </p>
      </Card>
    )
  }

  return (
    <div className="sticky bottom-0 -mx-4 border-t-2 border-ink bg-paper px-4 py-4 sm:mx-0 sm:border-2 sm:px-6">
      <ul className="flex flex-wrap gap-2">
        {seats.map((seat) => (
          <li key={seat.id}>
            <button
              onClick={() => onToggle(seat.id)}
              aria-label={`Remove seat ${seat.label}`}
              className="inline-flex min-h-11 items-center gap-2 border-2 border-ink bg-info px-3 text-label uppercase text-ink"
            >
              {seat.label}
              <span aria-hidden>×</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-label uppercase text-ink-soft">
            {seats.length} {seats.length === 1 ? 'seat' : 'seats'}
          </p>
          {/* The largest object on a screen where money moves (DESIGN.md). */}
          <MoneyTotal money={totalOf(seats, tiers)} />
        </div>

        {signedIn && me?.emailVerified ? (
          <Link
            to={`/events/${eventId}/checkout`}
            className="inline-flex min-h-11 w-full items-center justify-center border-2 border-ink bg-ink px-6 py-3 text-body-strong text-chalk shadow-raised-ghost sm:w-auto"
          >
            Go to checkout
          </Link>
        ) : signedIn ? (
          // requirements/004 criterion 4: a verified address, and verification never happens
          // inside a checkout because the hold's clock would race the email round trip.
          <p className="max-w-96 text-body">
            Confirm your email address before checking out — we sent a link to{' '}
            <strong className="text-body-strong">{me?.email}</strong>.
          </p>
        ) : (
          <Link
            to="/sign-in"
            state={{ from: location.pathname }}
            className="inline-flex min-h-11 w-full items-center justify-center border-2 border-ink bg-ink px-6 py-3 text-body-strong text-chalk shadow-raised-ghost sm:w-auto"
          >
            Sign in to continue
          </Link>
        )}
      </div>

      <p className="mt-3 text-body text-ink-soft">
        {/* Criterion 5: the clock starts at checkout, not at selection. Saying so is what
            stops somebody feeling rushed while they are still choosing. */}
        Seats are held for ten minutes once you go to checkout. Choosing takes as long as you
        like.
      </p>
    </div>
  )
}

/**
 * What the selection costs, added up here.
 *
 * A seat carries its tier, not its price, so this joins the two. It is the client's own
 * arithmetic and is not what anybody is charged - the Order the server creates at checkout
 * carries the total that counts, priced from the same tiers a moment later. Showing a
 * running total before then is worth the small duplication; making somebody start a
 * ten-minute clock to find out what their seats cost is not.
 */
function totalOf(seats: EventSeat[], tiers: PricingTier[]): Money {
  const priceOf = (tierName: string) =>
    tiers.find((tier) => tier.name === tierName)?.price ?? null

  const currency = tiers.find((tier) => tier.price)?.price?.currency ?? 'VND'
  const amount = seats.reduce((running, seat) => running + (priceOf(seat.tierName)?.amount ?? 0), 0)

  return { amount, currency }
}
