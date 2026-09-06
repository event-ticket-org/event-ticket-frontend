import type { ApiErrorBody, ErrorCode } from './types'

/**
 * A failure the contract has a code for.
 *
 * The backend answers every failure with one envelope - `{ code, message, details }` -
 * so that a client parses errors once. This is that envelope, and the reason to branch
 * on `code` rather than on `status`: `SEATS_UNAVAILABLE` and `ORDER_ALREADY_PAID` are
 * both 409 and mean entirely different things to a buyer.
 *
 * `message` is written to be shown. The backend's messages say what went wrong *and*
 * what to do next, so rewriting them here would usually make them worse.
 */
export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode | 'UNPARSEABLE'
  readonly details: Record<string, unknown>

  constructor(status: number, body: Partial<ApiErrorBody> | null) {
    super(body?.message ?? 'Something went wrong. Please try again.')
    this.name = 'ApiError'
    this.status = status
    this.code = body?.code ?? 'UNPARSEABLE'
    this.details = (body?.details as Record<string, unknown>) ?? {}
  }

  is(...codes: ErrorCode[]): boolean {
    return codes.includes(this.code as ErrorCode)
  }

  /** `details.seatIds` on a checkout conflict: the seats somebody else took first. */
  get seatIds(): string[] {
    const ids = this.details.seatIds
    return Array.isArray(ids) ? (ids as string[]) : []
  }
}

/**
 * A failure the client detected, carrying a message written to be read.
 *
 * `Problem` shows an `ApiError`'s message because the backend writes messages for the person
 * who hit them, and replaces everything else with one generic sentence - which is right, and
 * is what stops a `TypeError` reaching a user. This is the third case: something the client
 * knew before the server did, or knows better. A file too large to be worth sending, or a
 * storage host that answered in XML, are both better described here than anywhere else.
 */
export class ReadableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ReadableError'
  }
}

/** Network failures reach the user as something they can act on, not as "TypeError". */
export class OfflineError extends Error {
  constructor() {
    super('Could not reach the server. Check your connection and try again.')
    this.name = 'OfflineError'
  }
}
