# event-ticket-frontend

The browser application for the event ticketing platform: a public listing and checkout, an
organization's management screens, and the door scanner — one app, three shells.

**The knowledge base is normative.** Requirements, the domain model and the API contract live
in [event-ticket-kb](https://github.com/event-ticket-org/event-ticket-kb). The contract vendored
at `contracts/openapi.yaml` is pinned to a merged revision in `contracts/KB_REVISION` and must
never be edited here.

## Stack

React 19 · Vite · TypeScript · TanStack Query · React Router · Tailwind 4

## Running

The backend first, in `../event-ticket-backend`:

```bash
docker compose up -d       # Postgres on 5432
./mvnw spring-boot:run     # :8080
```

Then here:

```bash
npm install
npm run dev                # :5173, proxying /api to the backend
```

Vite proxies `/api` to `localhost:8080`, so the browser sees one origin and CORS never comes up.

## Two things that will look broken locally, and are not

**Verification emails go to the backend console**, not to an inbox — `LoggingEmailTransport`
writes them out, and they are also rows in `email_delivery`.

**A purchase cannot be completed from the browser.** Payment is confirmed by the provider's
webhook, never by the buyer returning to the site (requirements/005 criterion 3). Until
something posts that webhook, an order stays `AWAITING_PAYMENT` and no tickets exist.

## Commands

| | |
|---|---|
| `npm run dev` | dev server on :5173 |
| `npm run typecheck` | regenerate types from the contract, then `tsc` |
| `npm test` | Vitest |
| `npm run lint` | ESLint |
| `npm run build` | typecheck and bundle to `dist/` |

Every one of those regenerates `src/api/schema.d.ts` from the vendored contract first. It is
not committed: a checked-in copy is a contract that has quietly stopped being normative.

## What is here, and what is next

Built: the contract loop, the API client with single-flight token refresh, sessions, the three
shells, and register / verify / sign in.

Next, in order: the manager screens and the seat map editor; the public event page, seat picker
and checkout; the scanner.
