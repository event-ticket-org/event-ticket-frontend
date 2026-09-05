import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { nextPageParam } from '~/features/admin/admin-hooks'
import { statusColours } from './ui'

/**
 * Read the enums out of the vendored contract rather than restating them here. A list typed
 * into a test is a second copy of the contract that stops being true quietly, which is the
 * failure this test exists to prevent in the first place.
 */
function enumValues(schema: string): string[] {
  const contract = readFileSync('contracts/openapi.yaml', 'utf8')
  const at = contract.indexOf(`\n    ${schema}:`)
  if (at < 0) {
    throw new Error(`${schema} is not in the contract`)
  }
  const block = contract.slice(at, at + 900)
  const inline = /enum:\s*\[([^\]]+)\]/.exec(block)
  if (inline?.[1]) {
    return inline[1].split(',').map((value) => value.trim())
  }
  const listed = /enum:\n((?:\s+-\s+[A-Z_]+\n)+)/.exec(block)
  if (!listed?.[1]) {
    throw new Error(`${schema} has no enum`)
  }
  return listed[1]
    .split('\n')
    .map((line) => line.replace(/^\s*-\s*/, '').trim())
    .filter(Boolean)
}

describe('every status the contract can send has a colour', () => {
  // The bug this catches, which shipped once: OrganizationStatus is PENDING_APPROVAL, the
  // map said PENDING, and a waiting organization rendered in the neutral fill as though it
  // had no status at all. Nothing failed - it just looked finished and said the wrong thing.
  it.each([
    'OrganizationStatus',
    'EventStatus',
    'OrderStatus',
    'RefundStatus',
    'ScanOutcome',
  ])('%s', (schema) => {
    const values = enumValues(schema)
    expect(values.length).toBeGreaterThan(0)
    expect(values.filter((value) => !(value in statusColours))).toEqual([])
  })

  it('covers a Ticket status, which the contract declares inline rather than as a schema', () => {
    for (const status of ['VALID', 'REDEEMED', 'VOID']) {
      expect(statusColours).toHaveProperty(status)
    }
  })
})

describe('keyset pagination', () => {
  it('stops on a null cursor rather than asking for the same page for ever', () => {
    // TanStack Query treats anything that is not undefined as another page, and the backend
    // really does answer with an explicit null on the last one.
    expect(nextPageParam({ nextCursor: null })).toBeUndefined()
    expect(nextPageParam({})).toBeUndefined()
  })

  it('continues on a real cursor', () => {
    expect(nextPageParam({ nextCursor: 'opaque-cursor' })).toBe('opaque-cursor')
  })
})
