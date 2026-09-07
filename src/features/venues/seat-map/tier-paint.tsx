/**
 * How a Pricing Tier is painted on a seat, past the point where six hues run out.
 *
 * DESIGN.md: tier colours are categorical, and the palette is six values because adding a
 * seventh hue is a design decision rather than a convenience. A venue with seven tiers used to
 * get two the same colour - the legend still named them, so nothing was ambiguous, but the map
 * stopped being readable at a glance, which is the only thing a map is for.
 *
 * **Hue times texture, rather than more hues.** Tiers seven to twelve reuse the six hues with a
 * dotted overlay, so telling two tiers apart is either a different colour or a plain fill
 * against a dotted one - never five textures against each other. Distinguishing "dotted or not"
 * within one hue is a far easier task at the eight pixels a seat gets on a full map than
 * distinguishing dots from lines from crosses, which is where a pure-texture scale ends up.
 *
 * **Dots, specifically, because diagonals are taken.** A held seat is a diagonal hatch and a
 * sold seat a diagonal strike. Those only ever appear on seats that are *not* available, and an
 * unavailable state overrides the tier fill entirely, so the two can never land on one glyph -
 * but a texture still reads as a texture at a glance, and a tier that looked hatched would be
 * asking somebody to distinguish "expensive" from "gone" by looking harder.
 */

/**
 * Written out rather than built from a template. Tailwind scans source text for whole class
 * names, so `fill-tier-${n}` is a class that exists in this file and in no stylesheet.
 */
const TIER_HUES = [
  'fill-tier-1',
  'fill-tier-2',
  'fill-tier-3',
  'fill-tier-4',
  'fill-tier-5',
  'fill-tier-6',
] as const

/** Twelve tiers before anything repeats: six hues, plain and dotted. */
export const TIER_VARIANTS = TIER_HUES.length * 2

/**
 * A seat's paint, in the two forms the SVG needs.
 *
 * A class for a flat hue and a `fill` attribute for a pattern, because that is the split the
 * seat and the legend swatch already use for held and sold - one shape, so a tier and a state
 * are drawn by the same mechanism.
 */
export type TierPaint = { className?: string; fill?: string }

export function tierPaint(index: number): TierPaint {
  if (index < 0) {
    return { className: 'fill-paper-sunk' }
  }
  const variant = index % TIER_VARIANTS;
  return variant < TIER_HUES.length
    ? { className: TIER_HUES[variant] }
    : { fill: `url(#${patternId(variant - TIER_HUES.length)})` }
}

function patternId(hue: number): string {
  return `tier-dotted-${hue + 1}`
}

/**
 * The dotted variants, declared once for the whole page.
 *
 * Once, not once per svg: `url(#tier-dotted-1)` resolves against the document, so a copy inside
 * every legend swatch would put several elements with one id on the page - invalid, and
 * resolving to whichever the browser saw first.
 *
 * `patternUnits="userSpaceOnUse"` puts the dots in map coordinates, like the held and sold
 * patterns, so they scale with the zoom instead of pooling into a smudge when somebody zooms
 * out over two thousand seats.
 */
export function TierPatternDefs() {
  return (
    <svg aria-hidden className="absolute size-0" focusable="false">
      <defs>
        {TIER_HUES.map((hue, index) => (
          <pattern
            key={hue}
            id={patternId(index)}
            width={0.34}
            height={0.34}
            patternUnits="userSpaceOnUse"
          >
            <rect width={0.34} height={0.34} className={hue} />
            {/*
              Small and well spaced, because a seat carries its label on top of this. The first
              version used dots twice this size and the labels in a dotted row were markedly
              harder to read than the ones above them - the texture only has to say "not the
              same tier as that one", and the legend is what names it.
            */}
            <circle cx={0.17} cy={0.17} r={0.055} className="fill-ink" />
          </pattern>
        ))}
      </defs>
    </svg>
  )
}
