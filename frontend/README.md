# Frontend

The admin console for the platform — dashboard, products, warehouses, inventory, orders, customers, users, roles, audit log, and a live notification feed, all behind a single React app.

## Stack

React 19 with TypeScript and Vite. Tailwind v4 with shadcn/ui (built on Radix primitives) for the components, TanStack Query for anything that comes from the API, React Hook Form with Zod for forms, Axios for HTTP, and `@microsoft/fetch-event-source` for the real-time stream — native `EventSource` can't attach an `Authorization` header, and this API is bearer-token authenticated, so a plain `EventSource` wasn't an option.

React Context is used sparingly, for auth, theme, and the notification feed — everything else that's "state" is really server state and lives in TanStack Query instead of being duplicated into a store.

## Running it

```bash
npm install
npm run dev
```

Opens on http://localhost:5173, with `/api` proxied through to a backend running on 8080. `npm run build` type-checks the whole project and produces a production bundle; `npm run lint` runs oxlint.

Through Docker, `docker compose up --build` from the repo root serves this at http://localhost:3000 — a multi-stage build, Node to build it and nginx to serve it, with the SPA history fallback, the `/api` proxy, and security headers (CSP, `X-Frame-Options`, `nosniff`) all handled at the nginx layer.

## Logging in

Two seeded accounts:

- `admin@uphead.com` / `adminPassword` — admin of the demo organization. Create a Manager, Staff, or custom-role user from the Users screen if you want to see what a more restricted role looks like.
- `owner@uphead.com` / `ownerPassword` — the platform owner, which signs into a separate console for creating and managing organizations rather than the normal business screens.

## Structure

```
src/
├── app/          providers, router, route guards
├── components/
│   ├── ui/       shadcn primitives
│   ├── layout/   the app shell — sidebar, breadcrumbs, notification bell, user menu
│   ├── data/     DataTable, EntityCombobox, SearchInput, FormSheet, and the other reusable list/form pieces
│   └── feedback/ page headers, empty/error/forbidden states, confirm dialogs
├── hooks/        URL-synced list params, id-to-name lookups, debounce
├── lib/          formatting, error normalization, token storage, query keys
├── modules/      one folder per feature area — auth, dashboard, products, orders, roles, platform, and so on
├── services/     the API client plus one service module per backend resource
├── store/        auth, theme, and notification contexts
└── types/        types mirroring the backend's DTOs
```

## How a few things actually work

**Auth.** Login stores an access token and a refresh token. A 401 (or the equivalent unauthenticated case) triggers one shared refresh request — if three requests fail at once, they share a single refresh call rather than each firing their own — and the failed requests retry once it resolves. If the refresh itself fails, the session clears and the user lands back on the login page, returning to wherever they were once they sign in again.

**Authorization in the UI is for convenience, not security.** Menu items and action buttons hide themselves based on the permissions returned at login, so nobody sees a button that would just come back as a 403. The backend's own checks are what actually matter — see `../SECURITY.md`.

**Lists** all use server-side pagination and sorting, with the current page, size, sort, and filters kept in the URL, so a list view survives a reload and can be shared as a link. Loading, empty, error, and "you don't have permission for this" states are handled the same way everywhere through one shared `DataTable` component rather than each screen reinventing them.

**Orders.** The create dialog builds a multi-line order, one product and warehouse per line, showing live stock availability as you go. Prices shown here are for display only — the backend always looks the real price up itself from the product record, so nothing the client sends about pricing is ever trusted. If stock changes out from under you and the backend rejects a line, that specific line gets highlighted rather than the whole form just failing generically. The order detail page shows only the status transitions the backend's own state machine allows, gated per-transition on the right permission — cancelling needs one permission, everything else needs another, matching the backend exactly rather than assuming they're the same thing.

**Roles.** Every organization's Admin, Manager, and Staff, plus any custom roles it's created, each with a permission-matrix editor. Saving takes effect immediately for everyone holding that role — nobody needs to sign out and back in, which matches how the backend actually resolves permissions.

**The platform console.** Visible only to the platform-owner account, and reachable at `/platform/organizations`. Lists organizations, creates a new one with its first admin in one form, and can rename or suspend an existing one — suspending blocks sign-in immediately, not just for new sessions. Each organization also has a Users panel: see who already has access, add someone directly, or reset a password. That last part exists because the only way to get a user into an organization used to be that first admin account, and if those credentials were ever lost before anyone signed in with them, there was no way back in.

**Real-time.** An authenticated SSE connection stays open to the backend, reconnecting with backoff if it drops and refreshing the access token first if that's why it was rejected. It's released while the tab is hidden, mostly so a dozen background tabs don't eat into the browser's small per-host connection limit. Events show up in the notification bell, toast when they arrive live (not when they're just backlog being replayed on reconnect), and invalidate whatever cached data they'd affect — a new order invalidates the orders list and the dashboard, that kind of thing.

## What's genuinely still rough here

A few things worth knowing about rather than discovering the hard way:

- Access and refresh tokens live in `localStorage`, not an httpOnly cookie, because the backend returns both in the response body and CORS here doesn't use credentials. It's a real trade-off, mitigated by React's default output escaping and a fairly strict CSP, but it's still a trade-off.
- Product, warehouse, and customer names shown in inventory and order lists come from cached lookup lists fetched once, not from the backend resolving IDs to names directly. Fine at this scale; wouldn't be at a much bigger one.
- The backend can only apply one list filter at a time today (search *or* status, not both together), so the UI keeps those controls mutually exclusive rather than offering a combination that would silently drop one of them.
- Timestamps come back from the backend without a timezone and get shown as the browser's local time — correct if the backend and its users are in the same zone, off by exactly that offset if they're not.
- There's no dedicated inventory history view; the audit log is the closest thing to one.
- No automated frontend test suite yet (Vitest/React Testing Library).

The complete, actively-maintained version of this list — including the backend-side issues that affect what the frontend can and can't do — lives in the repo root's `KNOWN_LIMITATIONS.md`. That file is the one to trust if something here looks out of date; this section is a summary, not the source of truth.
