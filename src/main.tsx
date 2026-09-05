import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { ApiError } from '~/api/errors'
import { router } from '~/app/router'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A refusal the contract has a code for is an answer, not a hiccup. Retrying a
      // 403 or a 409 wastes time and, at a door, makes a queue wait for the same no.
      retry: (failureCount, error) =>
        !(error instanceof ApiError) && failureCount < 2,
      refetchOnWindowFocus: false,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
