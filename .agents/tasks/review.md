# Credit-card code relocated into `src/credit-cards/` with controller folded into routes

The refactor moves every credit-card-specific module out of the per-layer directories (`types/`, `validation/`, `security/`, `repositories/`, `services/`, `controllers/`, `routes/`) into a single feature folder `src/credit-cards/`, collapsing eight files into six: `card-validator.ts`, `types.ts`, `schemas.ts`, `repository.ts`, `service.ts`, `routes.ts`. The thin controller layer disappears — its five handlers now live inside `routes.ts` — and the standalone fingerprint module is absorbed into `card-validator.ts` since it depends only on `normalizeCardNumber`. Shared infrastructure (`config/`, `database/`, `errors/`, `middleware/`, `app.ts`, `server.ts`) stays at the `src/` root untouched except for one import path in `app.ts`. The intent is a simpler, flatter structure that makes room for sibling example folders later, while preserving the exact HTTP API and all validation behavior.

Watch for: nothing blocking. The validation module, schemas, repository SQL, and service orchestration are byte-for-byte identical to the originals (confirmed), only import paths changed. The one failing unit assertion recorded in the evidence is a pre-existing DISCOVER baseline, unchanged by this diff and out of scope (confirmed).

**Verdict**: APPROVED

## High-level view

The move is a pure relocation. Every validation function (`normalizeCardNumber`, `isAllDigits`, `detectBrand`, `passesLuhn`, `validateCardNumber`, `validateExpiration`, `validateCvv`, `extractLast4`) and the brand/CVV length tables are character-identical to the deleted `src/validation/card-validator.ts`; the fingerprint HMAC was appended verbatim from the old `security/card-fingerprint.ts`. No logic was rewritten, so there is no behavioral surface to regress.

The zod schemas keep `.strict()` on both create and update bodies and keep the update `.refine()` that requires at least one of `creditLimit`/`status`. The service keeps its 404 (`NotFoundError`), 409 (`ConflictError` on both the pre-check and the `23505` unique-violation race), and the fingerprint-based duplicate detection. The repository SQL is unchanged, including the soft-delete filter on every read.

The external API is intact: `app.ts` still mounts `creditCardRouter` at `/api/v1/credit-cards` with the same middleware order (CORS, json limit, health, router, 404, error handler). Routes keep the same methods, validation middleware order, status codes (200/201/204), the `{ data }` envelope, and the `{ error: { code, message, details? } }` shape handed off to the central error handler.

Cleanup is complete: all seven old directories are gone, no `.ts` file references any old import path, and the integration test still resolves through `createApp`. The one known gap is a documented pre-existing test failure, not introduced here.

<details>
<summary>Issues (1)</summary>

1. **Pre-existing DISCOVER test assertion fails** — `tests/card-validator.test.ts:60` asserts `detectBrand('6011000000000004')` is `null`, but the validator supports DISCOVER so it returns `'DISCOVER'`. The line is untouched by this diff and the behavior predates the refactor; non-blocking and out of scope, but worth resolving separately (either fix the assertion or drop DISCOVER support deliberately).

</details>

<details>
<summary>Details</summary>

### Validation logic moved without edits

`card-validator.ts` is the sensitive core and is identical to the deleted `src/validation/card-validator.ts` line for line: the `BRAND_LENGTHS` table (`VISA: [13,16,19]`, `MASTERCARD: [16]`, `AMERICAN EXPRESS: [15]`, `DISCOVER: [16]`), the `BRAND_CVV_LENGTHS` table, the Luhn implementation, `detectBrand`'s prefix ranges, `validateExpiration`'s end-of-month computation with injectable `referenceDate`, and `validateCvv`/`extractLast4`. The only addition is `computeCardFingerprint`, appended verbatim from the removed `security/card-fingerprint.ts`, now importing `env` and `createHmac` directly — it shares `normalizeCardNumber` and nothing else depended on the separate security module. All exports the test imports, including `passesLuhn`, are present.

