---
name: port-waitlist
description: Port a pre-launch email waitlist (rate-limited API endpoint, Postgres upsert, UTM capture, Vue email-capture form with validation) into a codebase. Use when asked to add a waitlist, email capture, or pre-launch signup to a product. Contains reference implementation, API contract, porting steps, and verification checklist.
---

# port-waitlist: Pre-Launch Email Waitlist

You are porting a proven waitlist feature from a reference codebase into
the current codebase. The reference code in `reference/` is ONE
instantiation (Express 5 + Drizzle/Postgres + Zod backend, Vue 3 form on
an Astro page). Adapt file placement, naming, styling, and plumbing to
the target's conventions. Do NOT impose the reference's folder structure
or UI design; only the contract and invariants below must survive.

## What the feature is

- `POST /api/waitlist` accepts `{ email, restrictions?, utmSource?,
  utmMedium?, utmCampaign? }`, validated with Zod, and upserts by email.
  Re-submitting the same email is a silent success that refreshes the
  row (latest UTM wins). No error is ever shown for duplicates.
- Endpoint-specific rate limit (5 requests/minute/IP in the reference)
  on top of any general API limiter.
- Frontend: an email-capture form component + a headless composable.
  The composable owns state (`idle | loading | success | error`),
  client-side Zod validation (same schema as the server), UTM param
  capture from `window.location.search`, submit, analytics event on
  success, and optional redirect. The form component is thin
  presentation over it.
- UTM source/medium/campaign are captured invisibly so you can later
  tell which channel filled the list.

## File inventory (reference/)

| File | Role |
|---|---|
| `api-contract.ts` | Zod schemas: `WaitlistEntrySchema`, `WaitlistResponseSchema`. THE contract; shared verbatim between client and server |
| `db-schema.ts` | Drizzle table: id, unique email, jsonb extras, utm columns, timestamps |
| `backend/waitlist.router.ts` | Route wiring: rate limit → validate → handler |
| `backend/handler.ts`, `backend/service.ts` | Thin handler; upsert service (`onConflictDoUpdate` on email) |
| `backend/rate-limit.ts`, `backend/rate-limit-base.ts` | Endpoint limiter + the env-aware base config it composes |
| `backend/*.test.ts` | Handler and service tests |
| `frontend/use-waitlist.ts` | Composable: state machine, validation, fetch, tracking |
| `frontend/waitlist.logic.ts` + test | Pure functions: UTM parsing, first-error extraction |
| `frontend/email-capture-form.vue` | Example form UI (restyle freely) |

## Invariants

1. **One schema, two enforcement points.** The Zod schema lives in a
   shared location importable by both client and server (in the
   reference: an `api-types` package). Client validates before fetch for
   instant feedback; server validates again because the client is not a
   security boundary. Never fork the schema into two copies.
2. **Upsert, not insert.** Duplicate email must not error, leak "already
   registered" state, or create rows. `ON CONFLICT (email) DO UPDATE`.
3. **Endpoint-specific rate limit.** An email-capture endpoint is a spam
   magnet; it gets its own tight limiter regardless of global limits.
4. **Composable/UI split.** All behavior lives in the composable; the
   form component only renders state. This is what makes the UI freely
   redesignable per product.
5. **Pure logic extracted.** UTM parsing and error extraction are pure,
   tested functions, not inlined in the composable.
6. **Graceful failure copy.** Network error and rate-limit error produce
   human messages in the form, never an unhandled rejection.

## Known adaptation points

- **The `restrictions` field is reference-product-specific** (dietary
  restrictions). Rename or drop it. The pattern it demonstrates: one
  jsonb "extras" column for product-specific signup context. Rename in
  schema, Zod contract, composable, and DB column together.
- **Persistence.** Reference uses Drizzle + Postgres with a migration.
  If the target uses something else, keep the semantics (unique email,
  upsert, timestamps) and translate. Generate/write a migration per the
  target's workflow; never hand-edit the DB.
- **HTTP layer.** Reference uses Express with a `route()` adapter and a
  `validate()` middleware from its boilerplate. If the target has
  equivalents, use them; if not, inline plain Express handlers with
  try/catch and `schema.safeParse(req.body)`.
- **Rate limiting.** Reference composes `express-rate-limit` with a
  shared env-aware base config. If the target has its own rate-limit
  infra, plug into it; only the 5/min/IP tightness matters. Behind a
  reverse proxy, confirm the app trusts `X-Forwarded-For`
  (`app.set('trust proxy', ...)`) or every visitor shares one bucket.
- **API base path.** Reference frontend fetches `/api/waitlist` (same
  origin, proxied). Match the target's API URL convention.
- **Success behavior.** Reference redirects to `/pricing` and fires an
  `email-submit` analytics event. Decide per product: inline success
  message, redirect, or both. Ask the user if there's no obvious answer.
- **Analytics.** `trackEvent` no-ops when the analytics lib is absent.
  If the target has no analytics, keep the call site but stub or drop it.
- **Form UI.** Restyle entirely to the target's design system. The
  reference `.vue` shows required states only: input + button, loading
  disable, inline error text, success state swap.
- **Emails to the list.** Out of scope. The table is the deliverable;
  export or email later.

## Process

Follow `PORTING.md`. Do not report done until the verification section
passes, including the duplicate-email and rate-limit checks.
