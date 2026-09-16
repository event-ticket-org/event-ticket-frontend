import { useState } from 'react'
import { Link } from 'react-router'
import { formatMoney } from '~/shared/format'
import { CoverImage, TimeWithZone, cx } from '~/shared/ui'
import { useFeaturedEvents } from './public-hooks'

/**
 * The curated row: what a platform administrator has placed, one at a time
 * (requirements/009 criterion 14).
 *
 * Whether it appears is the server's decision - below three live placements the endpoint
 * answers an empty array, and nothing here second-guesses that.
 *
 * **It does not advance by itself.** The obvious reference autoplays, and autoplay is the one
 * carousel behaviour that reliably makes people angry: it moves the thing somebody was reading,
 * it takes the decision about pace away from them, and honouring `prefers-reduced-motion`
 * properly means building the manual version anyway and then not using it. DESIGN.md's voice
 * does not sell, and a banner that changes itself is selling. So: two buttons, numbered
 * indicators, and it stays where it is put.
 *
 * **Only the current slide is in the DOM.** Rendering all of them and hiding the rest leaves
 * their links in the tab order, so a keyboard user tabs through four events they cannot see -
 * and `aria-hidden` on a container holding a focusable link is a lie the browser does not
 * enforce.
 */
export function Hero() {
  const featured = useFeaturedEvents()
  const slides = featured.data ?? []
  const [index, setIndex] = useState(0)

  if (slides.length === 0) {
    return null
  }

  // Clamped rather than kept in step with a list that can shrink under it: a refetch after a
  // placement expires leaves the index past the end, and the fix belongs where it is read.
  const current = slides[Math.min(index, slides.length - 1)]
  if (!current) {
    return null
  }

  const move = (by: number) => setIndex((was) => (was + by + slides.length) % slides.length)

  return (
    <section aria-label="Featured events" className="space-y-3">
      <Link
        to={`/events/${current.id}`}
        className={cx(
          'block border-2 border-ink bg-paper shadow-lifted',
          'transition-[transform,box-shadow] duration-[60ms] ease-linear',
          'hover:shadow-hover active:translate-x-1 active:translate-y-1 active:shadow-none',
          'motion-reduce:transition-none',
        )}
      >
        <CoverImage
          src={current.coverImageUrl}
          alt={current.coverImageAlt}
          sizes={current.coverImageSizes}
          shape="hero"
          className="border-0 border-b-2"
          eager
        />
        <div className="space-y-2 p-5">
          <h2 className="text-title">{current.title}</h2>
          <p className="text-body text-ink-soft">
            {current.venueName}, {current.city}
          </p>
          <p>
            <TimeWithZone iso={current.startsAt} timeZone={current.timezone} />
          </p>
          {current.priceFrom && (
            <p className="text-body">
              from{' '}
              <span className="font-numeric text-numeric-lg">
                {formatMoney(current.priceFrom)}
              </span>
            </p>
          )}
        </div>
      </Link>

      {slides.length > 1 && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => move(-1)}
            className="min-h-11 border-2 border-ink bg-paper px-4 text-label uppercase"
          >
            <span aria-hidden="true">←</span>
            <span className="sr-only">Previous featured event</span>
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="min-h-11 border-2 border-ink bg-paper px-4 text-label uppercase"
          >
            <span aria-hidden="true">→</span>
            <span className="sr-only">Next featured event</span>
          </button>

          {/*
            Numbers rather than dots. A dot is a 6px target that says nothing about where you
            are in a row of five, and this type system has a numeric face doing exactly this
            job elsewhere. They are buttons because they are reachable positions, not decoration.
          */}
          <ol className="ml-auto flex gap-1">
            {slides.map((slide, position) => (
              <li key={slide.id}>
                <button
                  type="button"
                  aria-current={position === index ? 'true' : undefined}
                  onClick={() => setIndex(position)}
                  className={cx(
                    'min-h-11 min-w-11 border-2 border-ink font-numeric',
                    position === index ? 'bg-ink text-paper' : 'bg-paper',
                  )}
                >
                  {position + 1}
                  <span className="sr-only">
                    {position === index ? ' (showing)' : ` Show ${slide.title}`}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
