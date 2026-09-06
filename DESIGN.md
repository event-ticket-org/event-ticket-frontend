# DESIGN.md — Event Ticket

The single source of truth for how this product looks and behaves. Where this document and a
component disagree, the document is right and the component is a bug.

It is deliberately plain markdown so that a person and a coding agent read the same thing. Tokens
are referenced as `{colors.ink}`, `{type.numeric-lg}`, `{space.4}` throughout; the values live once,
in [Color Palette & Roles](#color-palette--roles), [Typography Rules](#typography-rules) and
[Layout Principles](#layout-principles).

**Scope.** This governs the UI. The domain — what an Order is, when a Ticket may be scanned, what a
Seat Hold guarantees — is governed by [event-ticket-kb](https://github.com/event-ticket-org/event-ticket-kb)
and is not restated here. Where a KB rule forces a visual decision, this document cites it.

---

## Visual Theme & Atmosphere

**Neo-brutalism.** Hard black borders, solid offset shadows with no blur, flat saturated fills,
zero corner radius, heavy type. Structure is visible rather than implied: an object that can be
pressed looks like an object, and pressing it moves it.

This is not a style choice made for novelty. Three things about this product make it the correct
one, and each is measurable:

**It survives bad conditions.** `nfr.md` puts up to four scanning devices at a door for a
45-minute arrival window, and requirements/007 puts the operator outdoors, at night, one-handed.
A 2px solid border at full contrast is legible under glare and at minimum screen brightness. A
`shadow-lg` blur is not — it is the first thing to disappear, and the soft-UI convention of
distinguishing surfaces *only* by blurred elevation fails completely in that setting.

**It gives the seat map five distinguishable states.** A seat is available, selected, held by
somebody else, sold, or not for sale. Soft design has one lever for that — hue — which excludes
colour-blind users and dies at the 8-pixel seat size a 2,000-seat map forces. Flat fills with hard
borders give three independent levers: fill, border weight, and pattern.

**It is honest about money and time.** A buyer is spending real money against a Seat Hold that
expires. Nothing in that flow should be soft, ambient or subtle. The total is the largest object on
the page and the countdown is impossible to miss, because the alternative is a support request.

### The three audiences

One application, three shells (requirements/007), used by people whose needs actively conflict.
Every component below declares which shells it belongs to.

| | **Organizer** (manager shell) | **Client** (public shell) | **Operator** (scanner shell) |
|---|---|---|---|
| Where | Desk, large screen, mouse, keyboard | Phone, one hand, distracted, in public | At a gate, at night, one hand, queue waiting |
| Session | Long, repeated, expert | Once, novice, under time pressure | Hundreds of repetitions, 45-minute burst |
| Needs | Density, precision, reversibility | Clarity, trust, one decision at a time | A verdict in under a second |
| Worst failure | Cancelling an Event by accident | Not noticing the hold expired | Reading REFUSE as ADMIT |
| Ground | `{colors.paper}` | `{colors.paper}` | `{colors.night}` |
| Density | Tight; borders separate, not whitespace | Airy; one decision per screen | One object per screen |

**The scanner is a different room, not a dark theme.** It inverts the ground and spends its entire
colour budget on a single verdict. Its palette is the same palette; nothing else about it is shared.

### Voice

Product copy states what happened and what to do next. It does not sell, apologise or exclaim.

- Write "These seats were taken while you were choosing: A1." Not "Oops! Something went wrong 😔"
- Write "Cancel this event". Not "Manage event lifecycle settings".
- Write "Doors open 19:00, Hanoi time". Not "Get ready for an unforgettable night!"

Backend error messages are written to be read by the person who hit them and are shown verbatim
(`~/shared/ui.tsx`). Never replace one with prose of our own; the two will drift and ours will be
worse.

---

## Color Palette & Roles

Twelve values. Grouped by role, never by hue. Adding a thirteenth is a design decision, not a
convenience — the discipline is most of what separates this from a template.

### Surface

```
paper         #FDFBF4   Default ground, light shells. Warm off-white, never pure #FFF.
paper-sunk    #EFE9DA   Inset ground: table zebra, code and Ticket Code blocks, disabled fills.
night         #0B0A09   Scanner ground.
night-raised  #1F1B18   Cards and controls on the scanner ground.
```

Pure white is the browser's default, and reads as unfinished. `{colors.paper}` is warm enough to
sit under saturated fills without them looking like they are floating.

### Ink

```
ink           #14110F   All body text on light. Every border. Primary action fill.
ink-soft      #55504A   Secondary text on {colors.paper} only.
chalk         #FDFBF4   All text on {colors.ink}, {colors.night} and {colors.night-raised}.
```

`{colors.ink}` does triple duty deliberately. In this system the primary button is not coloured —
it is black with a hard shadow. That keeps the four state colours meaning exactly one thing each
and never decorating chrome.

### State

Each of these means one thing across all three shells. A colour that means "brand" or "primary"
does not exist here.

```
go     #00C46A   Admitted · Paid · Seat available · Published
stop   #FF3B2F   Refused · Failed · Destructive action · Sold out · Cancelled
hold   #FFC400   Pending · Awaiting payment · Seat held · Countdown warning · Draft
info   #5CC8FF   Selection and focus — what you are currently pointing at
```

### The two contrast rules

These replace per-component contrast review, and every combination they permit has been measured.

1. **Text on any state fill is `{colors.ink}`.** Never white, never a tint.
2. **Text on `{colors.ink}`, `{colors.night}` or `{colors.night-raised}` is `{colors.chalk}`.**

No other text/background pair exists in this system.

| Pair | Ratio | |
|---|---|---|
| `ink` on `paper` | 18.2:1 | AAA |
| `ink-soft` on `paper` | 7.7:1 | AAA |
| `chalk` on `ink` | 18.2:1 | AAA |
| `chalk` on `night` | 19.1:1 | AAA |
| `chalk` on `night-raised` | 16.5:1 | AAA |
| `ink` on `hold` | 11.8:1 | AAA |
| `ink` on `info` | 10.0:1 | AAA |
| `ink` on `go` | 8.2:1 | AAA |
| `ink` on `paper-sunk` | 15.5:1 | AAA |
| `go` on `night` | 8.6:1 | AAA |
| `info` on `night` | 10.5:1 | AAA |
| `ink` on `stop` | 5.3:1 | AA; AAA at large sizes only |

**The one exception, stated rather than hidden:** `{colors.stop}` reaches 5.3:1 with ink, which is
AA but not AAA for body text. It is kept at full saturation because its two jobs — a destructive
button and the scanner's REFUSE field — are both large or bold type, where 5.3:1 clears AAA. A
desaturated red that reached 7:1 would be a salmon, and a salmon does not read as *stop* at a gate.
**Never set body prose on `{colors.stop}`.** Use `{colors.paper}` with a `{colors.stop}` border.

**`{colors.ink-soft}` is only ever used on `{colors.paper}`.** On `{colors.paper-sunk}` it drops to
6.6:1; use `{colors.ink}` there. Enforced by an eslint rule, because this document itself broke
the rule once — the Button's disabled state specified exactly that pair, and the component
implemented it faithfully.

The rule reads class strings, so it catches the pair only on one element. In SVG a fill and the
shape behind it are two different elements — the seat map's landmark caption was `fill-ink-soft`
on a `fill-paper-sunk` rect, and on `{colors.info}` when selected, at 4.2:1 — and nothing
automatic will find the next one. Judgement still applies where the two colours are not written
side by side.

### Pricing Tier colours, which are categorical rather than semantic

```
tier-1  #6B4FD8    tier-3  #1F7A6B    tier-5  #7A7A1F
tier-2  #C2571F    tier-4  #A83A72    tier-6  #3C4E8C
```

The four state colours answer *what is true of this seat right now* — available, held, sold. A
Pricing Tier is not a state: it is a category with no ordering, no meaning attached to any
particular member, and no fixed number of them. Painting VIP with `{colors.go}` and Restricted
View with `{colors.stop}` would say something about those tiers that is not true.

So tiers get their own scale, and it is deliberately muted where the state scale is vivid — the
two are never shown together, but a tier should not look like a verdict. **These are used only
inside the seat map and its legend**, and the legend always names the tier, so colour is an aid
rather than the only signal. Beyond six tiers the scale repeats; see [Known Gaps](#known-gaps).

### Colour is never the only signal

Required by requirements/007 at a door and by ordinary accessibility everywhere else. Every state
carries a second, non-colour signal: a word, a shape, a border weight, or a pattern. The seat map
and the scan verdict specify theirs explicitly below.

---

## Typography Rules

Two faces. Weight carries the hierarchy, not size — the mid-weights (500, 600) that make interfaces
look generically competent are excluded from the scale on purpose.

```
text     'Be Vietnam Pro', system-ui, -apple-system, 'Segoe UI', sans-serif
numeric  'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace
weights  400 (body) · 700 (emphasis) · 800 (titles) · 900 (display)
```

**Why Be Vietnam Pro.** Any face used for prose here must carry a full Vietnamese diacritic set,
and most grotesques do not — they render `ư`, `ơ` and stacked tone marks from a fallback face, at a
different weight and width. That is invisible to a developer typing English and obvious to every
user. Be Vietnam Pro was drawn for it and has the 900 weight this style needs.

**The test:** render `Nhà hát Lớn Hà Nội — Ưu đãi đặc biệt` and confirm no glyph shifts weight or
baseline. Do this whenever a face is added.

### The numeric rule

**Any number a person compares or watches change is set in `{type.numeric}` with
`font-variant-numeric: tabular-nums`.** Money, countdowns, seat labels, scan counts, times, Ticket
Codes, order references.

This is functional, not stylistic. In a proportional face the glyphs have different widths, so a
countdown reflows on every tick — the digits visibly jitter, and a timer that jitters reads as
untrustworthy at exactly the moment a buyer needs to trust it. In a table, proportional figures
stop columns of dong from aligning, which is the only reason to put them in a column.

### Scale

| Token | Size / Line | Weight | Tracking | Use |
|---|---|---|---|---|
| `type.display` | 44 / 44 | 900 | -0.02em | Page identity, empty-state headline |
| `type.title` | 30 / 32 | 800 | -0.01em | Page titles |
| `type.heading` | 20 / 24 | 700 | 0 | Section and card headings |
| `type.body` | 16 / 24 | 400 | 0 | Prose. The default. |
| `type.body-strong` | 16 / 24 | 700 | 0 | Emphasis within prose |
| `type.label` | 13 / 16 | 700 | 0.06em, uppercase | Field labels, table headers, status chips |
| `type.numeric` | 16 / 20 | 500 mono | 0 | Money, times, counts, seat labels |
| `type.numeric-lg` | 34 / 36 | 700 mono | -0.01em | Order total, hold countdown |
| `type.code` | 15 / 22 | 500 mono | 0.02em | Ticket Codes, order references |
| `type.verdict` | 72 / 68 | 900 | -0.03em | The scanner's one word |

**16px is the floor for anything a person reads.** No 14px prose, and no 14px inputs — iOS zooms
the viewport on focus below 16px, which on a checkout form throws the buyer's layout away mid-task.
`{type.label}` at 13px is permitted only for uppercase labels of two or three words.

Line length is capped at 68 characters for prose.

---

## Layout Principles

### Spacing

A 4px base. Only these steps exist.

```
space.1   4px     Inside a chip, icon-to-label
space.2   8px     Between tightly related controls
space.3   12px    Input padding
space.4   16px    Default gap between related things
space.6   24px    Between groups within a section
space.8   32px    Between sections
space.12  48px    Between major page regions
space.16  64px    Page top padding, manager shell
```

### Borders do the separating

This is the layout consequence of the style, and it is what lets three very different densities
share one system. In soft design, whitespace is the only separator, so density becomes soup. Here
every region has a real edge, so the organizer's tables can be tight without becoming unreadable
while the buyer's flow stays airy.

The corollary: **do not add whitespace to separate things that already have a border between them.**
A bordered card inside a bordered panel with 32px between them is padding, not design.

### Widths

```
manager   max 1152px   Dense. Tables, side-by-side forms, the seat map editor.
public    max 640px    Single column. One decision per screen.
scanner   full bleed   No max width, no page padding, no centred container.
```

### Grid

12 columns at `md` and above for the manager shell only. The public shell is one column at every
size — a buyer flow that becomes two columns on a laptop has invented a second layout to test for
no gain. The scanner is never a grid.

### Page anatomy

Manager pages are: title row (title + primary action, right-aligned), then filters, then content.
The primary action is in the same place on every page. Public pages are: content, then the single
action, at the bottom, full width, where a thumb is.

---

## Depth & Elevation

**No blur, ever.** Every shadow in this system is a solid offset with a zero blur radius, in
`{colors.ink}`. A blurred shadow anywhere is a bug.

```
elevation.flat     none                        Inputs at rest, table rows, page background
elevation.raised   4px 4px 0 {colors.ink}      Cards, buttons, chips, popovers
elevation.lifted   8px 8px 0 {colors.ink}      Modals, the scan verdict
```

**An ink-filled element casts its shadow as an outline, not as a solid.** Ink on ink is
invisible: a black button dropping a black shadow onto paper reads as a black button four
pixels larger, and the depth this whole system is built on disappears from the control people
press most. `elevation.raised-ghost` layers a paper fill over an ink spread so the shadow
appears as a 2px outlined offset instead.

```
elevation.raised-ghost   4px 4px 0 {colors.paper}, 4px 4px 0 2px {colors.ink}
elevation.hover-ghost    6px 6px 0 {colors.paper}, 6px 6px 0 2px {colors.ink}
```

**On the scanner ground, elevation is drawn in `{colors.chalk}`.** It is the same problem as
`raised-ghost` with the grounds swapped: an ink shadow on `{colors.night}` is ink on ink, so a
control on the scanner ground would have no depth at all — and depth is the affordance that says
a thing can be pressed.

```
elevation.raised-chalk   4px 4px 0 {colors.chalk}
elevation.hover-chalk    6px 6px 0 {colors.chalk}
```

These two are the only places in the system where a token exists because of how something
renders rather than because of what it means. The first was found by looking at the built page,
not by reading the CSS — the computed style was exactly what this document asked for.

**Borders are the primary elevation system; shadow is secondary.**

```
border.hairline  1px solid {colors.ink}   Table row dividers only
border.default   2px solid {colors.ink}   Everything interactive or containing
border.heavy     3px solid {colors.ink}   Modals, the scan verdict, focused inputs
```

**An element with a shadow must have a border.** A shadow with no border is a soft-UI artefact and
looks like a mistake in this system, because it is one.

**In the scanner shell every border is `{colors.chalk}` at the same widths.** The rule is that a
border separates a thing from its ground; on `{colors.night}` an ink border separates nothing.
The two verdict fields are the exception — they are `{colors.go}` and `{colors.stop}`, so their
frame is ink, as everywhere else.

### Press

The one piece of motion that matters. On `:active`, an element translates by its own shadow offset
and loses the shadow — the object physically meets the page.

```
transform: translate(4px, 4px);
box-shadow: none;
transition: transform 60ms linear, box-shadow 60ms linear;
```

60ms, linear. Not eased, not bouncy. The press should feel mechanical, because that is the entire
point of depicting a physical object.

### Focus

```
outline: 3px solid {colors.info};
outline-offset: 3px;
```

Never `outline: none`. The offset is what makes it visible against a 2px ink border — a ring drawn
on top of the border is a ring you cannot see. `{colors.info}` reaches 10:1 on `{colors.paper}` and
10.5:1 on `{colors.night}`, so one focus treatment works in all three shells.

---

## Shapes

**Radius is 0.** Buttons, inputs, cards, modals, chips, images, avatars.

The exceptions are functional depictions, not UI decoration, and there are three:

- **A seat glyph is a circle.** It depicts a seat.
- **A map element is a rectangle** with the proportions given by the contract (`width`, `height`).
  It depicts a stage, a bar, an aisle.
- **A QR code keeps its quiet zone** and is never cropped, masked or given a border. Scanners fail
  on decorated QR codes, and this one is the difference between a person getting in and not.

The rule to carry: **a rounded corner in this system means "this is a physical object being
depicted", never "this is a user interface element".**

---

## Component Stylings

Every component lists the shells it appears in and its full state set. States that are missing here
are missing from the design, not left to the implementer.

### Button — all shells

| Variant | Fill | Text | Border | Shadow |
|---|---|---|---|---|
| primary | `{colors.ink}` | `{colors.chalk}` | `{border.default}` | `{elevation.raised-ghost}` |
| secondary | `{colors.paper}` | `{colors.ink}` | `{border.default}` | `{elevation.raised}` |
| destructive | `{colors.stop}` | `{colors.ink}` | `{border.default}` | `{elevation.raised}` |
| ghost | none | `{colors.ink}`, underlined | none | none |

States: **rest** as above · **hover** shadow to `6px 6px 0` · **active** the press above ·
**disabled** `{colors.paper-sunk}` fill, `{colors.ink}` text, `{border.default}`, **no shadow**,
`cursor: not-allowed` · **pending** label replaced with `Working…`, control disabled, no spinner.

**Elevation is the affordance: raised means actionable, flat means not.** That is the whole
signal for a disabled control, and it is why disabled keeps full-contrast ink text and its ink
border rather than fading out. An earlier version of this document specified `{colors.ink-soft}`
on `{colors.paper-sunk}` here, contradicting its own rule three sections above — 6.6:1, and the
one combination the palette forbids. Greying text out is the reflex; in this system removing the
shadow already says it, and says it to somebody who cannot resolve a low-contrast grey at all.

**No spinners on buttons.** A spinner is an animation that says nothing; the changed label says the
same thing in the same space and survives `prefers-reduced-motion`.

Padding `{space.3}` / `{space.6}`. Minimum height 44px, and see [Responsive Behavior](#responsive-behavior)
for the scanner's 56px.

**In the scanner shell the palette inverts and the geometry does not.** One variant, because at a
gate there is never more than one thing to press:

```
scanner   {colors.night-raised} fill · {colors.chalk} text · 2px {colors.chalk} border
          {elevation.raised-chalk} · 56px minimum height · full width
disabled  no shadow, everything else unchanged — elevation is still the whole signal
```

### Field and Input — manager, public

Label above the input, `{type.label}`, never a placeholder standing in for a label — a placeholder
disappears exactly when the user needs it. Placeholders are for format examples only
(`A1`, `19:00`).

```
rest      2px solid {colors.ink}, {colors.paper} fill, {space.3} padding, {type.body}
focus     {border.heavy} + the focus ring above
invalid   {border.heavy} in {colors.stop}, message below in {colors.ink} at {type.body}
disabled  {colors.paper-sunk} fill, {colors.ink} text
```

Validation messages sit below the field and are never a tooltip, a title attribute, or a colour
change alone.

The scanner has exactly one input — the typed Ticket Code, for when a camera will not read a
cracked screen — and it inverts the same way the button does: `{colors.night-raised}` fill,
`{colors.chalk}` text, 2px `{colors.chalk}` border, 56px minimum height, `{type.code}`.

### Table — manager only

`{type.label}` headers with a `{border.default}` bottom rule. Rows separated by `{border.hairline}`.
Zebra with `{colors.paper-sunk}` on even rows. All numeric columns `{type.numeric}`, right-aligned.
Row hover fills `{colors.info}` at 20% — the only place in the system a colour is used at partial
opacity, because a full fill on hover makes a long table strobe under the cursor.

Below `md`, tables become stacked cards; see [Responsive Behavior](#responsive-behavior).

### Segmented — manager

A group of related controls that behaves as one physical object: a view switcher, a status
filter, zoom and fit. **The group carries the border and the `{elevation.raised}` shadow; the
segments inside are keys on it**, divided by `{border.default}` rules rather than separated by
gaps.

That follows from elevation being the affordance. A row of individually flat buttons reads as a
row of disabled ones, and a row of individually raised buttons is three shadows fighting over
one control. The segments do not travel on press — the group is the object that would move, and
moving one key of it looks broken — so the fill is the feedback:

```
rest      {colors.paper} fill, {colors.ink} text
hover     {colors.info} at 20%
active    {colors.info}
selected  {colors.ink} fill, {colors.chalk} text, and aria-pressed
```

### StatusChip — manager, public

`{type.label}`, `{space.1}`/`{space.2}` padding, `{border.default}`, no shadow, radius 0.

The chip carries the status word — it is never a bare coloured dot. Domain statuses map onto the
four state colours:

```
{colors.go}     PAID · PUBLISHED · VALID · REFUNDED · ADMITTED
{colors.hold}   DRAFT · AWAITING_PAYMENT · REFUND_PENDING · HELD
{colors.stop}   EXPIRED · CANCELLED · VOID · REFUND_FAILED · SOLD_OUT
{colors.paper-sunk}  Everything else
```

### Problem — all shells

The single way a failure is shown. `{colors.paper}` fill, `{border.heavy}` in `{colors.stop}`,
`{colors.ink}` text at `{type.body}`, `role="alert"`.

It must lay out a full sentence across two or three lines without truncating. Backend messages are
sentences, not codes — "These seats were taken while you were choosing: A1." — and a component
built for a five-word chip will clip the only useful part.

### EmptyState — manager, public

`{type.display}` headline saying what is not here, one line of `{type.body}` saying how to change
that, and the action as a primary button. No illustration, no icon.

### Modal — manager only

`{border.heavy}`, `{elevation.lifted}`, `{colors.paper}` fill, `{space.8}` padding, max width 480px.
Backdrop is `{colors.ink}` at 40% — flat, not blurred. Focus moves to the modal, `Escape` closes,
focus returns to the trigger.

### DangerConfirm — manager only

For actions that cannot be undone. The modal lists the consequences as a plain bulleted list before
the buttons — not a sentence, a list, because the consequences are plural and specific:

- **Publish an Event** — materialises the seats, freezes the Venue's Seat Map, and starts selling.
- **Close sales** — stops new Orders; existing paid Orders are unaffected.
- **Refund an Order** — voids its Tickets and returns the money. Refused if any Ticket is redeemed.
- **Cancel an Event** — voids every Ticket and refunds every paid Order.

**Cancelling an Event requires typing the Event title to confirm.** It is the only type-to-confirm
in the system; reserving it for the one genuinely catastrophic action is what keeps it meaningful.
Everything else uses a plain confirm with the consequence list.

The confirming button is `destructive` and is never the default focus.

### SeatMap — manager (editor), public (picker)

One component, rendered twice. `nfr.md` puts 2,000 seats on an Event, which sets the budget:
**SVG, one `<g transform>` for pan and zoom, no per-seat React state, no per-seat event handler.**
Delegate from the root and resolve the seat by id.

**Availability and Pricing Tier are two dimensions on one glyph.** requirements/004 criterion 2
asks for both at once — each seat shown as available, unavailable or held, *coloured by Pricing
Tier, with the tier's price visible*. So the tier scale carries an available seat, and the states
that are not available override it, because a seat you cannot buy has no price band worth reading.

An earlier version of this document painted available seats `{colors.go}`. That was wrong against
the requirement and worse for the buyer: green everywhere hides the price bands, which is most of
what somebody is choosing between.

Five states, each with a second non-colour signal, because a seat is roughly 8px at full-map zoom
and hue alone excludes colour-blind buyers at exactly the moment money is involved:

| State | Fill | Border | Second signal |
|---|---|---|---|
| available | its `{colors.tier-N}` | 2px `{colors.ink}` | legend names the tier and its price |
| selected | `{colors.info}` | 3px `{colors.ink}` | 1.25× scale |
| held by another | `{colors.hold}` | 2px `{colors.ink}` | diagonal hatch |
| sold | `{colors.paper-sunk}` | 2px `{colors.ink}` | diagonal strike |
| not for sale | none | 1px dashed `{colors.ink-soft}` | — |

The hatch and the strike are SVG `<pattern>` fills declared once in `<defs>`, not extra shapes per
seat. At two thousand seats a second element each is four thousand nodes to build and paint for a
texture; one paint reference costs nothing.

Map elements (`STAGE`, `ENTRANCE`, `AISLE`, `BAR`, `LABEL`) are `{colors.paper-sunk}` rectangles
with `{border.default}` and a `{type.label}` caption. They are never ticketed and must never look
selectable.

Seat labels appear at `{type.numeric}` only above a zoom threshold; below it, seats are glyphs and
the label lives in the hover or tap target.

**The editor** adds a row/block generator — origin, direction, count, spacing, label pattern, tier —
because nobody places 500 seats by hand, and everything else the editor does is editing what the
generator produced. The Seat Map is saved as one atomic document, so the editor holds local state
until Save and guards navigation while dirty. Label uniqueness is validated live, since the server
rejects the whole document over one duplicate.

**A seat map is chosen with the keyboard, and the arrows follow the room.** A seat map is a
picture of a building, so the only navigation that makes sense inside one is spatial: left and
right along a row, up and down between rows. Tab order would walk the array — the order the
seats were generated in, which means nothing to somebody sitting in the room — and at two
thousand seats "press Tab four hundred times" is not access.

```
Tab             reaches the map once. One tab stop, roving to the focused seat.
Arrow ← →       the next seat in this row
Arrow ↑ ↓       the nearest seat across, in the row above or below
Home / End      the ends of this row
Ctrl+Home/End   the first and last seat in the map
Enter / Space   choose or unchoose
```

Up and down land on the seat **nearest in x**, not on the same position along the next row.
Rows are not the same length — a balcony is narrower than the stalls — and counting along sends
somebody sideways across the room, which is the one thing a spatial map exists to prevent.

The map claims those keys and no others. `PageUp` and `PageDown` belong to the page scrolling
behind it, for the same reason the wheel needs a modifier: a component embedded in a document
must not swallow the document's own navigation.

**The seat map draws its focus ring instead of outlining it.** The one exception to
[Focus](#focus), and not a removal — an `outline` on an SVG shape renders inconsistently across
browsers and would not scale with the zoom if it did. Two concentric rings in map units at
`{colors.ink}` 0.2 and `{colors.info}` 0.12: the ink one underneath is what guarantees the ring
against a tier fill of similar lightness, which `{colors.info}` alone does not.

**The editor moves a seat by picking it up, not by holding a modifier.** The obvious design is
a modifier held down with the arrows, and it is the wrong one: `Alt`+`←` is Back in a browser
and `Ctrl`/`⌘`+`←` moves by word, so every modifier worth having is already spoken for and
taking one costs somebody a navigation they rely on. Pick up, move, drop is also what the
accessible drag-and-drop implementations converged on, which makes it the pattern most likely
to be already known.

```
M               pick the selection up — and, holding it, put it down
Arrow keys      while holding, move by a quarter of a seat's spacing
Shift+Arrow     while holding, move by a twentieth
Enter / Space   put it down
Esc             holding something, put it back exactly where it was
                holding nothing, let go of the selection
```

Four rules make that vocabulary safe to be in:

- **The arrows keep meaning navigation until something is in hand.** A map that nudged on a bare
  arrow would have no way left to move around itself.
- **The same key gets you out of the mode it got you into**, which is the thing modes get wrong.
- **`M` picks up the selection, not the focused seat.** Focus and selection are different things
  on a keyboard in a way they never are under a pointer: somebody arrows across the map to read
  a seat's label without meaning to give up the twenty they had chosen.
- **Snapping is never off**, on either lattice — exact coordinates are what makes two seats
  stacked on each other detectable at all. Putting something back snaps on the *fine* lattice,
  which the quarter lattice is a subset of, so a finely-placed seat survives the round trip
  instead of being dragged a fifth of a pitch on the way home.

**Being in a mode is said in words, where everybody can read them.** The editor carries one
polite live region under the help text — `Moving 3 seats…`, `Moved 0.25 down.`, `Put back.` —
and it is *visible*, for the same reason the picker's list is a view rather than an alternative.
A pointer says "you are in the middle of something" by holding a button down; a keyboard has
nothing to hold, and a mode nobody can see is one people leave by guessing. It keeps its height
when empty so the map does not jump the first time anything is picked up.

**A landmark is moved from its button in the panel, by the same keys.** The map's listbox holds
seats, so the landmark list is the only place a landmark is reachable without a pointer — and
one vocabulary in two places is better than a second vocabulary invented for the second place.

**The picker offers a list as well as a map, to everybody.** A picture is not a way to choose a
seat if you cannot see one, and a segregated "accessible version" is a second thing to keep
correct. The list is the same room in the same order — rows top to bottom, seats left to right,
named the way the venue names them (`A1, A2, A3` is Row A) — with unavailable seats present and
disabled rather than dropped, because a gap where `A3` should be is how a person reading it knows
`A2` and `A4` are not next to each other. Every seat carries its tier, its price and its state in
one accessible name; the legend is a second place to look, and this is read one seat at a time.

**A Seat Map is never locked, and that is the thing organizers get wrong.** Publishing *copies*
the map into the Event, and it is that copy which is frozen (`event_seat_frozen`); the Venue's own
map stays editable forever. So an organizer editing a Venue that has a live Event needs to be told
their changes **will not** reach it — a reassurance, not a lock. What is refused is *deleting* a
Venue with a published Event (`VENUE_IN_USE`).

The banner therefore reads "Changes here will not affect *Ha Noi Rock Night*, which is already on
sale", and names the Events. Getting this backwards — locking the editor — would prevent perfectly
legitimate work on next month's layout.

### HoldCountdown — public only

**A bar, not a widget.** Full width, pinned to the top of every screen in the checkout flow, present
from the moment a Seat Hold exists until it is spent or gone. `{type.numeric-lg}`, tabular.

```
> 2:00     {colors.paper} fill, {border.default}, ink text
≤ 2:00     {colors.hold} fill
≤ 0:30     {colors.stop} fill
= 0:00     the page changes, not the bar
```

At zero, the buyer is shown what happened and what to do — the seats were released and can be
chosen again — as a page state. A countdown that reaches zero and leaves the form sitting there,
failing on submit, is the specific failure this component exists to prevent.

No pulsing, no flashing. The colour change and the digits are the signal.

### MoneyTotal — public, manager

`{type.numeric-lg}`. On any screen where money moves, it is the largest object on the page. Never
`{colors.ink-soft}`, never smaller than the button below it, never right-aligned into a corner.

**VND has no minor unit** (`nfr.md`) — the amount is the dong. `formatMoney` knows; nothing in the
UI divides by 100.

### TimeWithZone — all shells

**Every time shown to a person carries its zone marker.** Times render in the *Venue's* timezone,
never the browser's (`nfr.md`), which means a buyer in Da Nang reading a Hanoi event sees Hanoi's
clock — correct, and indistinguishable from their own clock unless we say so.

```
19:30, 12 Jun · Hanoi time
```

The time in `{type.numeric}`, the zone marker in `{type.label}` at `{colors.ink-soft}`. A bare clock
face never ships. `toLocaleString` and its siblings are blocked by an eslint rule.

### TicketCode and QR — public only

The QR is the ticket. Minimum 240px on its shortest side, `{colors.paper}` quiet zone intact,
`{border.default}` around the block but never touching the code.

The code itself renders below in `{type.code}` on `{colors.paper-sunk}`, as a fallback for a
scanner that will not focus.

**A Ticket Code is never put in a URL and never logged** (`nfr.md`). It travels in a request body
and in the QR image, nowhere else. That is a design constraint as much as an engineering one: no
"share this ticket" link, no code in a query string, no copy-to-clipboard that routes through an
analytics call.

### ScanVerdict — scanner only

The component the whole scanner shell exists to render. `nfr.md` allows under 500ms from submit to
verdict; the operator gets far less than that to read it.

**Full bleed.** No card, no container, no page padding. The verdict is the screen.

```
ADMIT    {colors.go} field · {colors.ink} text · a 12px-stroke check mark
REFUSE   {colors.stop} field · {colors.ink} text · a 12px-stroke cross
         and a 3px inset {colors.ink} frame — the shape difference that carries
         the meaning when colour does not
```

One word at `{type.verdict}`. Below it the seat label at `{type.numeric-lg}` — it is both a number
a person compares and the thing that directs them to a seat, so it takes the numeric face and the
larger size — and the Event title at `{type.heading}`. Below that, at `{type.body}`, the reason in
the backend's own words — `This ticket has already been used.`, `This ticket is for a different
event.`, `Doors are not open yet.`

Both outcomes vibrate, with different patterns: a single 40ms pulse for ADMIT, three 80ms pulses
for REFUSE. Distinguishable in a pocket, and the only channel that works when the phone is not
being looked at.

**The verdict holds until the operator dismisses it, or for 4 seconds, whichever is later.** It
never auto-advances: with no dismissal it stays up indefinitely, and a dismissal in the first four
seconds is honoured at the four-second mark rather than immediately. A scanner that clears itself
is a scanner that admitted somebody nobody checked, and a queue is exactly the thing that makes an
operator tap through a screen they have not read.

Colour-blind operators read the word, the shape and the frame. Any one of the three is sufficient.

### ScanFailure — scanner only

A scan that never reached the server has no outcome, and must not borrow the shape of one.
requirements/007 criterion 11: the scanner never admits optimistically, so an unreachable server
is shown, not retried silently and not guessed at.

```
{colors.night} ground · the word FAILED at {type.verdict} in {colors.hold}
the reason at {type.body} in {colors.chalk} · the scanner button, labelled Try again
```

Neither field colour, so it can be mistaken for neither verdict, and large enough to be read at
the same distance. `{colors.hold}` because that is what it is: nobody has been admitted and
nobody has been refused, and the person at the door is still waiting.

A scan is also given a deadline, because a request that hangs never fails: it waits, and then
admits somebody minutes later when the signal returns, long after the operator gave up. Ten
seconds, against a 500 ms budget — not a deadline anybody meets, but the point past which no
answer beats a late one.

### ScanWorking — scanner only

The same `{colors.night}` ground while a scan is in the air, with `Checking…` at `{type.title}`
and no control. Deliberately **not** verdict-sized: it is the one screen in the scanner that
must never be mistaken for an answer. At 500 ms nobody reads it; the operator sees it only when
something has gone slow, and then it is the difference between a scanner that is working and a
scanner that ignored them.

---

## Do's and Don'ts

### Do

- **Do give every interactive element a 2px `{colors.ink}` border.** It is the system.
- **Do use the state colours for state only.** A `{colors.go}` fill means something is good, not
  that something is a call to action.
- **Do put every number a person compares in `{type.numeric}`** with tabular figures.
- **Do show the backend's error message verbatim.**
- **Do name the timezone** on every displayed time.
- **Do make the destructive path harder than the safe one** — and only for genuinely destructive
  actions, so the friction keeps meaning something.
- **Do test the scanner at minimum brightness, outdoors, one-handed.** It is the only way to know.
- **Do render the Vietnamese diacritic string** when adding or changing a font.

### Don't — the specific patterns this project refuses

These are named concretely so they can be caught in review rather than argued about. Each is a
default that generated interfaces converge on, and each is wrong here for a stated reason.

**Two of them are enforced by the build rather than by review.** `src/index.css` clears Tailwind's
default palette, shadow and radius scales inside `@theme`, so `bg-slate-900` and `shadow-lg` no
longer generate anything at all. What survives that — a blurred shadow, a rounded corner, a
gradient, an entrance animation — is caught by `no-restricted-syntax` rules in `eslint.config.js`
that read `className` strings. The rest of this list is still a matter of judgement.

- **No gradients.** Not on backgrounds, not on buttons, not on text. Specifically: no
  `bg-gradient-to-r from-indigo-500 to-purple-600`, and no `bg-clip-text` gradient headings. Flat
  fills only.
- **No glassmorphism.** No `backdrop-blur`, no translucent cards, no frosted panels. A blurred
  surface is unreadable at the brightness the operator's phone will be on.
- **No blurred shadows.** `shadow-sm` through `shadow-2xl` are all forbidden; every shadow is a
  solid offset.
- **No rounded corners** outside the three depictions in [Shapes](#shapes). No `rounded-2xl` cards.
- **No emoji as iconography.** Not in headings, not in buttons, not in empty states. Emoji render
  differently on every platform and carry a tone this product does not have.
- **No three-cards-in-a-row feature grid** — icon, bold heading, two lines of grey subtext,
  repeated three times. It is the single most recognisable generated-page signature and it says
  nothing.
- **No decorative animation.** No fade-in-up on mount, no staggered list entrance, no
  scroll-triggered reveals, no skeleton shimmer. The only motion in this system is the 60ms press
  and the scan verdict's appearance.
- **No marketing voice in product copy.** No "seamlessly", "powerful", "effortless", "unlock",
  "elevate". No exclamation marks.
- **No `{colors.ink-soft}` for anything that matters.** Grey secondary text is where important
  information goes to be ignored — prices, times and statuses are never grey.
- **No icon-only buttons** outside the scanner. An icon with no label is a guess.
- **No dark mode toggle.** The scanner is dark because a door at night is dark. The other two
  shells are light. A theme switcher is a third design to maintain and nobody asked for it.
- **No spinners, no progress bars, no toasts.** Pending state is a changed label; a result is a
  page state or an inline `Problem`.
- **No placeholder text standing in for a label.**
- **No lorem ipsum and no invented sample data** in any committed screen. Use a real Venue, real
  seat labels, real dong amounts — placeholder data hides layout failures that only real strings
  cause, and Vietnamese strings are longer than the English ones we would invent.

---

## Responsive Behavior

```
sm    640px    Phone landscape
md    768px    Tablet — the manager shell's lower bound
lg    1024px   Laptop
xl    1280px   Desktop
```

Each shell has a different relationship to these.

**Public shell — phone first, one column always.** The layout at 1280px is the layout at 375px with
more margin. The primary action is full width and pinned to the bottom of the viewport on phones,
in the thumb zone. `HoldCountdown` is sticky at the top on every size.

**Manager shell — `md` and up.** Below `md`, tables become stacked cards: each row is a bordered
card with `{type.label}` field names and values beneath. The seat map editor is **not** available
below `md` and says so — a generator, a marquee selection and drag-to-move cannot be done honestly
on a 375px screen, and pretending otherwise produces an editor that corrupts maps.

**Scanner shell — portrait phone only.** Full bleed at every size. Controls live in the bottom
third; the camera view takes the top two thirds. The verdict covers everything.

### Touch targets

```
manager    32px minimum   Mouse and keyboard, dense by design
public     44px minimum   Phone, one hand, distracted
scanner    56px minimum   Phone, one hand, in the dark, with a queue waiting
```

The scanner's 56px is not padding for its own sake. Every mis-tap at a gate is a person waiting, and
the operator is not looking at the screen between scans.

### Reduced motion

Under `prefers-reduced-motion: reduce`, the press transition drops to 0ms and the scan verdict
appears with no transition. Nothing else in the system moves, so nothing else changes.

---

## Agent Prompt Guide

For an agent building a screen in this repository.

**Before writing any markup:**

1. Identify the shell — manager, public, or scanner. It fixes the ground colour, the width, the
   density and the touch target minimum.
2. Check whether the screen shows money, a time, a seat, a Ticket Code, or a Seat Hold. Each has a
   named component above with rules that are not negotiable.
3. Reach for a component in this document before inventing one. If it is genuinely new, add it here
   with its full state set in the same PR.

**The five rules that catch most mistakes:**

```
1. Every interactive element:  2px solid {colors.ink}, radius 0, solid offset shadow.
2. Text on a state fill is {colors.ink}. Text on ink or night is {colors.chalk}. No others.
3. Numbers a person compares are {type.numeric} with tabular-nums.
4. Every time carries its zone marker. Every error shows the server's own message.
5. The only motion is the 60ms press and the scan verdict.
```

**Implementation.** Tailwind 4 is CSS-first: the tokens live in an `@theme` block in
`src/index.css`, and every value in this document should be reachable as a Tailwind utility. Write
`border-2 border-ink shadow-raised`, not an arbitrary value. If a screen needs a colour, size or
shadow that is not a token, that is a design decision — bring it here first.

**Review questions**, in the order they catch things:

- Does any shadow have a blur radius?
- Is any corner rounded that is not a seat, a map element or a QR?
- Is any state conveyed by colour alone?
- Is any number that changes set in a proportional face?
- Is any time shown without its zone?
- Is any important value grey?
- Would this screen be readable outdoors at minimum brightness?

---

## Known Gaps

Honest list of what this document does not yet decide.

- **The tier scale repeats after six.** A Venue with seven Pricing Tiers gets two the same
  colour. The legend still names them and selecting a tier still highlights it, so nothing is
  ambiguous — but the map stops being readable at a glance, and a seventh tier is a signal the
  scale needs patterns rather than more hues.
- **No icon set is chosen.** The components above avoid icons deliberately, but the scanner's camera
  controls and the seat map editor's tools will need them. A stroke-only set at 2px to match the
  border weight is the constraint; the specific set is undecided.
- **No motion specification for seat map pan and zoom.** Momentum, bounds and zoom limits are
  unspecified and will be settled when the component is built.
- **No print styles.** A buyer printing a ticket gets the browser's default, which is not a decision
  anybody made.
- **The seat map editor has no keyboard equivalent of the marquee.** Seats are chosen one at a
  time with `Shift`+`Enter`, which is twenty-four presses for a row and two hundred for a block
  — where a pointer draws one box. Selecting a row, a block or a tier in a single action is the
  missing verb, and it is a selection vocabulary rather than a movement one, so it wants
  designing rather than adding.
- **No specification for the platform-admin screens.** They are internal, low-traffic, and will
  inherit the manager shell until they have enough surface to deserve their own rules.
- **Only the auth slice has been built against this document.** The tokens, the primitives and
  the three shells obey it; every screen from slice 2 onward is the first real test of whether
  the component set above is sufficient. Expect to add components here, with their state sets,
  as they are needed.
