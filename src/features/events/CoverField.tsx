import { useRef, useState } from 'react'
import type { Event } from '~/api/types'
import { Button, CoverImage, Problem, cx } from '~/shared/ui'
import { useRemoveCover, useSetCover } from './cover-hooks'

/**
 * The Event's cover, managed on its own rather than inside the Details form.
 *
 * Uploading and removing are their own endpoints and happen at once, the way publishing does;
 * a picture is an action, not a field you save later. The alt text beside it *is* a field -
 * it goes through the ordinary patch with the title and the description - which is why it is
 * the one part of this that lives in the form above.
 *
 * Choosing a file uploads it immediately. The alternative is a Choose and then an Upload, and
 * the second button exists only to ask "are you sure about the file you just chose", which the
 * picture appearing answers better.
 */
export function CoverField({ event }: { event: Event }) {
  const upload = useSetCover(event.id)
  const remove = useRemoveCover(event.id)
  const file = useRef<HTMLInputElement>(null)
  const [confirming, setConfirming] = useState(false)

  const busy = upload.isPending || remove.isPending
  const has = Boolean(event.coverImageUrl)

  const choose = (chosen: File | undefined) => {
    if (!chosen) {
      return
    }
    // The alt text already on the Event, so replacing a picture of the same thing does not
    // silently drop its description. A new subject needs a new description either way, and the
    // field is right there.
    upload.mutate(
      { file: chosen, alt: event.coverImageAlt ?? undefined },
      {
        // Cleared either way: a file input that keeps its selection will not fire `change`
        // when the same file is chosen again, so a failed upload could not be retried.
        onSettled: () => {
          if (file.current) {
            file.current.value = ''
          }
        },
      },
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-label uppercase">Cover image</div>

      {has && (
        <CoverImage
          src={event.coverImageUrl}
          alt={event.coverImageAlt}
          className="max-w-96"
          eager
        />
      )}

      <p className="text-body text-ink-soft">
        {has
          ? 'Shown on the event’s page and in the public listing.'
          : 'Optional. Shown on the event’s page and in the public listing.'}{' '}
        JPEG, PNG, WebP or AVIF, up to 5 MB.
      </p>

      <Problem error={upload.error ?? remove.error} />

      <div className="flex flex-wrap items-center gap-3">
        {/*
          A real file input, labelled rather than replaced. A hidden input driven by a styled
          button is the usual trick here and it costs the keyboard and the screen reader their
          only native way in - the control announces itself, says what it accepts, and opens on
          Enter, none of which a div gets for free.
        */}
        <label
          className={cx(
            'inline-flex cursor-pointer items-center border-2 border-ink bg-paper px-4 py-2',
            'text-body font-semibold shadow-raised',
            'transition-[transform,box-shadow] duration-[60ms] ease-linear',
            'hover:shadow-hover active:translate-x-1 active:translate-y-1 active:shadow-none',
            'focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-info',
            'motion-reduce:transition-none',
            busy && 'pointer-events-none opacity-60',
          )}
        >
          {upload.isPending ? 'Uploading…' : has ? 'Replace image' : 'Choose an image'}
          <input
            ref={file}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            className="sr-only"
            disabled={busy}
            onChange={(change) => choose(change.target.files?.[0])}
          />
        </label>

        {has && !confirming && (
          <Button
            variant="ghost"
            className="w-auto"
            type="button"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            Remove
          </Button>
        )}
      </div>

      {/*
        Removing deletes the file, and nothing brings it back - so it asks once. Not a modal:
        the thing being confirmed is right above the question, which a dialog would cover up.
      */}
      {confirming && (
        <div className="space-y-3 border-2 border-ink bg-paper-sunk px-4 py-3">
          <p className="text-body text-ink">
            Remove this cover? The image is deleted, and the event goes back to having none.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="destructive"
              className="w-auto"
              type="button"
              pending={remove.isPending}
              onClick={() =>
                remove.mutate(undefined, { onSuccess: () => setConfirming(false) })
              }
            >
              Remove cover
            </Button>
            <Button
              variant="ghost"
              className="w-auto"
              type="button"
              onClick={() => setConfirming(false)}
            >
              Keep it
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
