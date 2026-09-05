import type { ReactNode } from 'react'
import { ApiError, OfflineError } from '~/api/errors'

/**
 * The one way a failure is shown.
 *
 * The backend writes messages meant to be read by the person who hit them - they say
 * what went wrong and what to do next - so this shows the message rather than mapping
 * codes to prose of our own, which would only be worse and would drift.
 */
export function Problem({ error }: { error: unknown }) {
  if (!error) {
    return null
  }
  const message =
    error instanceof ApiError || error instanceof OfflineError
      ? error.message
      : 'Something went wrong. Please try again.'

  return (
    <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
      {message}
    </p>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  )
}

export const inputClass =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-base outline-none focus:border-slate-900'

export function Button({
  children,
  pending,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || pending}
      className="w-full rounded-md bg-slate-900 px-4 py-2.5 font-medium text-white disabled:opacity-50"
    >
      {pending ? 'Working…' : children}
    </button>
  )
}
