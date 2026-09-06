import { useCallback, useEffect, useState } from 'react'

/**
 * A seat selection that survives signing in.
 *
 * requirements/004 criterion 4: a visitor may select seats before signing in, and only
 * checkout needs an account. Signing in navigates away and comes back, so a selection held
 * in component state would be gone by the time the person returns - having been sent away by
 * the very button they pressed to buy the seats they had just chosen.
 *
 * `sessionStorage`, not `localStorage`: this belongs to the tab and to today. A selection
 * resurrected next week would be seats somebody else has long since bought.
 *
 * Not the URL either, though it survives the same round trip. Seat ids are UUIDs, and a
 * shareable link full of them says nothing to whoever receives it, while making the page's
 * address change every time somebody clicks a chair.
 */
const key = (eventId: string) => `eventticket.selection.${eventId}`

function read(eventId: string): string[] {
  try {
    const stored = sessionStorage.getItem(key(eventId))
    const parsed: unknown = stored ? JSON.parse(stored) : []
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    // A private window, or storage the browser has decided to refuse. An empty selection is
    // the right answer: the page still works, it just starts from nothing.
    return []
  }
}

function write(eventId: string, seatIds: string[]): void {
  try {
    if (seatIds.length === 0) {
      sessionStorage.removeItem(key(eventId))
    } else {
      sessionStorage.setItem(key(eventId), JSON.stringify(seatIds))
    }
  } catch {
    // Nothing to do about it, and nothing worth telling the buyer: the selection simply will
    // not survive a sign-in in this browser.
  }
}

export function useSeatSelection(eventId: string) {
  const [selected, setSelected] = useState<string[]>(() => read(eventId))

  useEffect(() => setSelected(read(eventId)), [eventId])
  useEffect(() => write(eventId, selected), [eventId, selected])

  const toggle = useCallback((seatId: string) => {
    setSelected((current) =>
      current.includes(seatId) ? current.filter((id) => id !== seatId) : [...current, seatId],
    )
  }, [])

  const clear = useCallback(() => setSelected([]), [])

  /**
   * Drops exactly the seats somebody else took first, keeping the rest.
   *
   * requirements/004 criterion 6: a checkout refused because a seat went names those seats,
   * and the remaining selection is preserved. Clearing the lot would make the buyer rebuild a
   * choice that is still almost entirely valid - and race the next person while doing it.
   */
  const dropTaken = useCallback((taken: string[]) => {
    setSelected((current) => current.filter((id) => !taken.includes(id)))
  }, [])

  return { selected, toggle, clear, dropTaken }
}