### Schemas keep strict parsing and the update refine

`schemas.ts` carries `.strict()` on both `createCardSchema` and `updateCardSchema`, so unknown fields are still rejected, and the update schema keeps the `.refine()` requiring at least one of `creditLimit` or `status`. Field constraints (userId 1–128, cardNumber 12–25, month 1–12, year 1970–2100, cvv 3–4, non-negative finite creditLimit) are unchanged. Only the `CARD_STATUSES` import source changed from `../types/credit-card` to `./types`.

### Service keeps 404/409 and duplicate detection

`service.ts` preserves the full create flow: accumulate `cardNumber`/`expiration`/`cvv` validation details, throw `ValidationError` with the collected `details` when any fail, skip CVV evaluation when the number is invalid (brand unknown), then compute fingerprint and pre-check `findActiveByUserAndFingerprint` throwing `ConflictError` on a hit. The insert is still wrapped so a `23505` unique-violation race also maps to `ConflictError`. `getCardById`/`updateCard`/`deleteCard` keep their `NotFoundError` paths, and `toPublic` still omits `card_fingerprint`, never exposing PAN or CVV. Imports now pull validation and fingerprint from the single `./card-validator`.

### Controller folded into routes, API surface unchanged

The five handlers from the deleted `controllers/credit-card-controller.ts` now sit at the top of `routes.ts` as module-local `const`s with the same `asyncHandler` wrapper, the same request/response mapping, and the same status codes (list/get 200, create 201, update 200, delete 204 with empty body). The router wiring keeps `validateParams(cardIdParamSchema)` and `validateBody(...)` in the same order on the same paths, so the external surface is unchanged.

### Mount point and cleanup verified

`app.ts` changed only the router import to `./credit-cards/routes`; it still mounts at `/api/v1/credit-cards` with CORS, the 10kb json limit, `/health`, the router, `notFoundHandler`, and `errorHandler` in the original order. All seven old directories (`src/types`, `src/validation`, `src/security`, `src/repositories`, `src/services`, `src/controllers`, `src/routes`) are deleted, a grep for every old import specifier returns no matches in `src/` or `tests/`, and the integration test resolves everything through `createApp` plus shared infra. No new dependencies.

### Test coverage

`tests/card-validator.test.ts` repoints its import to `../src/credit-cards/card-validator` and still pulls `passesLuhn` alongside the other exports, all of which exist. The evidence records 22 of 23 unit assertions passing and the integration suite skipping gracefully without PostgreSQL. Not re-run here per instructions; the recorded results are trusted.

Not tested by this change: the fingerprint relocation has no dedicated unit test, so `computeCardFingerprint` is exercised only indirectly through the integration path (which skips without a database). The move is verbatim so risk is low, but there is no direct assertion that the HMAC output is unchanged.

</details>

<details>
<summary>File map</summary>

- `src/credit-cards/card-validator.ts` — new; validation module verbatim plus `computeCardFingerprint` folded in from the old security module.
- `src/credit-cards/types.ts` — new; domain types verbatim from `src/types/credit-card.ts`.
- `src/credit-cards/schemas.ts` — new; zod schemas verbatim, `CARD_STATUSES` import repointed.
- `src/credit-cards/repository.ts` — new; SQL layer verbatim, type import repointed.
- `src/credit-cards/service.ts` — new; business logic verbatim, validation/fingerprint imports consolidated.
- `src/credit-cards/routes.ts` — new; router plus the folded-in controller handlers.
- `src/app.ts` — router import path updated to `./credit-cards/routes`; everything else unchanged.
- `tests/card-validator.test.ts` — import path updated to `../src/credit-cards/card-validator`.
- Deleted: `src/controllers/`, `src/repositories/`, `src/routes/`, `src/security/`, `src/services/`, `src/types/`, `src/validation/` (credit-card files).

Full diff: `git diff HEAD` at the project root (new files are untracked; `git add -N src/credit-cards` to see them in the diff).

</details>
