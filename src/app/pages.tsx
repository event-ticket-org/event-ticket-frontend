import { Link } from 'react-router'
import { EmptyState } from '~/shared/ui'

/**
 * A route that exists and says what will be here. During development this beats a 404,
 * which is indistinguishable from a routing bug.
 */
export function PlaceholderPage({ what, slice }: { what: string; slice: string }) {
  return (
    <div className="border-2 border-dashed border-ink-soft bg-paper p-8">
      <h1 className="text-heading text-ink">{what}</h1>
      <p className="mt-2 text-body text-ink-soft">Arrives in slice {slice}.</p>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="mx-auto mt-16 max-w-[640px] px-4">
      <EmptyState
        headline="Not found"
        action={
          <Link className="underline underline-offset-4" to="/">
            Back to the start
          </Link>
        }
      >
        There is nothing at this address.
      </EmptyState>
    </div>
  )
}
