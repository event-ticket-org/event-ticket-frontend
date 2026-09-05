import { useEffect, useRef, useState } from 'react'
import type { MapElement, SeatMap, SeatMapSeat } from '~/api/types'
import { Button, Field, Problem, cx, inputClass } from '~/shared/ui'
import { panBounds, rectBetween, zoomBounds, type Rect } from './geometry'
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

const ELEMENT_KINDS: MapElement['kind'][] = ['STAGE', 'ENTRANCE', 'AISLE', 'BAR', 'LABEL']

type Drag =
  | { kind: 'marquee'; from: { x: number; y: number }; to: { x: number; y: number }; additive: boolean }
  | { kind: 'move'; from: { x: number; y: number }; last: { x: number; y: number } }
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
  const { selection, deleteSelection, dirty } = draft

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
      if (!editingText && (event.key === 'Delete' || event.key === 'Backspace') && selection.size > 0) {
        event.preventDefault()
        deleteSelection()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selection, deleteSelection])

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
          <ElementAdder onAdd={draft.addElement} />
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
            ariaLabel="Seat map editor"
            className="h-[32rem] w-full"
            onSeatPointerDown={(seat, index, event) => {
              // Capture so a drag that leaves the map still moves the selection. Guarded
              // because it throws for a pointer the browser does not consider active, and
              // losing selection entirely over a nice-to-have is a bad trade.
              try {
                event.currentTarget.setPointerCapture(event.pointerId)
              } catch {
                // Dragging still works; it just stops at the edge.
              }
              const additive = event.shiftKey || event.metaKey || event.ctrlKey
              if (additive || !draft.selection.has(index)) {
                draft.toggle(index, additive)
              }
              setDrag({ kind: 'move', from: { x: seat.x, y: seat.y }, last: { x: seat.x, y: seat.y } })
            }}
            onBackgroundPointerDown={(point, event) => {
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
            Click a seat, or drag a box around several. Alt-drag pans, the wheel zooms.
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
              <li key={`${element.kind}-${index}`} className="flex items-center justify-between gap-3">
                <span className="text-body">{element.label ?? element.kind}</span>
                <Button
                  variant="ghost"
                  className="w-auto px-0 text-label uppercase"
                  onClick={() => draft.removeElement(index)}
                >
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  )
}

function ElementAdder({ onAdd }: { onAdd: (element: MapElement) => void }) {
  return (
    <select
      aria-label="Add a landmark"
      value=""
      className="min-h-11 border-2 border-ink bg-paper px-3 py-2 text-body text-ink"
      onChange={(change) => {
        const kind = change.target.value as MapElement['kind']
        if (kind) {
          onAdd({ kind, x: 0, y: -3, width: kind === 'STAGE' ? 8 : 3, height: 1.5 })
          change.target.value = ''
        }
      }}
    >
      <option value="">Add a landmark…</option>
      {ELEMENT_KINDS.map((kind) => (
        <option key={kind} value={kind}>
          {kind.charAt(0) + kind.slice(1).toLowerCase()}
        </option>
      ))}
    </select>
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

/** New blocks land below what is already there rather than on top of it. */
function suggestNextY(map: SeatMap): number {
  if (map.seats.length === 0) {
    return 0
  }
  return Math.round((Math.max(...map.seats.map((seat) => seat.y)) + 2) * 10) / 10
}
