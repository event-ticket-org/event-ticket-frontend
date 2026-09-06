# event-ticket-frontend

React 19 · Vite · TypeScript · TanStack Query · React Router · Tailwind 4.

## The knowledge base is normative

Requirements, the domain model, the invariants and the API contract live in
[event-ticket-kb](https://github.com/event-ticket-org/event-ticket-kb). `contracts/openapi.yaml`
here is a **vendored copy** pinned to a merged KB revision in `contracts/KB_REVISION`. To change
the contract: open a PR in the KB, merge it, copy the file, update `KB_REVISION`.

`src/api/schema.d.ts` is generated from it before every dev run, build, typecheck and test, and
is **never committed** — a checked-in copy is a contract that has quietly stopped being
normative. A contract change the code has not caught up with fails `tsc`, not a user.

## The design system is normative too

[DESIGN.md](DESIGN.md) is the single source of truth for how this product looks and behaves —
palette, type, elevation, every component's state set, and the specific patterns this project
refuses. Read it before writing any markup. A component that disagrees with it is a bug, not a
variation. A screen needing a colour, size or shadow that is not a token there is a design
decision: change the document first.

The style is neo-brutalism, and it is chosen for reasons that are measurable rather than for
taste — hard borders survive a phone at minimum brightness held at a gate at night, and flat
fills give the seat map five states distinguishable without colour.

## One application, three shells

requirements/007 puts the scanner in the same application as everything else with a layout of
its own, so this is one app with three shells rather than three deployments.

```
src/
├── api/        client, session, errors, generated types
├── app/        router, layouts, top-level pages
├── features/   one folder per slice: auth, venues, events, checkout, tickets, scanner
└── shared/     formatting and the small UI pieces everything uses
```

The scanner shell has **no navigation and no header**. It is used one-handed, in the dark, with
a queue waiting; every control is one more thing to mis-tap at a gate.

## Rules the KB imposes on the UI

**Every time shown to a person renders in the Venue's timezone, never the browser's.** Use
`formatInZone`. `toLocaleString` and friends are banned by an eslint rule, because they silently
use the browser's zone and look correct on every machine we develop on — Vietnam is a single
zone with no daylight saving, which is exactly what makes this easy to get wrong and never
notice.

**VND has no minor unit.** The amount *is* the dong. Dividing by 100 to "convert from cents" is
a factor-of-a-hundred error; `formatMoney` and `Intl` already know.

**The client renders whatever next action a payment returns** — redirect, QR, hosted checkout —
without knowing which provider produced it (ADR-0002). Never branch on the provider's name.

**A Ticket Code is never logged and never put in a URL.** It travels in a request body and in a
QR image, and nowhere else. A URL containing one lands in access logs, proxy logs and browser
history (nfr.md).

**The QR contains the ticket code and nothing else.** The backend emits a ~53-character string
and accepts the same string back; it never produces or parses an image. The ticket page renders
the string as a QR, the scanner decodes a QR back to the string. Seat, event and validity are
resolved server-side at scan time (KB invariant 16).

## The seat map

**A seat is identified by its index in the array, never by its label.** A Seat Map has no ids
and a label is unique only in a *valid* map — which is precisely the state an editor spends its
time outside. Keyed by label, renaming B1 to A1 selects both seats, moves both and renames
both, so a duplicate can never be repaired; it also hands React two children with the same key.
Nothing reorders the array, which is what makes the index stable.

**Validate as you type, matching `SeatMapDocument.validated()` exactly.** The map is saved as
one document, so one duplicate label rejects two thousand good seats. A check that is merely
*similar* to the server's is worse than none: it lets through the edits the two disagree about.

**Fitting is SVG's `viewBox`, and pointer conversion is `getScreenCTM()`.** Both are already
correct about aspect ratio, element size and ancestor transforms. Hand-rolled arithmetic is how
a seat map selects the seat next to the one you clicked on a scrolled page.

**`display: contents` and `space-y-*` do not mix.** A wrapper with `md:contents` leaves the box
tree, so the parent's `space-y-4` — which targets direct children — applies its margins to a box
that no longer exists, and everything inside loses its spacing silently. It cost a toolbar whose
buttons painted their shadows into the panel below. Give a conditional wrapper its own spacing
and make it a real block (`hidden space-y-4 md:block`).

**The map is a listbox, and the arrows are geometry.** Seats carry `role="option"` under one
`role="listbox"` with a roving tabindex, so the map is one tab stop and the arrows move within
it. Which seat an arrow reaches is computed from coordinates — rows are found by clustering `y`,
and up/down lands on the nearest seat in `x` rather than the same position along, because rows
are not the same length and counting along sends somebody sideways across the room. That is in
`seat-navigation.ts` and it is unit tested; the component only turns key presses into calls.

**A gesture in progress is a ref, not state.** The editor's keyboard move keeps its running
offset in a ref because a held-down arrow repeats faster than React re-renders: two presses
landing in one batch both read the same offset, so the seat moves one step for two presses and
drifts further behind the longer the key is held. What saves the map from the same problem is
that `dragSelectionTo` is *absolute* from what `beginDrag` snapshotted — batched calls end on
the right answer because the last one is the whole truth, not an increment. That is also what
makes cancelling a move an offset of zero rather than an undo stack.

**Extending a selection means a rectangle, not a range.** `Shift`+arrow is the listbox gesture
everybody has, and the array-range meaning it usually carries is wrong here: array order is the
order seats were generated in, so a range through it is a diagonal nobody drew. Two seats bound
a box, `rangeRect` builds it, and `selectWithin` is the same call the pointer's marquee makes -
one gesture with two ways to perform it. The box is padded by a seat's radius, or a run along
one row is a rectangle of zero height that misses a row-mate nudged off the line.

**The picker's list is not an accessible alternative, it is the second view.** Offered to
everybody in the same Segmented control as the zoom, because a sighted person hunting for two
seats together in row F wants it too, and a version only screen-reader users see is a version
that quietly rots.

**Measure the painted extent, not the border box.** `getBoundingClientRect` excludes
`box-shadow`, and in this system every raised control paints 4–6px past its box. Two elements
can report a clean gap and still overlap on screen.

**Tier colours are categorical, not semantic** — see DESIGN.md. A tier is not a state, and the
four state colours would say things about VIP and Restricted View that are not true.

## Talking to the backend

```bash
docker compose up -d && ./mvnw spring-boot:run    # in ../event-ticket-backend
npm run dev
```

Vite proxies `/api` to `localhost:8080`, so the browser only ever sees one origin and CORS never
enters the picture. That mirrors how this is meant to be deployed — one reverse proxy in front
of both — and the backend already assumes it: `app.base-url` points at `localhost:5173`.

Two things the API deliberately will not do for you locally, both of them the system working:

- **Email verification** goes to the backend console and the `email_delivery` table, not to an
  inbox.
- **A purchase cannot be completed from the browser.** Payment is confirmed by the provider's
  webhook, never by the buyer returning (requirements/005 criterion 3). An order will sit
  `AWAITING_PAYMENT` until something acts as the provider — see the backend's scripts.

## The API client

`src/api/client.ts` is written by hand while the types are generated, because the three things
that matter are ours: the bearer token, the single-flight refresh, and the error envelope.

**A spread hides contract drift from `tsc`.** The generated types are the safety net - a
contract change the code has not caught up with is meant to fail the build. Excess-property
checking is what catches a field the contract has dropped, and it only applies to object
*literals*: `mutate({ ...(x ? { goneField: v } : {}) })` type-checks cleanly while sending a
field the server will refuse. Write conditional fields as a literal with `undefined` where you
can, and treat a green `tsc` after vendoring a contract as evidence, not proof.

**Branch on `error.code`, never on the status.** `SEATS_UNAVAILABLE` and `ORDER_ALREADY_PAID`
are both 409 and mean entirely different things to a buyer.

**Cover images do not go through this client.** A cover is posted straight to object storage
from the browser (ADR-0006): a different origin, no bearer, and a multipart body - every reason
`api.ts` exists is a reason not to use it there. Sending our access token to a storage host
would hand a credential to a service with no business holding one. `cover-hooks.ts` uses plain
`fetch`, and the three steps are one mutation because a caller who did two of them has produced
an orphan rather than a cover.

**Show `error.message`.** The backend writes messages meant to be read by the person who hit
them; replacing them with prose of our own makes them worse and lets the two drift.

**Refresh is single-flight.** Four requests failing together must not spend four refresh tokens
— the backend would be right to reject the losers, and the user would be signed out by their own
application. `session.refreshOnce` is what prevents it and `client.test.ts` proves it.

**Mutations are `networkMode: 'always'`, set once in `app/query-client.ts` and pinned by a test.**
TanStack's default is `online`, and with the browser reporting no connection it does not fail a
mutation — it *pauses* it. `isPending` stays true, the request is never sent, and it runs when the
network comes back. This application has no offline mode to make that useful: every mutation is a
person pressing a button and waiting, so a paused one is a button that says `Working…` until the
signal returns and then acts at a moment nobody chose. It admitted somebody at a door minutes
late; it would hold seats on a ten-minute clock the buyer never saw; and it makes sign-out skip
its `onSettled`, so the one thing it must always do — clear this browser — is the one thing it
does not. Queries keep the default: a paused read is a spinner, a paused write is an action.

**Ask the server what a person may do, not the token.** `/me` lists live Memberships; a token
says which Organization is active. A removed member holds a valid token for up to fifteen
minutes (ADR-0005).

## Tokens

Access token in memory, refresh token in `localStorage`. The access token is irrevocable for its
fifteen minutes; the refresh token is revocable server-side at any moment, so the *irrevocable*
one is the one kept out of storage.

Worth knowing the size of that win: script that can read `localStorage` can also just use the
app. The real gain is that a stolen refresh token can be killed. httpOnly cookies would be
strictly better and need a backend change plus CSRF handling — a contract change, not a frontend
one.

## Testing

Vitest for the logic that has any: the client's refresh behaviour and the formatters. Rendering
tests earn their place when a component has a decision in it, and most do not.

The seat map and the scanner will need their own approach when they arrive — geometry is unit
testable, a camera is not.

## The scanner

**The verdict is held, and the hold is the tested part.** Four seconds minimum, never
auto-advancing; a tap inside those four seconds is remembered and acted on at the end of them. It
is the one behaviour here that cannot be checked by looking, because the failure is a verdict that
vanished a moment before somebody read it.

**The camera is the one thing no script reaches.** Everything downstream of a decoded string is
exercised through the typed-code path — which exists for the cracked screen a camera will not read
and doubles as the only way this feature is testable at all. A claim about the camera itself is a
claim about a device.

**Rebuilding a Ticket Code for local testing.** A code is `ET<version>-<lookup>-<tag>` and only
the lookup is in the database (`ticket.code_lookup`). The tag is
`hmac_sha256(key, bytes.fromhex(lookup))[:8]` in uppercase hex, with the dev key from the
backend's `application.yml`. Nothing that grants entry is stored, which is the point.
