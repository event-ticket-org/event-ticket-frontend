import { FINE_SNAP, SNAP } from './geometry'

/**
 * What a key means in the seat map editor, as a value rather than as a branch in a handler.
 *
 * Here so the whole vocabulary is one thing to read and one thing to test. A keyboard editor
 * lives or dies on whether the keys are coherent, and coherence is not visible when the rules
 * are scattered down a two-hundred-line component.
 */

export type EditorAction =
  /** Choose this seat, replacing the selection - or add to it, as a modifier click does. */
  | { kind: 'select'; additive: boolean }
  /** Take hold of the selection. Arrows move it until it is dropped or the move is cancelled. */
  | { kind: 'pickUp' }
  | { kind: 'drop' }
  /** Put it back exactly where it was. */
  | { kind: 'cancelMove' }
  | { kind: 'nudge'; dx: number; dy: number }
  | { kind: 'clearSelection' }

/**
 * Dragging, by keyboard, is pick up - move - drop.
 *
 * Not a modifier held down with the arrows, which is the obvious design and the wrong one:
 * `Alt+Left` is Back in a browser and `Ctrl/Cmd+Left` moves by word, so every modifier worth
 * having is already spoken for, and taking one costs somebody a navigation they rely on. Pick
 * up and drop is also what the accessible drag-and-drop implementations converged on, so it is
 * the pattern most likely to be already known.
 *
 * `m` for move: a letter, because the map is not a text field and there is nothing to type
 * into. It both picks up and drops, so the same key gets somebody out of the mode they got
 * into with it - which is the thing modes get wrong.
 */
export function editorAction(
  event: { key: string; shiftKey: boolean; metaKey: boolean; ctrlKey: boolean },
  moving: boolean,
): EditorAction | undefined {
  if (moving) {
    switch (event.key) {
      case 'Escape':
        return { kind: 'cancelMove' }
      case 'Enter':
      case ' ':
      case 'm':
      case 'M':
        return { kind: 'drop' }
      default: {
        const step = event.shiftKey ? FINE_SNAP : SNAP
        const delta = nudgeFor(event.key, step)
        return delta ? { kind: 'nudge', ...delta } : undefined
      }
    }
  }

  switch (event.key) {
    case 'm':
    case 'M':
      return { kind: 'pickUp' }
    case 'Escape':
      return { kind: 'clearSelection' }
    case 'Enter':
    case ' ':
      // Shift or the platform modifier adds to the selection, exactly as it does with a
      // pointer - one vocabulary, whichever hand is on the map.
      return { kind: 'select', additive: event.shiftKey || event.metaKey || event.ctrlKey }
    default:
      return undefined
  }
}

/**
 * Shift is the fine lattice, because `metaKey` is what the pointer uses and a browser has
 * already taken it with an arrow. Snapping is never off: exact coordinates are what makes two
 * seats stacked on each other detectable at all.
 */
function nudgeFor(key: string, step: number): { dx: number; dy: number } | undefined {
  switch (key) {
    case 'ArrowLeft':
      return { dx: -step, dy: 0 }
    case 'ArrowRight':
      return { dx: step, dy: 0 }
    case 'ArrowUp':
      return { dx: 0, dy: -step }
    case 'ArrowDown':
      return { dx: 0, dy: step }
    default:
      return undefined
  }
}
