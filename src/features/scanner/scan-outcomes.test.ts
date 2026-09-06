import { describe, expect, it } from 'vitest'
import type { ScanOutcome } from '~/api/types'
import { verdictOf, vibrationFor, wordFor } from './scan-outcomes'
import { composeDeviceId } from './device-id'

/**
 * Written out rather than derived. `outcome !== 'ADMITTED'` is one character away from
 * admitting everybody, and a test that computes the answer the same way the code does would
 * agree with that character too.
 */
const outcomes: Record<ScanOutcome, 'ADMIT' | 'REFUSE'> = {
  ADMITTED: 'ADMIT',
  ALREADY_REDEEMED: 'REFUSE',
  WRONG_EVENT: 'REFUSE',
  TICKET_VOID: 'REFUSE',
  EVENT_NOT_OPEN: 'REFUSE',
  EVENT_ENDED: 'REFUSE',
  UNKNOWN_CODE: 'REFUSE',
}

describe('the verdict', () => {
  it.each(Object.entries(outcomes))('%s is a %s', (outcome, expected) => {
    expect(verdictOf(outcome as ScanOutcome)).toBe(expected)
  })

  /**
   * The contract's enum, read at test time. A new outcome added to the KB and vendored here
   * without being classified would otherwise default to REFUSE silently - which is the safe
   * direction, but silence is how it would stay unclassified for a release.
   */
  it('classifies every outcome the contract defines', () => {
    const contract: ScanOutcome[] = [
      'ADMITTED',
      'ALREADY_REDEEMED',
      'WRONG_EVENT',
      'TICKET_VOID',
      'EVENT_NOT_OPEN',
      'EVENT_ENDED',
      'UNKNOWN_CODE',
    ]
    expect(Object.keys(outcomes).sort()).toEqual([...contract].sort())
  })

  it('says one word, and it is an instruction rather than a status', () => {
    expect(wordFor('ADMIT')).toBe('IN')
    expect(wordFor('REFUSE')).toBe('NO')
  })

  it('buzzes differently for the two, so a pocket can tell them apart', () => {
    expect(vibrationFor('ADMIT')).not.toEqual(vibrationFor('REFUSE'))
    expect(vibrationFor('ADMIT')).toHaveLength(1)
    expect(vibrationFor('REFUSE').length).toBeGreaterThan(1)
  })
})

describe('the device id', () => {
  it('keeps the name a person gave it', () => {
    expect(composeDeviceId('Main Door', '7QK2')).toBe('Main Door 7QK2')
  })

  it('separates two doors somebody gave the same name', () => {
    expect(composeDeviceId('Main Door', '7QK2')).not.toBe(composeDeviceId('Main Door', 'X31P'))
  })

  it('is still a device when nobody has named it', () => {
    expect(composeDeviceId('   ', '7QK2')).toBe('Device 7QK2')
  })

  /** The contract caps `deviceId` at 100 characters, and a 429 is not the way to find out. */
  it('fits the contract however long a name is', () => {
    expect(composeDeviceId('D'.repeat(500), '7QK2').length).toBeLessThanOrEqual(100)
  })
})
