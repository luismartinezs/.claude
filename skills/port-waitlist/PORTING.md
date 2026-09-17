# Porting Steps

## 0. Survey the target

Establish by reading the target codebase:

- Backend framework and how routes are registered (router files? a
  central `main.ts`? a `route()` adapter?). Where validation happens.
- ORM/DB and the migration workflow (command to generate + run).
- Is there a shared API-contract location (types package, `shared/`
  dir)? If yes, the Zod schemas go there.
- Existing rate-limit infrastructure.
- Frontend: where composables/hooks live, what input/button primitives
  exist, what the analytics helper is called (if any).
- How the frontend reaches the API in dev and prod (proxy? absolute URL?).

Decide target locations for: contract, table schema + migration, route
module, composable + logic, form component. Follow target conventions;
never replicate the reference layout for its own sake.

## 1. Contract

Reference: `api-contract.ts`

- Place `WaitlistEntrySchema` / `WaitlistResponseSchema` where both
  sides can import them. Rename/drop the `restrictions` field per the
  target product (ask the user what extra signup context, if any, they
  want to capture; default is none).

## 2. Database

Reference: `db-schema.ts`

- Add the table with: pk, `email` NOT NULL UNIQUE, optional extras
  column, utm_source/medium/campaign, created_at/updated_at.
- Generate and run a migration using the target's workflow.

## 3. Backend endpoint

Reference: `backend/`

- Service: upsert by email; on conflict update extras + UTM + updated_at.
- Handler: parse-validated body in, `{ success, message }` out.
- Rate limit: 5/min/IP for this endpoint, using target infra or
  `express-rate-limit` directly (add the dependency only if nothing
  equivalent exists).
- Register the router at `/waitlist` under the target's API prefix.
- Port the service/handler tests, adapted to the target's test setup
  (mocking the db module vs a test database: follow whatever the
  target's existing backend tests do).

## 4. Frontend logic

Reference: `frontend/waitlist.logic.ts` (+ test), `frontend/use-waitlist.ts`

- Port the pure logic file and its test nearly verbatim.
- Port the composable: adjust the API path, the success behavior
  (redirect target or none), the analytics call, and the default value
  of the extras field. Keep the four-state machine and the
  validate-before-fetch order.

## 5. Form component

Reference: `frontend/email-capture-form.vue`

- Rebuild with the target's design system and input/button primitives.
  Required behavior: submit on enter, disable while loading, inline
  error message, success state replaces the form, emits/handles success
  for parent pages.
- Mount it where the user wants it (hero, dedicated /waitlist page,
  footer). In Astro this is a Vue island: `client:load` is fine (no auth
  dependency); `client:visible` if it sits below the fold.

## Verification

1. Typecheck backend + frontend with the target's commands.
2. Run the ported unit tests (logic, service, handler).
3. Manual round-trip against the dev stack: submit a valid email, then
   verify the row exists in the DB (use the target's DB tooling).
4. Duplicate check: submit the same email again with a different UTM
   query string; expect success UI and ONE row with updated UTM values.
5. Validation check: submit `not-an-email`; expect inline error, no
   network write.
6. Rate limit check: 6 rapid submissions from one IP; expect the 6th to
   return the rate-limit error and the form to show its message.
7. Report: file map, contract location, the extras field decision,
   success behavior chosen, and anything stubbed (e.g. analytics).
