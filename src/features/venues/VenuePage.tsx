import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button, Card, Field, Problem, inputClass } from '~/shared/ui'
import { SeatMapEditor } from './seat-map/SeatMapEditor'
import {
  useDeleteVenue,
  useReplaceSeatMap,
  useSeatMap,
  useUpdateVenue,
  useVenue,
} from './venue-hooks'

export function VenuePage() {
  const { venueId = '' } = useParams()
  const venue = useVenue(venueId)
  const seatMap = useSeatMap(venueId)
  const replaceSeatMap = useReplaceSeatMap(venueId)

  if (venue.isLoading || seatMap.isLoading) {
    return <p className="text-body text-ink-soft">Loading…</p>
  }
  if (venue.error || !venue.data) {
    return <Problem error={venue.error ?? new Error('That venue is not here.')} />
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <Link to="/manage/venues" className="text-label uppercase underline underline-offset-4">
            Venues
          </Link>
          <h1 className="mt-2 text-title">{venue.data.name}</h1>
        </div>
        <DeleteVenue venueId={venueId} name={venue.data.name} />
      </div>

      <VenueDetails venueId={venueId} venue={venue.data} />

      <section className="space-y-4">
        <h2 className="text-heading">Seat map</h2>
        <SeatMapEditor
          saved={seatMap.data}
          saving={replaceSeatMap.isPending}
          saveError={replaceSeatMap.error}
          onSave={(map) => replaceSeatMap.mutateAsync(map)}
          frozenNote={<PublishedEventsNote />}
        />
      </section>
    </div>
  )
}

/**
 * The thing organizers get wrong, and the opposite of what a lock would say.
 *
 * Publishing *copies* this map into the Event, and it is that copy which is frozen. So this
 * map stays editable forever, and the risk is not that somebody is blocked - it is that they
 * assume a change here reaches an event already on sale. It does not.
 *
 * Neutral rather than amber, and permanent rather than conditional. This is how the system
 * works, not something needing attention, and a warning colour that is always on is a
 * warning colour nobody reads by the third venue.
 */
function PublishedEventsNote() {
  return (
    <p className="border-2 border-ink bg-paper-sunk px-4 py-3 text-body text-ink">
      Changes here never reach an event that is already published. Publishing takes its own
      copy of this map, and that copy is fixed for the life of the event.
    </p>
  )
}

function VenueDetails({
  venueId,
  venue,
}: {
  venueId: string
  venue: { name: string; city: string; address?: string; timezone: string }
}) {
  const update = useUpdateVenue(venueId)
  const [form, setForm] = useState({
    name: venue.name,
    city: venue.city,
    address: venue.address ?? '',
    timezone: venue.timezone,
  })
  const changed =
    form.name !== venue.name ||
    form.city !== venue.city ||
    form.address !== (venue.address ?? '') ||
    form.timezone !== venue.timezone

  return (
    <Card>
      <form
        className="space-y-6"
        onSubmit={(submit) => {
          submit.preventDefault()
          update.mutate({ ...form, address: form.address || undefined })
        }}
      >
        <Problem error={update.error} />
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Name">
            <input className={inputClass} value={form.name} maxLength={200} required
              onChange={(change) => setForm({ ...form, name: change.target.value })} />
          </Field>
          <Field label="City">
            <input className={inputClass} value={form.city} maxLength={100} required
              onChange={(change) => setForm({ ...form, city: change.target.value })} />
          </Field>
          <Field label="Address">
            <input className={inputClass} value={form.address} maxLength={500}
              onChange={(change) => setForm({ ...form, address: change.target.value })} />
          </Field>
          <Field label="Timezone">
            <input className={inputClass} value={form.timezone} required
              onChange={(change) => setForm({ ...form, timezone: change.target.value })} />
          </Field>
        </div>
        <div className="flex justify-end">
          <Button className="w-auto" disabled={!changed} pending={update.isPending}>
            Save details
          </Button>
        </div>
      </form>
    </Card>
  )
}

function DeleteVenue({ venueId, name }: { venueId: string; name: string }) {
  const navigate = useNavigate()
  const remove = useDeleteVenue()
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <div className="max-w-96 text-right">
        <Button variant="ghost" className="w-auto px-0" onClick={() => setConfirming(true)}>
          Delete venue
        </Button>
        {/* VENUE_IN_USE is the server refusing to delete a venue a published Event depends
            on. Knowing in advance would need a contract change or a scan of every Event, and
            the refusal loses nothing and arrives with a message worth reading. */}
        <div className="mt-2 text-left">
          <Problem error={remove.error} />
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-96 border-2 border-ink bg-paper p-4 shadow-raised">
      <p className="text-body">
        Delete <strong className="text-body-strong">{name}</strong>? Its seat map goes with it,
        along with any event still in draft here.
      </p>
      <div className="mt-4 flex justify-end gap-3">
        <Button variant="ghost" className="w-auto" onClick={() => setConfirming(false)}>
          Keep it
        </Button>
        <Button
          variant="destructive"
          className="w-auto"
          pending={remove.isPending}
          onClick={() =>
            remove.mutate(venueId, {
              onSuccess: () => void navigate('/manage/venues'),
              onError: () => setConfirming(false),
            })
          }
        >
          Delete
        </Button>
      </div>
    </div>
  )
}
