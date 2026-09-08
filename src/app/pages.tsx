import { Link } from 'react-router'
import { EmptyState } from '~/shared/ui'

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
