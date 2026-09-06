import { describe, expect, it } from 'vitest'
import type { Role } from '~/api/types'
import { ROLES, roleLabel } from './roles'

describe('roles', () => {
  /**
   * Read from the contract's enum rather than restated. A fourth Role added to the KB and
   * vendored here would otherwise appear in the picker as a bare `SOMETHING_ELSE` with no
   * account of what it grants - which is the one thing this list exists to give.
   */
  it('says what every Role in the contract grants', () => {
    const contract: Role[] = ['OWNER', 'MANAGER', 'GATE_STAFF']
    expect(ROLES.map((known) => known.role).sort()).toEqual([...contract].sort())
    ROLES.forEach((known) => expect(known.grants.length).toBeGreaterThan(20))
  })

  /** The smallest grant first: the top of a list is what a hurried person picks. */
  it('offers the least powerful role first', () => {
    expect(ROLES.at(0)?.role).toBe('GATE_STAFF')
    expect(ROLES.at(-1)?.role).toBe('OWNER')
  })

  it('falls back to the contract value rather than rendering nothing', () => {
    expect(roleLabel('MANAGER')).toBe('Manager')
    expect(roleLabel('SOMETHING_ELSE' as Role)).toBe('SOMETHING_ELSE')
  })
})
