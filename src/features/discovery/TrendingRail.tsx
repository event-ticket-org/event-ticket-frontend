import { Rail, RailCard } from './EventRail'
import { useTrendingEvents } from './public-hooks'

/**
 * The ranked row: what sold this week, numbered from one
 * (requirements/009 criterion 15).
 *
 * <p>Whether it appears at all is the server's decision - below five qualifying events the
 * endpoint answers an empty array, because a chart of two is not a chart. Nothing here
 * re-implements that threshold: two places deciding the same thing is two places to change it,
 * and the one that gets forgotten is the one drawing a row of two.
 *
 * The heading says what the ranking measures. "Trending" on its own is the word every site uses
 * for whatever it wants to promote, and this one means something narrow and checkable - tickets
 * sold in the last week, and nothing else. Saying so costs three words and is the difference
 * between a chart and an advertisement.
 */
export function TrendingRail() {
  const trending = useTrendingEvents()
  const rows = trending.data ?? []

  if (rows.length === 0) {
    return null
  }

  return (
    <Rail title={<>🔥 Selling fastest this week</>}>
      {rows.map((entry) => (
        <li key={entry.event.id} className="w-64 shrink-0 snap-start">
          <RailCard event={entry.event} rank={entry.rank} />
        </li>
      ))}
    </Rail>
  )
}
