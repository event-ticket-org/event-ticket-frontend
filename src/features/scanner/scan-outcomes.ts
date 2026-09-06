import type { ScanOutcome } from '~/api/types'

/**
 * A scan has exactly two shapes on screen: let them in, or do not.
 *
 * Seven outcomes, one bit. That reduction is the whole job of this screen - an operator at a
 * door has a queue behind the person in front of them and no time to read a taxonomy. The
 * distinction between the six refusals still matters, and it is carried by the reason line
 * underneath in the server's own words (requirements/007 criterion 4), not by the verdict.
 */
export type Verdict = 'ADMIT' | 'REFUSE'

export function verdictOf(outcome: ScanOutcome): Verdict {
  return outcome === 'ADMITTED' ? 'ADMIT' : 'REFUSE'
}

/**
 * The word, which is the largest thing on the screen and the one carried at arm's length.
 *
 * Deliberately not the outcome name. `ALREADY_REDEEMED` and `EVENT_NOT_OPEN` are facts about
 * a ticket; `NO` is an instruction to the person holding the door.
 */
export function wordFor(verdict: Verdict): string {
  return verdict === 'ADMIT' ? 'IN' : 'NO'
}

/**
 * How the device should buzz.
 *
 * Different patterns, because a phone at a gate is often not being looked at between scans -
 * it is held out while the operator looks at the person. One short pulse for admit and three
 * for refuse is distinguishable in a pocket, and is the only channel here that works when
 * nobody is watching the screen.
 */
export function vibrationFor(verdict: Verdict): number[] {
  return verdict === 'ADMIT' ? [40] : [80, 60, 80, 60, 80]
}

/**
 * How long the verdict stays before the scanner will look at another code.
 *
 * Four seconds, and never less. A scanner that clears itself the moment the camera sees the
 * next thing is a scanner that admitted somebody nobody checked - the verdict has to survive
 * the operator glancing up at the person in front of them and back again.
 */
export const VERDICT_HOLD_MS = 4_000

/**
 * How long the same code is ignored after being seen.
 *
 * A camera pointed at one QR fires the same read many times a second. The backend rate-limits
 * per device generously for exactly this reason (`nfr.md`), and this keeps the flood from
 * being sent at all: a door that failed because somebody held their phone still would be
 * worse than the abuse the limit prevents.
 */
export const SAME_CODE_COOLDOWN_MS = 5_000
