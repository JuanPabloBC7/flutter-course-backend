# Implementation Plan — Reorganize + Simplify the credit-cards example

Refactor the Node.js + TypeScript + Express + PostgreSQL backend so all
credit-card-specific code lives in a self-contained `src/credit-cards/` folder,
and the 8 current files collapse into a smaller, cohesive set — WITHOUT changing
any validation behavior, HTTP status codes, response/error shapes, DB schema,
or dependencies.

Root (absolute): `/Users/Juan_Balan/Desktop/env/personal/project/flutter-course-backend`
All paths below are relative to that root. Run every command from the root.

## Design decisions (grounded in the code I read)

- **Target folder:** new `src/credit-cards/`. `tsconfig.json` has `rootDir: "src"`
  and `include: ["src/**/*.ts"]`, so a subfolder compiles with no config change.
- **File count:** collapse 8 → 6 files. The two folds requested are:
  (a) `security/card-fingerprint.ts` → folded into `credit-cards/card-validator.ts`
  (it already depends only on `normalizeCardNumber` from the validator + `env`);
  (b) `controllers/credit-card-controller.ts` → folded into `credit-cards/routes.ts`
  (the controller is a thin request/response mapper). Keeping `types.ts`,
  `schemas.ts`, `repository.ts`, and `service.ts` as separate cohesive modules is
  the recommended layout and keeps each concern readable; folding further would
  mix SQL, zod, and domain types in one file and hurt clarity. Result: 6 files,
  matching the recommended layout.
- **Behavior is preserved by moving code verbatim.** Every function/type is copied
  unchanged; only `import` paths are rewritten. No logic edits.
- **Pre-existing test failure (do NOT "fix"):** baseline `npm run test:unit`
  already fails ONE assertion — `tests/card-validator.test.ts:60`
  `expect(detectBrand('6011000000000004')).toBeNull()` — because the current
  validator supports DISCOVER (6011...), so it returns `'DISCOVER'`. This failure
  exists before any change. The task forbids changing validation behavior, so the
  refactor MUST keep `detectBrand` identical; this one assertion stays red after
  the refactor. That is the correct outcome for a pure move/flatten. Do NOT alter
  `detectBrand` or the test to make it pass — that would change behavior. The
  remaining 22 unit assertions must stay green. (See "Verification" for the exact
  expected result.)

## Shared infra that STAYS at src/ root (do not move, do not edit except app.ts)

`src/config/env.ts`, `src/database/pool.ts`, `src/database/migrate.ts`,
`src/database/migrations/001_create_credit_cards.sql`, `src/errors/app-error.ts`,
`src/middleware/error-handler.ts`, `src/middleware/validate.ts`, `src/server.ts`.
`src/app.ts` stays but gets ONE import/path edit (step 7). Confirmed none of
these import credit-card-specific modules, so they are unaffected by the move.

## Behavior-drift watch list (must be preserved exactly)

- **Exports a test imports** from `card-validator`: `detectBrand`, `extractLast4`,
  `normalizeCardNumber`, `passesLuhn`, `validateCardNumber`, `validateCvv`,
  `validateExpiration`. All must remain named exports with identical signatures.
  Also keep `isAllDigits`, `BRAND_LENGTHS`, `BRAND_CVV_LENGTHS`, and the
  `ValidationResult` interface (internal but used by the module/service).
- `computeCardFingerprint` must stay HMAC-SHA256 over
  `normalizeCardNumber(cardNumber)` using `env.CARD_FINGERPRINT_SECRET`.
- Zod schemas: keep `.strict()` on both create/update and the `.refine(...)` that
  requires at least one of `creditLimit`/`status` on update. Keep
  `cardIdParamSchema` UUID check.
- Service: keep the ordered validation (number→expiration→cvv), duplicate
  detection via fingerprint, `23505` unique-violation → 409, 404 on missing,
  and `toPublic` mapping (which excludes `card_fingerprint`, PAN, CVV).
- Routes: keep endpoints, middleware order per route, status codes 200/201/204,
  the `{ data: ... }` envelope, and `app.use('/api/v1/credit-cards', ...)` mount.

---

# Steps

