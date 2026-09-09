import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Event, Venue } from '~/api/types'
import { Schedule } from './EventPage'

/**
 * That the rules reach the person, which is a different claim from the rules being right.
 *
 * `schedule.test.ts` proves `scheduleProblems`. It says nothing about whether a message ever
 * appears under a field, or whether Save is still clickable while one stands - and those are
 * the parts that make the validation exist as far as anybody using it is concerned. A `problem`
 * prop wired to the wrong field would pass every test in that file.
 *
 * Written because the alternative was a manual check, and the manual check misled me three
 * times: driving a `datetime-local` from outside React updates the DOM without updating the
 * component, so the form looks broken while being fine. A test that renders the real component
 * and changes it the way React hears cannot make that mistake twice.
 */

afterEach(cleanup)

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

const venue = { id: 'v1', name: 'Nhà Hát Lớn', city: 'Hà Nội', timezone: 'Asia/Ho_Chi_Minh' } as Venue

function anEvent(overrides: Partial<Event> = {}): Event {
  return {
    id: 'e1',
    venueId: venue.id,
    title: 'Đêm nhạc',
    status: 'DRAFT',
    listed: false,
    // 19:00 local, well ahead of any clock a test runs under.
    startsAt: '2026-10-29T12:00:00Z',
    pricingTiers: [],
    ...overrides,
  } as Event
}

function renderSchedule(event = anEvent()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <Schedule eventId={event.id} event={event} venue={venue} />
    </QueryClientProvider>,
  )
}

/**
 * The three inputs in document order: doors, starts, ends.
 *
 * Asserting the count rather than indexing blindly: if the form ever renders a different
 * number of date fields, every test below would otherwise start driving the wrong one and
 * still pass.
 */
function fields() {
  const inputs = [...document.querySelectorAll<HTMLInputElement>('input[type="datetime-local"]')]
  const [doors, starts, ends] = inputs
  if (!doors || !starts || !ends || inputs.length !== 3) {
    throw new Error(`expected three date fields, found ${inputs.length}`)
  }
  return { doors, starts, ends }
}

function save() {
  return screen.getByRole('button', { name: /save schedule/i }) as HTMLButtonElement
}

function alerts() {
  return [...document.querySelectorAll('[role="alert"]')].map((a) => a.textContent?.trim() ?? '')
}

describe('the schedule form', () => {
  it('says nothing before anything is edited', () => {
    renderSchedule()
    expect(alerts()).toEqual([])
    // Disabled because nothing changed, which is the pre-existing behaviour.
    expect(save().disabled).toBe(true)
  })

  it('puts the complaint under the field it is about, and stops the save', () => {
    renderSchedule()

    // 21:00 local, two hours after the 19:00 start.
    fireEvent.change(fields().doors, { target: { value: '2026-10-29T21:00' } })

    expect(alerts()).toEqual(['Doors cannot open after the event has started.'])
    expect(save().disabled).toBe(true)
  })

  /**
   * The wiring failure this file is really for: a `problem` reaching the wrong `Field` shows a
   * message, so asserting only that one appeared would pass. Which input it sits beside is the
   * whole of what a person uses it for.
   */
  it('puts each complaint beside its own input', () => {
    renderSchedule()

    fireEvent.change(fields().doors, { target: { value: '2026-10-29T21:00' } })
    fireEvent.change(fields().ends, { target: { value: '2026-10-29T17:00' } })

    const labelOf = (input: HTMLInputElement) =>
      input.closest('label')?.querySelector('[role="alert"]')?.textContent?.trim()

    expect(labelOf(fields().doors)).toMatch(/doors cannot open/i)
    expect(labelOf(fields().ends)).toMatch(/end after it starts/i)
    expect(labelOf(fields().starts)).toBeUndefined()
  })

  it('clears the complaint and allows the save once it is corrected', () => {
    renderSchedule()

    fireEvent.change(fields().doors, { target: { value: '2026-10-29T21:00' } })
    expect(save().disabled).toBe(true)

    fireEvent.change(fields().doors, { target: { value: '2026-10-29T18:00' } })
    expect(alerts()).toEqual([])
    expect(save().disabled).toBe(false)
  })

  it('does not send a schedule the server would refuse', async () => {
    renderSchedule()

    fireEvent.change(fields().doors, { target: { value: '2026-10-29T21:00' } })
    fireEvent.submit(fields().doors.closest('form') as HTMLFormElement)

    await waitFor(() => expect(true).toBe(true))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends a corrected schedule', async () => {
    renderSchedule()

    fireEvent.change(fields().doors, { target: { value: '2026-10-29T18:00' } })
    fireEvent.submit(fields().doors.closest('form') as HTMLFormElement)

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(String(url)).toContain('/events/e1')
    expect(JSON.parse(String(init.body)).doorsOpenAt).toBe('2026-10-29T11:00:00.000Z')
  })

  /**
   * requirements/003: only a published Event is held to the future. A draft in the past is how
   * somebody records an event that already happened, and a client refusing it would be stricter
   * than the server it speaks to - a refusal with no error to read and no way to proceed.
   */
  it('lets a draft sit in the past and refuses the same move once published', () => {
    const { unmount } = renderSchedule(anEvent({ startsAt: '2024-01-01T12:00:00Z' }))
    fireEvent.change(fields().starts, { target: { value: '2024-01-02T19:00' } })
    expect(alerts()).toEqual([])
    unmount()

    renderSchedule(anEvent({ status: 'PUBLISHED', startsAt: '2026-10-29T12:00:00Z' }))
    fireEvent.change(fields().starts, { target: { value: '2024-01-02T19:00' } })
    expect(alerts()[0]).toMatch(/cannot be moved into the past/i)
    expect(save().disabled).toBe(true)
  })
})
