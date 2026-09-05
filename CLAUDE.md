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

**Branch on `error.code`, never on the status.** `SEATS_UNAVAILABLE` and `ORDER_ALREADY_PAID`
are both 409 and mean entirely different things to a buyer.

**Show `error.message`.** The backend writes messages meant to be read by the person who hit
them; replacing them with prose of our own makes them worse and lets the two drift.

**Refresh is single-flight.** Four requests failing together must not spend four refresh tokens
— the backend would be right to reject the losers, and the user would be signed out by their own
application. `session.refreshOnce` is what prevents it and `client.test.ts` proves it.

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
