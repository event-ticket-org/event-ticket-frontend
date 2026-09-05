import { useState } from 'react'
import { Link } from 'react-router'
import { Button, Card, EmptyState, Field, Problem, cx, inputClass } from '~/shared/ui'
import { useCreateVenue, useVenues } from './venue-hooks'

/** Vietnam is a single zone, so this is the default and the field still exists for the rest. */
const DEFAULT_TIMEZONE = 'Asia/Ho_Chi_Minh'

export function VenuesPage() {
  const venues = useVenues()
  const [creating, setCreating] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-title">Venues</h1>
        {/* The empty state carries its own action, and two identical buttons on one screen
            is a choice the reader has to make for no reason. */}
        {!creating && venues.data && venues.data.length > 0 && (
          <Button className="w-auto" onClick={() => setCreating(true)}>
            New venue
          </Button>
        )}
      </div>

      <Problem error={venues.error} />

      {creating && <CreateVenue onDone={() => setCreating(false)} />}

      {venues.isLoading ? (
        <p className="text-body text-ink-soft">Loading…</p>
      ) : venues.data?.length === 0 && !creating ? (
        <EmptyState
          headline="No venues yet"
          action={
            <Button className="w-auto" onClick={() => setCreating(true)}>
              New venue
            </Button>
          }
        >
          A venue holds the seat map your events sell from. Draw it once and every event at
          that venue starts from the same room.
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {venues.data?.map((venue) => (
            <li key={venue.id}>
              <Link
                to={`/manage/venues/${venue.id}`}
                className={cx(
                  'block border-2 border-ink bg-paper p-6 shadow-raised',
                  'transition-[transform,box-shadow] duration-[60ms] ease-linear',
                  'hover:shadow-hover active:translate-x-1 active:translate-y-1 active:shadow-none',
                  'motion-reduce:transition-none',
                )}
              >
                <h2 className="text-heading">{venue.name}</h2>
                <p className="mt-1 text-body text-ink-soft">{venue.city}</p>
                <p className="mt-4 font-numeric text-numeric">
                  {venue.seatCount ?? 0} seats
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function CreateVenue({ onDone }: { onDone: () => void }) {
  const create = useCreateVenue()
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE)

  return (
    <Card>
      <form
        className="space-y-6"
        onSubmit={(submit) => {
          submit.preventDefault()
          create.mutate(
            { name, city, address: address || undefined, timezone },
            { onSuccess: onDone },
          )
        }}
      >
        <h2 className="text-heading">New venue</h2>
        <Problem error={create.error} />
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Name">
            <input className={inputClass} value={name} maxLength={200} required autoFocus
              onChange={(change) => setName(change.target.value)} />
          </Field>
          <Field label="City" hint="A field of its own, because the public listing filters on it.">
            <input className={inputClass} value={city} maxLength={100} required
              onChange={(change) => setCity(change.target.value)} />
          </Field>
          <Field label="Address">
            <input className={inputClass} value={address} maxLength={500}
              onChange={(change) => setAddress(change.target.value)} />
          </Field>
          <Field
            label="Timezone"
            hint="Every time this venue's events show is rendered in this zone, never the reader's."
          >
            <input className={inputClass} value={timezone} required
              onChange={(change) => setTimezone(change.target.value)} />
          </Field>
        </div>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" className="w-auto" onClick={onDone} type="button">
            Cancel
          </Button>
          <Button className="w-auto" pending={create.isPending}>
            Create venue
          </Button>
        </div>
      </form>
    </Card>
  )
}
