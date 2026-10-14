# Restructure into credit-cards + workers examples sharing one Express server

The backend was split into two self-contained examples under `src/`: the existing credit-cards API moved wholesale into `src/credit-cards/` (with domain files nested one level deeper under the singular `credit-card/` subfolder), and a brand-new `src/workers/` example was ported from the `feature/javascript-workers` branch's `index.js` + `heavy-cpu-worker.js` to strict TypeScript. Both routers mount on one shared `app.ts`/`server.ts`, under `/api/v1/credit-cards` and `/api/v1/workers`. The README was rewritten in Spanish as a single simpler doc covering both examples. All moves were done with `git mv` (history preserved), no runtime dependency was added, and no commit was created.

Watch for: nothing blocking. The one failing unit assertion (`detectBrand('6011000000000004')` returns `'DISCOVER'` instead of `null`) is the known PRE-EXISTING DISCOVER baseline failure, out of scope, and the coder correctly left validation untouched (confirmed). (confirmed)

**Verdict**: APPROVED

## High-level view

The target tree is realized exactly. `src/credit-cards/` holds `config/`, `credit-card/`, `database/`, `errors/`, `middleware/`, `test/`, `docs/`; the six domain files (`card-validator`, `types`, `schemas`, `repository`, `service`, `routes`) sit under `credit-card/` and no stale `.ts` remains at the `src/credit-cards/` root. `src/workers/` holds `heavy-cpu-worker/` and `endpoints/`. `app.ts` and `server.ts` are at the `src/` root. Every old location (`src/config`, `src/database`, `src/errors`, `src/middleware`, root `tests/`, root `docs/`) is gone.

Import depths were corrected and verified by a clean `tsc --noEmit` (strict + noUnusedLocals/Parameters + exactOptionalPropertyTypes), per the verification note. The infra files kept their `../X` strings (they moved together), the domain files kept theirs symmetrically, and the moved tests/helpers had their `../src/...` prefixes rewritten to the new relative depths.

The credit-cards external API is untouched: `creditCardRouter` is still exported from `credit-card/routes.ts`, mounted at `/api/v1/credit-cards`, with the same methods, 200/201/204 codes, `{ data }` envelope, and `{ error: { code, message, details? } }` shape. The global `GET /health -> { status: 'ok' }` and the middleware order (conditional cors, `express.json({ limit: '10kb' })`, routers, notFoundHandler, errorHandler) are preserved.

The workers port is faithful to the task spec: the six routes with the exact response bodies, the worker thread guarding `parentPort` for null, a shared finite `HEAVY_ITERATIONS = 5_000_000_000` const with a Spanish comment used by both the block route and the worker file, and worker path resolution that picks the extension from `__filename` and uses `{ execArgv: ['-r', 'ts-node/register/transpile-only'] }` for the `.ts` dev case. The build emits `dist/workers/heavy-cpu-worker/heavy-cpu-worker.js`.

Config and the README track the move: `jest.config.js` roots/setupFiles point at `src/credit-cards/test`, the `migrate` script repoints to `src/credit-cards/database/migrate.ts`, no deps changed, and the README is one unified Spanish doc with separate Credit Cards and Workers sections, the new architecture tree, worker curl examples, and doc links repointed to `src/credit-cards/docs/`.

<details>
<summary>Issues (0)</summary>

No blocking or non-blocking issues. The DISCOVER baseline unit failure is pre-existing and out of scope.

</details>

<details>
<summary>Details</summary>

### Target structure achieved

`ls` confirms `src/credit-cards/*.ts` matches nothing (no stale domain files at the root) and `src/credit-cards/credit-card/` contains exactly the six domain files. The old dirs `src/config`, `src/database`, `src/errors`, `src/middleware`, root `tests/`, root `docs/` all return "No such file or directory". The git status shows all moves as `renamed:` entries, so history is preserved and content for pure moves is byte-identical — including the migration SQL (listed as `renamed: src/database/migrations/001_create_credit_cards.sql -> src/credit-cards/database/migrations/...`), which satisfies the invariant that migration content is unchanged. (confirmed)

### Import paths fixed for the new depths

The infra and domain `../X` strings were kept because siblings and domain files moved symmetrically under `src/credit-cards/`; the authority here is the clean typecheck recorded in the verification note, not visual inspection. The moved tests were the files that genuinely needed rewrites, and the diff shows them done correctly: `card-validator.test.ts` `'../src/credit-cards/card-validator'` -> `'../credit-card/card-validator'`; `credit-cards.integration.test.ts` `'../src/app'` -> `'../../app'` and the dynamic `import('../src/database/pool')` -> `import('../database/pool')`; `helpers/test-db.ts` `'../../src/database/pool'` and `'../../src/database/migrate'` -> `'../../database/...'`. These resolve correctly from `src/credit-cards/test/`. (confirmed)

### Shared app mounts both routers, credit-cards API preserved

