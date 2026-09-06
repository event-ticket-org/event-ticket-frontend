import { describe, expect, it } from 'vitest'
import { editorAction } from './editor-keys'
import { FINE_SNAP, SNAP } from './geometry'

const press = (key: string, modifiers: Partial<Record<'shiftKey' | 'metaKey' | 'ctrlKey', boolean>> = {}) =>
  ({ key, shiftKey: false, metaKey: false, ctrlKey: false, ...modifiers })

describe('with nothing being moved', () => {
  it('chooses a seat, and adds to the selection under a modifier', () => {
    expect(editorAction(press('Enter'), false)).toEqual({ kind: 'select', additive: false })
    expect(editorAction(press(' '), false)).toEqual({ kind: 'select', additive: false })
    expect(editorAction(press('Enter', { shiftKey: true }), false))
      .toEqual({ kind: 'select', additive: true })
    // The same modifiers a click uses, so there is one vocabulary rather than two.
    expect(editorAction(press('Enter', { metaKey: true }), false))
      .toEqual({ kind: 'select', additive: true })
    expect(editorAction(press('Enter', { ctrlKey: true }), false))
      .toEqual({ kind: 'select', additive: true })
  })

  it('picks up with m and clears with Escape', () => {
    expect(editorAction(press('m'), false)).toEqual({ kind: 'pickUp' })
    expect(editorAction(press('M'), false)).toEqual({ kind: 'pickUp' })
    expect(editorAction(press('Escape'), false)).toEqual({ kind: 'clearSelection' })
  })

  /**
   * The arrows belong to navigation until something is picked up. A map that nudged on a bare
   * arrow would have no way left to move around itself.
   */
  it('leaves the arrows alone', () => {
    expect(editorAction(press('ArrowLeft'), false)).toBeUndefined()
    expect(editorAction(press('ArrowDown'), false)).toBeUndefined()
  })
})

describe('while moving', () => {
  it('nudges on the lattice, and finer with Shift', () => {
    expect(editorAction(press('ArrowLeft'), true)).toEqual({ kind: 'nudge', dx: -SNAP, dy: 0 })
    expect(editorAction(press('ArrowRight'), true)).toEqual({ kind: 'nudge', dx: SNAP, dy: 0 })
    expect(editorAction(press('ArrowUp'), true)).toEqual({ kind: 'nudge', dx: 0, dy: -SNAP })
    expect(editorAction(press('ArrowDown'), true)).toEqual({ kind: 'nudge', dx: 0, dy: SNAP })
    expect(editorAction(press('ArrowUp', { shiftKey: true }), true))
      .toEqual({ kind: 'nudge', dx: 0, dy: -FINE_SNAP })
  })

  /** Snapping is never off: exact coordinates are what makes two stacked seats detectable. */
  it('never nudges off a lattice', () => {
    const fine = editorAction(press('ArrowLeft', { shiftKey: true }), true)
    expect(fine).toEqual({ kind: 'nudge', dx: -FINE_SNAP, dy: 0 })
    expect(FINE_SNAP).toBeGreaterThan(0)
  })

  it('drops with the key that picked it up, and with Enter', () => {
    expect(editorAction(press('m'), true)).toEqual({ kind: 'drop' })
    expect(editorAction(press('Enter'), true)).toEqual({ kind: 'drop' })
    expect(editorAction(press(' '), true)).toEqual({ kind: 'drop' })
  })

  /** Escape means the same thing everywhere: undo the thing I am in the middle of. */
  it('puts it back on Escape', () => {
    expect(editorAction(press('Escape'), true)).toEqual({ kind: 'cancelMove' })
  })

  it('ignores everything else, so the rest of the page keeps working', () => {
    expect(editorAction(press('Tab'), true)).toBeUndefined()
    expect(editorAction(press('a'), true)).toBeUndefined()
    expect(editorAction(press('PageDown'), true)).toBeUndefined()
  })
})
