import { cx } from '~/shared/ui'

/**
 * The scanner's controls.
 *
 * They are not the shared ones with a class or two changed. The shared Button is paper-filled
 * with an ink border and an ink shadow, and every one of those three disappears on the night
 * ground - the border separates nothing, and the shadow is ink on ink. DESIGN.md gives the
 * scanner shell its own inverted palette for exactly that reason, and 56px because every
 * mis-tap at a gate is a person waiting.
 */
export function ScannerButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex min-h-14 w-full items-center justify-center px-6 py-4 text-body-strong',
        'border-2 border-chalk bg-night-raised text-chalk shadow-raised-chalk',
        'transition-[transform,box-shadow] duration-[60ms] ease-linear',
        'active:translate-x-1 active:translate-y-1 active:shadow-none',
        // Elevation is the affordance here too: a control that cannot be pressed loses its
        // shadow and keeps its contrast, rather than fading into a ground that is already dark.
        'disabled:cursor-not-allowed disabled:shadow-none disabled:active:translate-x-0 disabled:active:translate-y-0',
        'motion-reduce:transition-none',
        className,
      )}
    >
      {children}
    </button>
  )
}

/**
 * The one input in the scanner: a Ticket Code typed in, for the cracked screen the camera
 * will not read.
 *
 * `uppercase` is safe and useful here specifically - a code is `ET1-` and hexadecimal, which
 * the backend uppercases and trims before it looks at anything. No placeholder: the label
 * carries the format, and a placeholder in a palette with no mid-tone on this ground would
 * read as text somebody had already typed.
 */
export const scannerInputClass =
  'min-h-14 w-full border-2 border-chalk bg-night-raised px-4 py-4 font-numeric text-code ' +
  'uppercase text-chalk focus:border-[3px]'

/** The other one: a door's name, which is prose and keeps its capitals. */
export const scannerTextInputClass =
  'min-h-14 w-full border-2 border-chalk bg-night-raised px-4 py-4 text-body text-chalk ' +
  'focus:border-[3px]'