`src/app.ts` imports `getCorsOrigins` from `./credit-cards/config/env`, `creditCardRouter` from `./credit-cards/credit-card/routes`, `errorHandler`/`notFoundHandler` from `./credit-cards/middleware/error-handler`, and the new `workersRouter` from `./workers/endpoints/workers-routes`. Middleware order is unchanged: conditional cors (only when origins exist), `express.json({ limit: '10kb' })`, global `GET /health -> { status: 'ok' }` (status 200), then `app.use('/api/v1/credit-cards', creditCardRouter)`, `app.use('/api/v1/workers', workersRouter)`, then `notFoundHandler`, then `errorHandler`. `creditCardRouter` is still the export from `credit-card/routes.ts` and its endpoint/method/status wiring is unchanged by the diff. `server.ts` only had its two import paths repointed under `credit-cards/`; behavior unchanged. (confirmed)

### Workers TS conversion

`workers-routes.ts` defines the six routes with the exact bodies from the task: `/` -> `{ message: 'Hello World' }`, `/health` -> `{ status: 'ok', active: true }` (distinct from the global `/health`), `/fast`, `/slow-io` (4s setTimeout), `/heavy-cpu-block` (synchronous loop on the main thread), `/heavy-cpu-worker` (spawns the worker). The worker path resolution derives `ext` from `__filename` and branches: `.ts` -> `new Worker(path, { execArgv: ['-r', 'ts-node/register/transpile-only'] })`, else plain `new Worker(path)`, with `message`/`error`/`exit` handlers wired. `heavy-cpu-worker.ts` guards `parentPort` for null before `postMessage`. Both the block route and the worker file import the same `HEAVY_ITERATIONS` from `worker-config.ts`, which exports `5_000_000_000` with a Spanish comment explaining it replaces the near-infinite original loop. Imports use `node:` prefixes; no new runtime dependency was introduced (`ts-node` is a pre-existing devDependency). (confirmed)

### Config and build

`jest.config.js` roots -> `['<rootDir>/src/credit-cards/test']` and setupFiles -> `['<rootDir>/src/credit-cards/test/helpers/jest.setup.ts']`, with testMatch/preset/env/timeout/clearMocks unchanged. `package.json` repoints only the `migrate` script to `src/credit-cards/database/migrate.ts` (numstat 1/1, dependency blocks untouched). The verification note records `npm run build` emitting `dist/workers/heavy-cpu-worker/heavy-cpu-worker.js` plus `dist/workers/endpoints/workers-routes.js`, `dist/credit-cards/credit-card/routes.js`, `dist/app.js`, `dist/server.js`, so tsconfig covers the new tree without edits. `.env`, `.env.example`, `serviceAccountKey.json` are not in the change set. (confirmed)

### Style

The new workers files use Spanish comments, English identifiers, `const` except for the loop counters where `let` is required (reassigned, with a Spanish comment noting it), single quotes, and 2-space indentation — consistent with the repo's strict TS config that the typecheck passed under. (confirmed)

### README

Rewritten as one Spanish document: intro framing two independent examples on one Express server, an architecture block matching the new tree, a "Cómo ejecutar" section, a condensed "Credit Cards" section (stack, endpoints, security notes, how to test) with doc links repointed to `src/credit-cards/docs/curl-examples.md` and `src/credit-cards/docs/postman_collection.json`, and an expanded "Workers" section documenting all six routes with a what-to-observe note and curl examples under `/api/v1/workers`. (confirmed)

### Test evidence (not re-run)

Per `verification.md`: typecheck PASS (exit 0), build PASS (exit 0), unit `22 passed / 1 failed` and full suite `48 passed / 1 failed` with the integration suite self-skipping gracefully without a DB. The single failure is `card-validator.test.ts:60` `expect(detectBrand('6011000000000004')).toBeNull()`, which is the pre-existing DISCOVER baseline failure the task explicitly scopes out; the diff of `card-validator.test.ts` shows only the import path changed, and no validation source was altered to force it to pass. (confirmed)

</details>

<details>
<summary>File map</summary>

- `src/credit-cards/{config,database,errors,middleware}/**` — infra moved wholesale via `git mv` (content unchanged).
- `src/credit-cards/credit-card/{card-validator,types,schemas,repository,service,routes}.ts` — six domain files moved one level deeper.
- `src/credit-cards/database/migrations/001_create_credit_cards.sql` — moved, content unchanged.
- `src/credit-cards/docs/{curl-examples.md,postman_collection.json}` — docs moved into the example.
- `src/credit-cards/test/**` — tests + helpers moved; import prefixes rewritten to new depths.
- `src/workers/heavy-cpu-worker/worker-config.ts` — new: shared finite `HEAVY_ITERATIONS` const.
- `src/workers/heavy-cpu-worker/heavy-cpu-worker.ts` — new: TS worker thread, guards `parentPort`.
- `src/workers/endpoints/workers-routes.ts` — new: `workersRouter` with six routes + worker spawn.
- `src/app.ts` — mounts both routers; middleware order preserved.
- `src/server.ts` — import paths repointed under `credit-cards/`.
- `jest.config.js`, `package.json` — roots/setup/migrate paths repointed; no deps added.
- `README.md` — rewritten as one unified Spanish doc for both examples.

Full diff: `git -C <repo> diff` and `git -C <repo> diff --staged`.

</details>