- [ ] 1. Create `src/credit-cards/types.ts` — move domain types verbatim.
      Copy the entire contents of `src/types/credit-card.ts` unchanged:
      `CardBrand`, `CardStatus`, `CARD_STATUSES`, `CreditCardRow`,
      `CreditCardPublic`, `CreateCardInput`, `UpdateCardInput`. No imports to
      rewrite (this file has none). Keep comments in Spanish.
      Files: create `src/credit-cards/types.ts`.
      Verify: `npx tsc --noEmit` has no NEW errors referencing `credit-cards/types`
      (old files still exist at this point, so a duplicate-free compile is expected;
      full green compile comes after deletions in step 9).

- [ ] 2. Create `src/credit-cards/card-validator.ts` — move the validator AND fold
      in the fingerprint helper.
      Copy all of `src/validation/card-validator.ts` verbatim, changing only the
      type import from `'../types/credit-card'` to `'./types'`. Then append the
      fingerprint logic from `src/security/card-fingerprint.ts`: add
      `import { createHmac } from 'node:crypto';` and
      `import { env } from '../config/env';` at the top, and the
      `computeCardFingerprint` function (unchanged body) at the bottom, reusing the
      local `normalizeCardNumber`. Keep ALL existing exports named and unchanged
      (`normalizeCardNumber`, `isAllDigits`, `detectBrand`, `passesLuhn`,
      `validateCardNumber`, `validateExpiration`, `validateCvv`, `extractLast4`,
      `ValidationResult`) plus the new `computeCardFingerprint`.
      Files: create `src/credit-cards/card-validator.ts`.
      Verify: `npx tsc --noEmit` reports no errors in the new file.

- [ ] 3. Create `src/credit-cards/schemas.ts` — move zod schemas verbatim.
      Copy `src/validation/schemas.ts` unchanged except the import
      `'../types/credit-card'` → `'./types'`. Preserve `cardIdParamSchema`,
      `createCardSchema` (with `.strict()`), `updateCardSchema` (with `.strict()`
      and `.refine(...)`), and the `CreateCardBody`/`UpdateCardBody` inferred types.
      Files: create `src/credit-cards/schemas.ts`.
      Verify: `npx tsc --noEmit` reports no errors in the new file.

- [ ] 4. Create `src/credit-cards/repository.ts` — move the repository verbatim.
      Copy `src/repositories/credit-card-repository.ts` unchanged except imports:
      `'../database/pool'` stays `'../database/pool'` (still one level up from
      `credit-cards/`), and `'../types/credit-card'` → `'./types'`. Keep
      `InsertCardData`, `UpdateCardData`, `findAllActive`, `findById`,
      `findActiveByUserAndFingerprint`, `insert`, `update`, `softDelete`, and the
      soft-delete `deleted_at IS NULL` filtering and parameterized queries.
      Files: create `src/credit-cards/repository.ts`.
      Verify: `npx tsc --noEmit` reports no errors in the new file.

- [ ] 5. Create `src/credit-cards/service.ts` — move the service, update imports to
      new local modules.
      Copy `src/services/credit-card-service.ts` unchanged except imports:
      `'../errors/app-error'` stays (still one level up); replace
      `import * as repo from '../repositories/credit-card-repository'` with
      `import * as repo from './repository'`; replace
      `import { computeCardFingerprint } from '../security/card-fingerprint'` with
      importing `computeCardFingerprint` from `'./card-validator'` (merge into the
      existing `./card-validator` import that also brings `extractLast4`,
      `validateCardNumber`, `validateCvv`, `validateExpiration`); replace
      `'../types/credit-card'` → `'./types'`. Keep `toPublic`, `listActiveCards`,
      `getCardById`, `createCard`, `updateCard`, `deleteCard`, `isUniqueViolation`
      and all logic/ordering unchanged.
      Files: create `src/credit-cards/service.ts`.
      Verify: `npx tsc --noEmit` reports no errors in the new file.

- [ ] 6. Create `src/credit-cards/routes.ts` — move the router AND fold the
      controller into it.
      Build the file from `src/routes/credit-card-routes.ts` + 
      `src/controllers/credit-card-controller.ts`. Imports:
      `import { Router } from 'express'` and
      `import type { NextFunction, Request, Response } from 'express'`;
      `import * as service from './service'`;
      `import type { CreateCardInput, UpdateCardInput } from './types'`;
      `import type { CreateCardBody, UpdateCardBody } from './schemas'`;
      `import { validateBody, validateParams } from '../middleware/validate'`;
      `import { cardIdParamSchema, createCardSchema, updateCardSchema } from './schemas'`.
      Paste the controller's `asyncHandler` helper and the five handlers
      (`listCards`, `getCard`, `createCard`, `updateCard`, `deleteCard`) verbatim,
      then the router wiring verbatim (same paths, same per-route middleware order,
      same 200/201/204 codes and `{ data }` / 204-no-body responses). Export the
      router. Keep the export name `creditCardRouter` to minimize churn in app.ts.
      Files: create `src/credit-cards/routes.ts`.
      Verify: `npx tsc --noEmit` reports no errors in the new file.

