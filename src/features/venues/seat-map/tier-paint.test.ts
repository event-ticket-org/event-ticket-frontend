import { describe, expect, it } from 'vitest'
import { TIER_VARIANTS, tierPaint } from './tier-paint'

describe('how a pricing tier is painted', () => {
  it('gives the first six tiers a flat hue each', () => {
    const hues = [0, 1, 2, 3, 4, 5].map((index) => tierPaint(index).className)

    expect(hues).toEqual([
      'fill-tier-1',
      'fill-tier-2',
      'fill-tier-3',
      'fill-tier-4',
      'fill-tier-5',
      'fill-tier-6',
    ])
    // A flat hue is a class and nothing else, so the fill attribute stays free for the
    // held and sold patterns the seat already uses.
    expect([0, 5].map((index) => tierPaint(index).fill)).toEqual([undefined, undefined])
  })

  /**
   * The whole point of the change. A seventh tier used to be `fill-tier-1` again: the legend
   * still named it, so nothing was ambiguous, but two tiers were one colour on the map - and
   * reading the map at a glance is the only thing a map is for.
   */
  it('does not repeat a hue at the seventh tier', () => {
    expect(tierPaint(6)).not.toEqual(tierPaint(0))
    expect(tierPaint(6).className).toBeUndefined()
    expect(tierPaint(6).fill).toBe('url(#tier-dotted-1)')
  })

  it('reuses the six hues as dotted variants, in the same order', () => {
    expect([6, 7, 8, 9, 10, 11].map((index) => tierPaint(index).fill)).toEqual([
      'url(#tier-dotted-1)',
      'url(#tier-dotted-2)',
      'url(#tier-dotted-3)',
      'url(#tier-dotted-4)',
      'url(#tier-dotted-5)',
      'url(#tier-dotted-6)',
    ])
  })

  /**
   * Twelve, not six. It still repeats - a scale has to end somewhere - but a venue with
   * thirteen pricing tiers has a problem this document cannot solve for it.
   */
  it('repeats only after twelve', () => {
    expect(TIER_VARIANTS).toBe(12)
    expect(tierPaint(12)).toEqual(tierPaint(0))
    expect(tierPaint(18)).toEqual(tierPaint(6))
  })

  /** A tier the map does not know about: `indexOf` answers -1, and a seat still needs a fill. */
  it('paints an unknown tier rather than nothing', () => {
    expect(tierPaint(-1).className).toBe('fill-paper-sunk')
  })
})
