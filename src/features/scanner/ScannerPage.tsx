import { useCallback, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import type { Membership, PublicEvent, ScanResult } from '~/api/types'
import { useMe, useSessionState, useSwitchOrganization } from '~/features/auth/session-hooks'
import { usePublicEvent } from '~/features/discovery/public-hooks'
import { formatTimeInZone, zoneLabel } from '~/shared/format'
import { Problem } from '~/shared/ui'
import { CameraScanner } from './CameraScanner'
import { ScanFailure, ScanWorking } from './ScanFailure'
import { ScanVerdict } from './ScanVerdict'
import { useDeviceId } from './device-id'
import { useScan } from './scan-hooks'
import { ScannerButton, scannerInputClass, scannerTextInputClass } from './scanner-ui'

/**
 * The door.
 *
 * The Event's title and clock come from the **public** endpoint, deliberately. Gate Staff
 * cannot call `/events` at all - `requireCallerCanManageEvents` refuses them, which is the
 * right refusal, because that response carries sold counts and requirements/007 criterion 13
 * says no sales figures, revenue or buyer details go anywhere near a gate. The public view of
 * an Event is exactly what a person at a door needs and nothing else, and it stays reachable
 * whatever the Event's listed status.
 *
 * That does mean Gate Staff have no way to *discover* an event here. The scanner is opened for
 * one, from a link a manager shares - which is how a gate actually works.
 */
export function ScannerPage() {
  const { eventId = '' } = useParams()
  const event = usePublicEvent(eventId)
  const device = useDeviceId()
  const [renaming, setRenaming] = useState(false)

  if (event.isLoading) {
    return <Notice headline="Opening…" />
  }
  if (event.error || !event.data) {
    return (
      <Notice headline="No such event">
        Nothing published is at this address. Check the link the organizer sent you.
      </Notice>
    )
  }

  // Asked once per device and then never again. A `deviceId` nobody named is a UUID in a
  // redemption record, and criterion 5 - when and at which device a ticket was first used -
  // is only answerable by somebody who can point at the door it names.
  if (!device.named || renaming) {
    return (
      <NameDevice
        current={device.name}
        onNamed={(name) => {
          device.rename(name)
          setRenaming(false)
        }}
      />
    )
  }

  return (
    <OrganizationGate event={event.data}>
      <Scanning
        eventId={eventId}
        event={event.data}
        deviceId={device.deviceId}
        onRename={() => setRenaming(true)}
      />
    </OrganizationGate>
  )
}

function Scanning({
  eventId,
  event,
  deviceId,
  onRename,
}: {
  eventId: string
  event: PublicEvent
  deviceId: string
  onRename: () => void
}) {
  const scan = useScan(eventId)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [typed, setTyped] = useState('')
  const [typing, setTyping] = useState(false)

  // While a verdict is up, a request is in flight, or a failure is showing, the camera keeps
  // running and its frames are not decoded. Anything else would either queue up scans behind
  // a verdict nobody has read yet, or restart the camera between one person and the next.
  const settled = result !== null || scan.error !== null
  const busy = scan.isPending || settled

  const present = useCallback(
    (ticketCode: string) => {
      const code = ticketCode.trim()
      // The camera is already not decoding while any of this is true; the guard is for the
      // typed path and for the frame that was in flight when the last one landed.
      if (!code || scan.isPending || result !== null || scan.error !== null) {
        return
      }
      scan.mutate({ ticketCode: code, deviceId }, { onSuccess: setResult })
    },
    [scan, deviceId, result],
  )

  const clear = useCallback(() => {
    setResult(null)
    scan.reset()
  }, [scan])

  const doors = event.doorsOpenAt
    ? `Doors ${formatTimeInZone(event.doorsOpenAt, event.timezone)}`
    : `Starts ${formatTimeInZone(event.startsAt, event.timezone)}`

  return (
    <div className="flex h-dvh flex-col gap-3 p-3">
      {/* Typing takes the whole screen rather than the bottom third. Two 56px controls and a
          code field do not fit under a camera on a 390px phone - they overlapped the device
          line and pushed the panel into a scroll - and there is no camera in use while
          somebody is typing anyway. */}
      {typing ? (
        <form
          className="flex flex-1 flex-col justify-end gap-3"
          onSubmit={(submit) => {
            submit.preventDefault()
            present(typed)
            setTyped('')
          }}
        >
          <div className="flex-1" />
          <label className="block text-label" htmlFor="ticket-code">
            TICKET CODE, STARTING ET
          </label>
          <input
            id="ticket-code"
            className={scannerInputClass}
            value={typed}
            onChange={(change) => setTyped(change.target.value)}
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            // Never `type="search"`: some browsers keep a history of those, and a Ticket Code
            // is one of the few strings in this system that must not be stored anywhere it
            // was not put on purpose (nfr.md).
            type="text"
            enterKeyHint="go"
          />
          <ScannerButton type="submit" disabled={busy}>
            Check it
          </ScannerButton>
          <ScannerButton
            onClick={() => {
              setTyping(false)
              setTyped('')
            }}
          >
            Use the camera
          </ScannerButton>
        </form>
      ) : (
        <>
          <div className="min-h-0 flex-[2]">
            <CameraScanner active={!busy} onCode={present} />
          </div>

          {/* The bottom third. Everything an operator might have to tap is here, in the hand
              holding the phone (DESIGN.md, Responsive Behavior). */}
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-body-strong">{event.title}</p>
              <p className="text-body">
                {doors} {zoneLabel(event.timezone)}
              </p>
            </div>
            <ScannerButton onClick={() => setTyping(true)}>Type a code instead</ScannerButton>
          </div>
        </>
      )}

      {/* Not `uppercase`: a <button> does not inherit text-transform in every browser, so the
          row read CỬA CHÍNH Z1T0 · Rename · LEAVE - and the name shown was not the name being
          sent, which is the one thing this line exists to tell the operator. */}
      <p className="text-label">
        {deviceId} ·{' '}
        <button type="button" className="underline underline-offset-4" onClick={onRename}>
          Rename
        </button>{' '}
        ·{' '}
        <Link to="/" className="underline underline-offset-4">
          Leave
        </Link>
      </p>

      {result && (
        <ScanVerdict
          result={result}
          eventTitle={event.title}
          timeZone={event.timezone}
          onDismiss={clear}
        />
      )}
      {scan.isPending && <ScanWorking />}
      {scan.error != null && <ScanFailure error={scan.error} onRetry={clear} />}
    </div>
  )
}

/**
 * The active Organization is a claim inside the token, and every scan is checked against it
 * (ADR-0004). Signing in does not choose one - `Login` issues a session with no active
 * Organization on purpose, so the choice is always explicit - which means the ordinary way
 * into a scanner is with none selected, and every scan would be refused for a reason that has
 * nothing to do with the ticket.
 *
 * So this is a gate rather than a warning. A door that cannot scan should say so before the
 * queue arrives, not once per person.
 *
 * The match is by Organization name, because that is all a public Event carries. If two of the
 * caller's Organizations share a name, both are offered rather than one being guessed at.
 */
function OrganizationGate({ event, children }: { event: PublicEvent; children: ReactNode }) {
  const me = useMe()
  const { organizationId } = useSessionState()
  const switchOrganization = useSwitchOrganization()

  const memberships = me.data?.memberships ?? []
  const active = memberships.find((membership) => membership.organizationId === organizationId)

  // Not yet known is not the same as wrong. Until `/me` answers, the scanner is opening.
  if (me.isLoading) {
    return <Notice headline="Opening…" />
  }
  if (active && active.organizationName === event.organizationName) {
    return <>{children}</>
  }

  const candidates = memberships.filter(
    (membership) => membership.organizationName === event.organizationName,
  )

  if (candidates.length === 0) {
    return (
      <Notice headline="Not your door">
        This event belongs to {event.organizationName}, and you are not a member of it. Ask them
        for an account before the doors open.
      </Notice>
    )
  }

  return (
    <div className="flex h-dvh flex-col justify-end gap-4 p-4">
      <div className="flex-1" />
      <h1 className="text-title">Scanning for {event.organizationName}</h1>
      <p className="text-body">
        {active
          ? `This phone is signed in to ${active.organizationName}. The event belongs to ${event.organizationName}.`
          : 'Signing in does not pick an organization. Choose the one running this event.'}
      </p>
      {candidates.map((candidate: Membership) => (
        <ScannerButton
          key={candidate.organizationId}
          disabled={switchOrganization.isPending}
          onClick={() => switchOrganization.mutate({ id: candidate.organizationId })}
        >
          {switchOrganization.isPending ? 'Switching…' : candidate.organizationName}
        </ScannerButton>
      ))}
      <Problem error={switchOrganization.error} />
    </div>
  )
}

function NameDevice({
  current,
  onNamed,
}: {
  current: string
  onNamed: (name: string) => void
}) {
  const [name, setName] = useState(current)

  return (
    <form
      className="flex h-dvh flex-col justify-end gap-4 p-4"
      onSubmit={(submit) => {
        submit.preventDefault()
        onNamed(name)
      }}
    >
      <div className="flex-1" />
      <h1 className="text-title">Which door is this?</h1>
      <p className="text-body">
        It goes on every scan this phone makes, so that a ticket used twice can say where it was
        used the first time.
      </p>
      <input
        className={scannerTextInputClass}
        value={name}
        onChange={(change) => setName(change.target.value)}
        aria-label="Door name"
        autoComplete="off"
        maxLength={80}
        enterKeyHint="go"
      />
      <ScannerButton type="submit" disabled={name.trim() === ''}>
        Start scanning
      </ScannerButton>
    </form>
  )
}

function Notice({ headline, children }: { headline: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col justify-center gap-4 p-4">
      <h1 className="text-title">{headline}</h1>
      {children && <p className="text-body">{children}</p>}
      <Link to="/" className="text-body-strong underline underline-offset-4">
        Leave the scanner
      </Link>
    </div>
  )
}
