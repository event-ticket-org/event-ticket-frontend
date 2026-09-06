import { useState } from 'react'
import { Link, useParams } from 'react-router'
import type { PublicEvent, Ticket } from '~/api/types'
import { usePublicEvent } from '~/features/discovery/public-hooks'
import { useOrder, useOrderTickets, useResendOrderEmail } from '~/features/checkout/order-hooks'
import { qrPngDataUrl, useQrSvg } from '~/shared/qr'
import { Button, Card, Problem, StatusChip, TimeWithZone, cx } from '~/shared/ui'

/**
 * The tickets themselves.
 *
 * requirements/006 criterion 2: behind the buyer's login, listing every Ticket in the Order
 * with its seat, tier, event, venue and start time in the Venue's timezone. The event comes
 * from the public endpoint because that is where the venue and its zone live - a Ticket knows
 * its seat and nothing about the room.
 */
export function TicketsPage() {
  const { orderId = '' } = useParams()
  const order = useOrder(orderId)
  const paid = order.data?.status === 'PAID'
  const tickets = useOrderTickets(orderId, paid)
  const event = usePublicEvent(order.data?.eventId ?? '')
  const resend = useResendOrderEmail(orderId)

  if (order.isLoading) {
    return <p className="text-body text-ink-soft">Loading…</p>
  }
  if (order.error || !order.data) {
    return <Problem error={order.error ?? new Error('That order is not here.')} />
  }
  if (!paid) {
    return (
      <Card>
        <p className="text-body">
          This order has no tickets yet — it is {order.data.status.toLowerCase().replace(/_/g, ' ')}.
        </p>
        <Link
          to={`/orders/${orderId}`}
          className="mt-4 inline-flex min-h-11 items-center justify-center border-2 border-ink bg-ink px-6 py-3 text-body-strong text-chalk shadow-raised-ghost"
        >
          Back to the order
        </Link>
      </Card>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <Link to="/orders" className="text-label uppercase underline underline-offset-4 print:hidden">
          My tickets
        </Link>
        <h1 className="mt-2 text-title">{order.data.eventTitle}</h1>
        {event.data && <EventLine event={event.data} />}
      </div>

      <Problem error={tickets.error ?? resend.error} />

      {/* Advice for somebody at a screen. On paper the ticket is the whole message. */}
      <p className="max-w-[68ch] text-body text-ink-soft print:hidden">
        Show a code at the door. Each seat has its own — send one on to whoever is using it.
      </p>

      {tickets.isLoading ? (
        <p className="text-body text-ink-soft">Loading…</p>
      ) : (
        <ul className="grid gap-6 sm:grid-cols-2">
          {(tickets.data ?? []).map((ticket) => (
            <li key={ticket.id}>
              <TicketCard ticket={ticket} event={event.data} />
            </li>
          ))}
        </ul>
      )}

      <Card className="print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-[68ch] text-body">
            {/* Criterion 8. Worth having because the first email is the one that goes to spam. */}
            {resend.isSuccess
              ? 'Sent. Check your inbox.'
              : 'We emailed these to you when the order was paid.'}
          </p>
          <Button
            variant="secondary"
            className="w-auto"
            pending={resend.isPending}
            onClick={() => resend.mutate()}
          >
            Email them again
          </Button>
        </div>
      </Card>
    </div>
  )
}

function EventLine({ event }: { event: PublicEvent }) {
  return (
    <div className="mt-2 space-y-1">
      <p className="text-body text-ink-soft">
        {event.venueName}, {event.city}
      </p>
      {/* Always the venue's clock. A buyer reading their own would arrive on the wrong hour. */}
      <TimeWithZone iso={event.startsAt} timeZone={event.timezone} />
      {event.doorsOpenAt && (
        <p className="text-body text-ink-soft">
          Doors open <TimeWithZone iso={event.doorsOpenAt} timeZone={event.timezone} />
        </p>
      )}
    </div>
  )
}

function TicketCard({ ticket, event }: { ticket: Ticket; event?: PublicEvent }) {
  const code = ticket.ticketCode ?? ''
  const svg = useQrSvg(code)
  const [saving, setSaving] = useState(false)

  const download = async () => {
    setSaving(true)
    try {
      const png = await qrPngDataUrl(code)
      const link = document.createElement('a')
      link.href = png
      // Named for the seat, never the code. A filename lands in a downloads list, a chat
      // thread and a screenshot; the code belongs in the image and nowhere else (nfr.md).
      link.download = `ticket-${ticket.seatLabel ?? ticket.id.slice(0, 8)}.png`
      link.click()
    } finally {
      setSaving(false)
    }
  }

  const spent = ticket.status !== 'VALID'

  return (
    // Never split across two sheets: half a ticket is a QR nobody can scan.
    <Card className="h-full break-inside-avoid">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-numeric text-numeric-lg">{ticket.seatLabel ?? 'General admission'}</p>
          {ticket.tierName && <p className="text-body text-ink-soft">{ticket.tierName}</p>}
        </div>
        <StatusChip status={ticket.status} />
      </div>

      {/*
        264px around 12px of quiet zone is a 240px code, which is the minimum DESIGN.md sets
        and which this was under - a scanner that will not focus is the failure this size
        exists to prevent, and it is the failure nobody notices until a door.
      */}
      <div className="mt-4 flex justify-center">
        <div
          className={cx('size-[264px] border-2 border-ink bg-paper p-3', spent && 'opacity-40')}
          dangerouslySetInnerHTML={{ __html: svg }}
          role="img"
          aria-label={`Ticket QR code for seat ${ticket.seatLabel ?? ''}`}
        />
      </div>

      {/*
        The code in words, which DESIGN.md has always asked for and this card did not have.
        It is the fallback for a scanner that will not focus - and on paper it is the whole
        difference between a smudged print and a person standing at a gate with nothing, since
        the scanner takes a typed code for exactly this reason.

        Not a URL and not logged (nfr.md); printed and shown is what a ticket is for.
      */}
      {!spent && (
        <p className="mt-3 select-all break-all border-2 border-ink bg-paper-sunk px-3 py-2 text-center font-numeric text-code text-ink">
          {code}
        </p>
      )}

      {ticket.status === 'REDEEMED' && ticket.redeemedAt && event && (
        <p className="mt-3 text-body text-ink-soft">
          Used at <TimeWithZone iso={ticket.redeemedAt} timeZone={event.timezone} />
        </p>
      )}
      {ticket.status === 'VOID' && (
        <p className="mt-3 text-body text-ink-soft">
          This ticket has been cancelled and will not admit anybody.
        </p>
      )}

      <Button
        variant="secondary"
        className="mt-4 w-full print:hidden"
        pending={saving}
        disabled={spent}
        onClick={() => void download()}
      >
        Save the image
      </Button>
    </Card>
  )
}
