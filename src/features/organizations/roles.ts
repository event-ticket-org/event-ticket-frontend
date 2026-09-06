import type { Role } from '~/api/types'

/**
 * What each Role actually grants, in the words an Owner needs when they are handing somebody
 * a phone at a gate or a login to their pricing.
 *
 * This is not decoration. A role picker that offers three words and no consequences is how
 * volunteers end up as Managers - the person choosing knows what they want the volunteer to
 * *do*, not which of three nouns the system calls it.
 */
export const ROLES: { role: Role; label: string; grants: string }[] = [
  {
    role: 'GATE_STAFF',
    label: 'Gate staff',
    // requirements/007 criterion 13, and the reason this role exists at all.
    grants: 'The door scanner, and nothing else. No sales figures, no buyer details.',
  },
  {
    role: 'MANAGER',
    label: 'Manager',
    grants: 'Venues, events, pricing and the door. Cannot change who is on the team.',
  },
  {
    role: 'OWNER',
    label: 'Owner',
    grants: 'Everything a manager can do, and adding, removing and re-roling people.',
  },
]

/**
 * Least first. An Owner scanning this list reads the smallest grant before the largest, which
 * is the order in which the choice should be made - and the order in which an interface should
 * offer it, since the top item is the one a hurried person takes.
 */
export function roleLabel(role: Role): string {
  return ROLES.find((known) => known.role === role)?.label ?? role
}
