import { QueryClient } from '@tanstack/react-query'
import { ApiError } from '~/api/errors'

/**
 * The client's two standing decisions about failure.
 *
 * Extracted from `main.tsx` so they can be asserted rather than assumed: both are defaults, and
 * a default is the kind of thing that gets changed by somebody who does not know what it was
 * holding up.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // A refusal the contract has a code for is an answer, not a hiccup. Retrying a
        // 403 or a 409 wastes time and, at a door, makes a queue wait for the same no.
        retry: (failureCount, error) => !(error instanceof ApiError) && failureCount < 2,
        refetchOnWindowFocus: false,
      },
      mutations: {
        /**
         * TanStack's default is `online`, and with the browser reporting no connection it does
         * not fail a mutation - it **pauses** it. `isPending` stays true, the request is never
         * sent, and it runs when the network comes back.
         *
         * That would be right for an application with an offline mode. This one has none: no
         * persister, no queue, nothing that survives the tab. Every mutation here is a person
         * pressing a button and waiting for the answer, so a paused one is a button that says
         * `Working…` for as long as the signal is out and then does the thing at a moment
         * nobody chose.
         *
         * It was watched happening at the door - the scanner sat on `Checking…` and then
         * admitted somebody minutes later, to a phone nobody was looking at, which is the
         * optimistic admission requirements/007 criterion 11 forbids. The same shape is worse
         * elsewhere: a paused checkout holds seats and starts a ten-minute clock the buyer was
         * never shown, a paused seat map save lands on top of newer edits, and a paused sign-out
         * never reaches its `onSettled`, so the one thing it must always do - clear this browser
         * - is the one thing it does not.
         *
         * Queries keep the default. A paused read is a spinner; a paused write is an action.
         */
        networkMode: 'always',
      },
    },
  })
}
