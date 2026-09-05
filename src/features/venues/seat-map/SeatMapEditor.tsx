import { useEffect, useRef, useState } from 'react'
import type { MapElement, SeatMap, SeatMapSeat } from '~/api/types'
import { Button, Field, Problem, cx, inputClass } from '~/shared/ui'
import { elementSize, panBounds, rectBetween, zoomBounds, type Rect } from './geometry'
import { SeatMapView } from './SeatMapView'
import { describeProblem } from './validation'
import { useSeatMapDraft } from './useSeatMapDraft'
import type { BlockSpec } from './generator'

const TIER_FILLS = [
  'fill-tier-1',
  'fill-tier-2',
  'fill-tier-3',
  'fill-tier-4',
  'fill-tier-5',
  'fill-tier-6',
]

type Drag =
  | { kind: 'marquee'; from: { x: number; y: number }; to: { x: number; y: number }; additive: boolean }
  | { kind: 'move'; from: { x: number; y: number }; last: { x: number; y: number } }
  | { kind: 'move-element'; index: number; last: { x: number; y: number } }
  | { kind: 'pan'; last: { x: number; y: number } }

export function SeatMapEditor({
  saved,
  onSave,
  saving,
  saveError,
  frozenNote,
}: {
  saved: SeatMap | undefined
  /** Resolves when the server has it. The draft is only dropped once it does. */
  onSave: (map: SeatMap) => Promise<unknown>
  saving: boolean
  saveError: unknown
  frozenNote?: React.ReactNode
}) {
  const draft = useSeatMapDraft(saved)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [generating, setGenerating] = useState(false)
  const { selection, deleteSelection, dirty, elementSelection, removeElement } = draft

  // The map is saved as one document and nothing is written until Save, so leaving with a
  // draft in hand loses every edit. The browser's own prompt is the only one that fires on a
  // closed tab, which is the case that actually costs somebody an afternoon.
  useEffect(() => {
    if (!dirty) {
      return
    }
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const editingText = event.target instanceof HTMLInputElement
      if (editingText || (event.key !== 'Delete' && event.key !== 'Backspace')) {
        return
      }
      if (selection.size > 0) {
        event.preventDefault()
        deleteSelection()
      } else if (elementSelection !== null) {
        event.preventDefault()
        removeElement(elementSelection)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selection, deleteSelection, elementSelection, removeElement])

  const tierFill = (seat: SeatMapSeat) => {
    const index = draft.tiers.indexOf(seat.tierName)
    return TIER_FILLS[index % TIER_FILLS.length] ?? 'fill-paper-sunk'
  }

  const seatClass = (seat: SeatMapSeat, index: number) =>
    cx(
      'stroke-ink cursor-pointer',
      draft.selection.has(index) ? 'fill-info stroke-[0.16]' : tierFill(seat),
    )

  const marquee: Rect | null =
    drag?.kind === 'marquee' ? rectBetween(drag.from, drag.to) : null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <Button className="w-auto" onClick={() => setGenerating(true)}>
            Add rows
          </Button>
          {/* A button, because this performs an action. It was a <select> that fired on
              change and reset its own value - a combobox whose current value is always the
              placeholder, announced as a field that holds state when it holds none. The kind
              is chosen afterwards in the side panel, where a select is choosing a value and
              is the right control. */}
          <Button
            variant="secondary"
            className="w-auto"
            onClick={() => draft.addElement(newLandmark(draft.map))}
          >
            Add landmark
          </Button>
          <span className="font-numeric text-numeric text-ink-soft">
            {draft.map.seats.length} seats
          </span>
        </div>
        <div className="flex items-center gap-3">
          {dirty && (
            <Button variant="ghost" className="w-auto" onClick={draft.discard}>
              Discard changes
            </Button>
          )}
          <Button
            className="w-auto"
            disabled={!dirty || draft.problems.length > 0}
            pending={saving}
            onClick={() => {
              // Only after the server has taken it: dropping the draft on click would show
              // the old map under a Save button that had gone quiet, and lose the edits.
              void onSave(draft.map).then(
                () => draft.settle(),
                () => undefined,
              )
            }}
          >
            Save seat map
          </Button>
        </div>
      </div>

      {frozenNote}

      <Problem error={saveError} />

      {draft.problems.length > 0 && (
        <ul role="alert" className="space-y-2 border-[3px] border-stop bg-paper px-4 py-3">
          {/* Checked as you edit rather than on save: the server rejects the whole document
              over one bad seat, so finding out at the end would throw away the bulk edit. */}
          {draft.problems.map((problem, index) => (
            <li key={index} className="text-body text-ink">
              {describeProblem(problem)}
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1 border-2 border-ink bg-paper">
          <SeatMapView
            map={draft.map}
            bounds={draft.bounds}
            seatClass={seatClass}
            labelledSeats={draft.map.seats.length <= 200}
            marquee={marquee}
            selectedElement={draft.elementSelection}
            ariaLabel="Seat map editor"
            className="h-[32rem] w-full"
            onSeatPointerDown={(seat, index, event) => {
              capture(event)
              const additive = event.shiftKey || event.metaKey || event.ctrlKey
              if (additive || !draft.selection.has(index)) {
                draft.toggle(index, additive)
              }
              setDrag({ kind: 'move', from: { x: seat.x, y: seat.y }, last: { x: seat.x, y: seat.y } })
            }}
            onElementPointerDown={(_element, index, point, event) => {
              capture(event)
              draft.selectElement(index)
              setDrag({ kind: 'move-element', index, last: point })
            }}
            onBackgroundPointerDown={(point, event) => {
              draft.selectElement(null)
              if (event.button === 1 || event.altKey) {
                setDrag({ kind: 'pan', last: point })
                return
              }
              setDrag({
                kind: 'marquee',
                from: point,
                to: point,
                additive: event.shiftKey || event.metaKey || event.ctrlKey,
              })
            }}
            onPointerMove={(point) => {
              if (!drag) {
                return
              }
              if (drag.kind === 'marquee') {
                setDrag({ ...drag, to: point })
              } else if (drag.kind === 'move') {
                draft.moveSelection(point.x - drag.last.x, point.y - drag.last.y)
                setDrag({ ...drag, last: point })
              } else if (drag.kind === 'move-element') {
                draft.moveElement(drag.index, point.x - drag.last.x, point.y - drag.last.y)
                setDrag({ ...drag, last: point })
              } else {
                draft.setView(
                  panBounds(draft.bounds, drag.last.x - point.x, drag.last.y - point.y),
                )
              }
            }}
            onPointerUp={() => {
              if (drag?.kind === 'marquee') {
                draft.selectWithin(rectBetween(drag.from, drag.to), drag.additive)
              }
              setDrag(null)
            }}
            onWheel={(point, event) => {
              // Zooming about the cursor, so whatever you are looking at stays put.
              draft.setView(zoomBounds(draft.bounds, event.deltaY > 0 ? 1.1 : 0.9, point))
            }}
          />
        </div>

        <SidePanel draft={draft} tierFill={tierFill} />
      </div>

      {generating && (
        <GenerateRows
          defaultTier={draft.tiers[0] ?? 'Standard'}
          suggestedOriginY={suggestNextY(draft.map)}
          onCancel={() => setGenerating(false)}
          onGenerate={(spec) => {
            draft.addSeats(spec)
            draft.setView(null)
            setGenerating(false)
          }}
        />
      )}
    </div>
  )
}

function SidePanel({
  draft,
  tierFill,
}: {
  draft: ReturnType<typeof useSeatMapDraft>
  tierFill: (seat: SeatMapSeat) => string
}) {
  const [tierName, setTierName] = useState('')
  const selected = draft.map.seats
    .map((seat, index) => ({ seat, index }))
    .filter(({ index }) => draft.selection.has(index))
  const only = selected.length === 1 ? selected[0] : undefined
  const selectedElement =
    draft.elementSelection !== null && draft.map.elements[draft.elementSelection]
      ? { index: draft.elementSelection, element: draft.map.elements[draft.elementSelection]! }
      : undefined

  return (
    <aside className="w-full shrink-0 space-y-6 border-2 border-ink bg-paper p-4 lg:w-80">
      <section>
        <h3 className="text-label uppercase">Pricing tiers</h3>
        {draft.tiers.length === 0 ? (
          <p className="mt-2 text-body text-ink-soft">
            None yet. Tier names are set here and priced on each event.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {draft.tiers.map((tier) => (
              <li key={tier} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-body">
                  <svg viewBox="0 0 1 1" className="size-4 shrink-0" aria-hidden>
                    <circle
                      cx={0.5}
                      cy={0.5}
                      r={0.42}
                      strokeWidth={0.1}
                      className={cx('stroke-ink', tierFill({ tierName: tier } as SeatMapSeat))}
                    />
                  </svg>
                  {tier}
                </span>
                <span className="font-numeric text-numeric text-ink-soft">
                  {draft.map.seats.filter((seat) => seat.tierName === tier).length}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-label uppercase">
          Selection{selected.length > 0 && ` · ${selected.length}`}
        </h3>
        {selected.length === 0 ? (
          <p className="mt-2 text-body text-ink-soft">
            {selectedElement
              ? 'A landmark is selected. Drag it on the map to place it.'
              : 'Click a seat, or drag a box around several. Alt-drag pans, the wheel zooms.'}
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {only && (
              <Field label="Label">
                <input
                  className={inputClass}
                  value={only.seat.label}
                  maxLength={20}
                  onChange={(change) => draft.relabelSeat(only.index, change.target.value)}
                />
              </Field>
            )}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field label="Set tier">
                  <input
                    className={inputClass}
                    list="known-tiers"
                    value={tierName}
                    maxLength={50}
                    placeholder="VIP"
                    onChange={(change) => setTierName(change.target.value)}
                  />
                </Field>
              </div>
              <Button
                variant="secondary"
                className="w-auto"
                disabled={tierName.trim().length === 0}
                onClick={() => {
                  draft.retierSelection(tierName.trim())
                  setTierName('')
                }}
              >
                Apply
              </Button>
            </div>
            <datalist id="known-tiers">
              {draft.tiers.map((tier) => (
                <option key={tier} value={tier} />
              ))}
            </datalist>
            <Button variant="ghost" className="w-auto px-0" onClick={draft.deleteSelection}>
              Delete {selected.length} {selected.length === 1 ? 'seat' : 'seats'}
            </Button>
          </div>
        )}
      </section>

      {draft.map.elements.length > 0 && (
        <section>
          <h3 className="text-label uppercase">Landmarks</h3>
          <ul className="mt-3 space-y-2">
            {draft.map.elements.map((element, index) => (
              <li key={index}>
                <button
                  onClick={() => draft.selectElement(index)}
                  aria-pressed={draft.elementSelection === index}
                  className={cx(
                    'flex w-full items-center justify-between gap-3 border-2 border-ink px-3 py-2 text-left text-body',
                    draft.elementSelection === index ? 'bg-info text-ink' : 'bg-paper text-ink',
                  )}
                >
                  <span>{element.label ?? element.kind}</span>
                  <span className="text-label uppercase text-ink-soft">{element.kind}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {selectedElement && (
        <LandmarkPanel
          element={selectedElement.element}
          onChange={(patch) => draft.updateElement(selectedElement.index, patch)}
          onRemove={() => draft.removeElement(selectedElement.index)}
        />
      )}
    </aside>
  )
}

/**
 * The feature the editor is built around. Everything else it does is editing what this made.
 */
function GenerateRows({
  defaultTier,
  suggestedOriginY,
  onGenerate,
  onCancel,
}: {
  defaultTier: string
  suggestedOriginY: number
  onGenerate: (spec: BlockSpec) => void
  onCancel: () => void
}) {
  const [spec, setSpec] = useState<BlockSpec>({
    rows: 10,
    seatsPerRow: 20,
    firstRowLabel: 'A',
    firstSeatNumber: 1,
    originX: 0,
    originY: suggestedOriginY,
    seatGap: 1,
    rowGap: 1.2,
    tierName: defaultTier,
  })
  const dialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    dialog.current?.querySelector('input')?.focus()
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const number = (key: keyof BlockSpec) => (change: React.ChangeEvent<HTMLInputElement>) =>
    setSpec((current) => ({ ...current, [key]: Number(change.target.value) }))

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-ink/40 p-4">
      <div
        ref={dialog}
        role="dialog"
        aria-label="Add rows of seats"
        className="max-h-full w-full max-w-[480px] overflow-y-auto border-[3px] border-ink bg-paper p-8 shadow-lifted"
      >
        <h2 className="text-heading">Add rows</h2>
        <p className="mt-2 text-body text-ink-soft">
          {spec.rows * spec.seatsPerRow} seats, labelled {spec.firstRowLabel}
          {spec.firstSeatNumber} onward.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-4">
          <Field label="Rows">
            <input className={inputClass} type="number" min={1} max={200} value={spec.rows} onChange={number('rows')} />
          </Field>
          <Field label="Seats per row">
            <input className={inputClass} type="number" min={1} max={200} value={spec.seatsPerRow} onChange={number('seatsPerRow')} />
          </Field>
          <Field label="First row">
            <input
              className={inputClass}
              value={spec.firstRowLabel}
              onChange={(change) =>
                setSpec((current) => ({
                  ...current,
                  firstRowLabel: change.target.value.toUpperCase().replace(/[^A-Z]/g, ''),
                }))
              }
            />
          </Field>
          <Field label="First seat number">
            <input className={inputClass} type="number" min={0} value={spec.firstSeatNumber} onChange={number('firstSeatNumber')} />
          </Field>
          <Field label="Tier">
            <input
              className={inputClass}
              value={spec.tierName}
              maxLength={50}
              onChange={(change) => setSpec((current) => ({ ...current, tierName: change.target.value }))}
            />
          </Field>
          <Field label="Row spacing">
            <input className={inputClass} type="number" step={0.1} min={0.1} value={spec.rowGap} onChange={number('rowGap')} />
          </Field>
        </div>

        <label className="mt-4 flex items-center gap-3 text-body">
          <input
            type="checkbox"
            className="size-5 border-2 border-ink"
            checked={spec.reverseSeatNumbers ?? false}
            onChange={(change) =>
              setSpec((current) => ({ ...current, reverseSeatNumbers: change.target.checked }))
            }
          />
          Number each row from the right
        </label>

        <div className="mt-8 flex justify-end gap-3">
          <Button variant="ghost" className="w-auto" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="w-auto"
            disabled={spec.rows < 1 || spec.seatsPerRow < 1 || spec.firstRowLabel.length === 0}
            onClick={() => onGenerate(spec)}
          >
            Add {spec.rows * spec.seatsPerRow} seats
          </Button>
        </div>
      </div>
    </div>
  )
}

const ELEMENT_KINDS: MapElement['kind'][] = ['STAGE', 'ENTRANCE', 'AISLE', 'BAR', 'LABEL']

/**
 * A selected landmark, edited in place.
 *
 * The kind is a `<select>` here and that is the right control - it chooses a value and holds
 * it, which is exactly what a select is for. The one in the toolbar that *performed* an
 * action was not.
 */
function LandmarkPanel({
  element,
  onChange,
  onRemove,
}: {
  element: MapElement
  onChange: (patch: Partial<MapElement>) => void
  onRemove: () => void
}) {
  const { width, height } = elementSize(element)
  return (
    <section className="space-y-4 border-t-2 border-ink pt-4">
      <h3 className="text-label uppercase">Landmark</h3>
      <Field label="Kind">
        <select
          className={inputClass}
          value={element.kind}
          onChange={(change) => onChange({ kind: change.target.value as MapElement['kind'] })}
        >
          {ELEMENT_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind.charAt(0) + kind.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Label">
        <input
          className={inputClass}
          value={element.label ?? ''}
          maxLength={50}
          onChange={(change) => onChange({ label: change.target.value })}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Width">
          <input
            className={inputClass}
            type="number"
            step={0.5}
            min={0.5}
            value={width}
            onChange={(change) => onChange({ width: Number(change.target.value) })}
          />
        </Field>
        <Field label="Height">
          <input
            className={inputClass}
            type="number"
            step={0.5}
            min={0.5}
            value={height}
            onChange={(change) => onChange({ height: Number(change.target.value) })}
          />
        </Field>
      </div>
      <Button variant="ghost" className="w-auto px-0" onClick={onRemove}>
        Remove landmark
      </Button>
    </section>
  )
}

/**
 * Capture so a drag that leaves the map still moves what is being dragged. Guarded because it
 * throws for a pointer the browser does not consider active, and losing the interaction
 * entirely over a nice-to-have is a bad trade.
 */
function capture(event: React.PointerEvent) {
  try {
    event.currentTarget.setPointerCapture(event.pointerId)
  } catch {
    // Dragging still works; it just stops at the edge of the map.
  }
}

/** A landmark starts where there is room for it: above the seats, centred on them. */
function newLandmark(map: SeatMap): MapElement {
  const xs = map.seats.map((seat) => seat.x)
  const ys = map.seats.map((seat) => seat.y)
  const width = 8
  const centre = xs.length > 0 ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0
  const above = ys.length > 0 ? Math.min(...ys) - 3 : 0
  return {
    kind: 'STAGE',
    label: 'Stage',
    x: Math.round((centre - width / 2) * 10) / 10,
    y: Math.round(above * 10) / 10,
    width,
    height: 1.5,
  }
}

/** New blocks land below what is already there rather than on top of it. */
function suggestNextY(map: SeatMap): number {
  if (map.seats.length === 0) {
    return 0
  }
  return Math.round((Math.max(...map.seats.map((seat) => seat.y)) + 2) * 10) / 10
}