- [ ] 7. Update `src/app.ts` import path for the router.
      Change `import { creditCardRouter } from './routes/credit-card-routes';` to
      `import { creditCardRouter } from './credit-cards/routes';`. Leave everything
      else untouched: `/health`, middleware order (cors → `express.json({ limit:
      '10kb' })` → router → `notFoundHandler` → `errorHandler`), and the mount
      `app.use('/api/v1/credit-cards', creditCardRouter)`.
      Files: modify `src/app.ts`.
      Verify: `npx tsc --noEmit` — app.ts resolves the new module.

- [ ] 8. Update the unit test import path.
      In `tests/card-validator.test.ts`, change the import source
      `'../src/validation/card-validator'` → `'../src/credit-cards/card-validator'`.
      Do NOT change any assertion (including the pre-existing DISCOVER one noted
      above). The integration test (`tests/credit-cards.integration.test.ts`) needs
      NO change: it imports `createApp` from `'../src/app'` and dynamically imports
      `'../src/database/pool'`, both unchanged. `tests/helpers/test-db.ts`,
      `tests/helpers/jest.setup.ts`, and `jest.config.js` need no path changes —
      confirm by reading they only reference `src/database/*` and `src/app`.
      Files: modify `tests/card-validator.test.ts`.
      Verify: covered by step 10.

- [ ] 9. Delete the now-empty old files and directories (no dead files).
      Remove: `src/types/credit-card.ts`, `src/validation/card-validator.ts`,
      `src/validation/schemas.ts`, `src/security/card-fingerprint.ts`,
      `src/repositories/credit-card-repository.ts`,
      `src/services/credit-card-service.ts`,
      `src/controllers/credit-card-controller.ts`,
      `src/routes/credit-card-routes.ts`, and then the directories
      `src/types/`, `src/validation/`, `src/security/`, `src/repositories/`,
      `src/services/`, `src/controllers/`, `src/routes/` (all should be empty after
      the file removals — confirm each is empty before removing). Do NOT touch
      `src/config/`, `src/database/`, `src/errors/`, `src/middleware/`.
      Files: delete the 8 files and 7 now-empty directories listed above.
      Verify: `grep -rn "types/credit-card\|validation/card-validator\|validation/schemas\|security/card-fingerprint\|repositories/credit-card-repository\|services/credit-card-service\|controllers/credit-card-controller\|routes/credit-card-routes" src tests`
      returns no matches (no lingering references to old paths).

- [ ] 10. Full verification — build, typecheck, and tests.
      Run, from the project root, in order:
      1. `npm run typecheck` — expect exit 0, no errors.
      2. `npm run build` — expect exit 0 (produces `dist/`; `tsc` with the existing
         config).
      3. `npm run test:unit` — expect 22 assertions passing and exactly ONE failing:
         the pre-existing `detectBrand('6011000000000004')` DISCOVER assertion at
         `tests/card-validator.test.ts:60`. This matches the baseline recorded
         before the refactor; no NEW failures are acceptable. (If you prefer a fully
         green run you must NOT change validator behavior — the assertion is wrong
         relative to current DISCOVER support, and fixing it is out of scope.)
      4. `npm test` — the integration suite auto-skips when no test PostgreSQL is
         available (prints `[integration] PostgreSQL de pruebas no disponible`),
         so expect those `dbIt` cases to no-op; the unit suite result is as in (3).
         If a test DB is available (`NODE_ENV=test PGDATABASE=credit_cards_test`),
         all integration cases must pass.
      Files: none (verification only).
      Verify: typecheck + build exit 0; unit results match the baseline (22 pass /
      1 pre-existing fail); integration unchanged.

## Notes / assumptions

- The `creditCardRouter` export name is kept (not renamed) so `app.ts` changes by
  one path only and no other reference churns. This satisfies "update the export
  name if renamed" — nothing is renamed, so nothing else changes.
- Final `src/credit-cards/` contents: `card-validator.ts`, `types.ts`,
  `schemas.ts`, `repository.ts`, `service.ts`, `routes.ts` (6 files, down from 8).
- No `git commit` is created; changes are left uncommitted per the task.
