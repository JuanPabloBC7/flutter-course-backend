# Implementation Plan — Restructure into credit-cards + workers examples

Goal: split `src/` into TWO self-contained examples (`credit-cards/` and `workers/`)
sharing ONE Express server, add a new TS-converted `workers` example, keep build +
tests green, and preserve the EXACT credit-cards external HTTP API.

Style rules (enforce in every new/edited file): Spanish code comments; English
identifiers; strict TypeScript; `const` over `let`, never `var`; single quotes;
2-space indentation. NO new runtime dependencies. NO git commit. Do NOT merge or
check out `feature/javascript-workers` (only `git show`).

Shell note: `find` is DENIED. Use git / tsc / jest / npm / ls directly.

## Target structure (recap)

```
src/
├── credit-cards/
│   ├── config/            (env.ts)
│   ├── credit-card/       (card-validator, types, schemas, repository, service, routes)
│   ├── database/          (pool.ts, migrate.ts, migrations/001_create_credit_cards.sql)
│   ├── errors/            (app-error.ts)
│   ├── middleware/        (error-handler.ts, validate.ts)
│   ├── test/              (card-validator.test.ts, credit-cards.integration.test.ts, helpers/)
│   └── docs/              (curl-examples.md, postman_collection.json)
├── workers/
│   ├── heavy-cpu-worker/  (heavy-cpu-worker.ts, worker-config.ts)
│   └── endpoints/         (workers-routes.ts -> workersRouter)
├── app.ts                 (shared; mounts both routers)
└── server.ts              (shared; single entry point)
```

Note the intentional singular `credit-card/` subfolder holding the domain code.

## Import-depth reference (after moves)

Files that move DEEPER gain one `../` segment to reach siblings that also moved.
Because config/database/errors/middleware all move together INTO `src/credit-cards/`,
and the domain files move INTO `src/credit-cards/credit-card/` (one level deeper),
the net relative changes are:

- `credit-cards/credit-card/*.ts` reaching `config|errors|database|middleware`:
  was `../config` → now `../config` is WRONG; correct is `../config` relative to
  `credit-card/` = `../config` resolves to `src/credit-cards/config`. Concretely:
  from `src/credit-cards/credit-card/X.ts`, sibling-infra lives at
  `src/credit-cards/config` → import path `../config/...`,
  `../errors/...`, `../database/...`, `../middleware/...`. (Same text as before, but
  now correct because BOTH moved under `credit-cards/`.)
- `credit-cards/config|database|errors|middleware/*.ts` importing each other keep
  their existing relative paths (they all moved together, same relative distance).

Verify each edit by typecheck, not by eye.

---

- [ ] 1. Create new target directories.
      Create: `src/credit-cards/config/`, `src/credit-cards/credit-card/`,
      `src/credit-cards/database/migrations/`, `src/credit-cards/errors/`,
      `src/credit-cards/middleware/`, `src/credit-cards/test/helpers/`,
      `src/credit-cards/docs/`, `src/workers/heavy-cpu-worker/`,
      `src/workers/endpoints/`.
      Files: directories only.
      Verify: `ls src/credit-cards src/workers` shows the new folders.

- [ ] 2. Move credit-cards infra folders with git (preserve history).
      Run from repo root: `git mv src/config src/credit-cards/config`,
      `git mv src/database src/credit-cards/database`,
      `git mv src/errors src/credit-cards/errors`,
      `git mv src/middleware src/credit-cards/middleware`.
      This moves `env.ts`, `pool.ts`, `migrate.ts`, `migrations/001_create_credit_cards.sql`,
      `app-error.ts`, `error-handler.ts`, `validate.ts` wholesale.
      Files: moved as above (no content edits yet).
      Verify: `ls src/credit-cards/config src/credit-cards/database/migrations src/credit-cards/errors src/credit-cards/middleware` lists the files; `ls src/config` fails (gone).

- [ ] 3. Move the domain files into the singular `credit-card/` subfolder.
      Run: `git mv src/credit-cards/card-validator.ts src/credit-cards/credit-card/card-validator.ts`
      and the same for `types.ts`, `schemas.ts`, `repository.ts`, `service.ts`, `routes.ts`.
      These six files currently sit at `src/credit-cards/` root and must NOT remain there.
      Files: six domain files moved.
      Verify: `ls src/credit-cards/credit-card` lists all six; `ls src/credit-cards/*.ts` returns nothing.

- [ ] 4. Fix import paths inside the moved domain files (now one level deeper).
      In `src/credit-cards/credit-card/service.ts`: change `'../errors/app-error'` to
      `'../errors/app-error'` (resolves to `src/credit-cards/errors/app-error` — same text,
      now correct); confirm `'./card-validator'`, `'./repository'`, `'./types'` unchanged.
      In `src/credit-cards/credit-card/card-validator.ts`: `'../config/env'` stays as
      `'../config/env'` (now `src/credit-cards/config/env`). `'./types'` unchanged.
      In `src/credit-cards/credit-card/repository.ts`: `'../database/pool'` stays
      `'../database/pool'` (now `src/credit-cards/database/pool`). `'./types'` unchanged.
      In `src/credit-cards/credit-card/routes.ts`: `'../middleware/validate'` stays
      `'../middleware/validate'` (now `src/credit-cards/middleware/validate`); local
      `'./schemas'`, `'./service'`, `'./types'` unchanged.
      `schemas.ts` and `types.ts` only import locally — no change.
      Files: service.ts, card-validator.ts, repository.ts, routes.ts (verify, likely no textual change needed since depth is preserved).
      Verify: deferred to step 10 typecheck. (Rationale: the `../` prefix count is unchanged because every sibling moved together one level up AND the domain files moved one level down symmetrically — net result the existing `../X` strings still resolve. Do NOT blindly rewrite; typecheck confirms.)

- [ ] 5. Fix cross-imports among the moved infra files (depth unchanged, confirm only).
      `src/credit-cards/database/pool.ts` imports `'../config/env'` → still
      `src/credit-cards/config/env`. ✔
      `src/credit-cards/database/migrate.ts` imports `'./pool'` → unchanged. ✔
      `src/credit-cards/middleware/error-handler.ts` imports `'../errors/app-error'` →
      still `src/credit-cards/errors/app-error`. ✔
      `src/credit-cards/middleware/validate.ts` imports `'../errors/app-error'` → ✔.
      Files: no edits expected; this is a confirmation step.
      Verify: deferred to step 10 typecheck.

- [ ] 6. Move docs into the example folder.
      Run: `git mv docs/curl-examples.md src/credit-cards/docs/curl-examples.md` and
      `git mv docs/postman_collection.json src/credit-cards/docs/postman_collection.json`.
      Files: both docs moved.
      Verify: `ls src/credit-cards/docs` lists both; `ls docs` fails (empty dir removed by git mv of last contents — if an empty `docs/` remains, remove it with `rmdir docs`).

- [ ] 7. Move tests into `src/credit-cards/test/` and fix their imports.
      Run: `git mv tests/card-validator.test.ts src/credit-cards/test/card-validator.test.ts`,
      `git mv tests/credit-cards.integration.test.ts src/credit-cards/test/credit-cards.integration.test.ts`,
      `git mv tests/helpers/jest.setup.ts src/credit-cards/test/helpers/jest.setup.ts`,
      `git mv tests/helpers/test-db.ts src/credit-cards/test/helpers/test-db.ts`.
      Then fix imports (tests now live at `src/credit-cards/test/`, two levels under `src/`):
      - `card-validator.test.ts`: `'../src/credit-cards/card-validator'` →
        `'../credit-card/card-validator'`.
      - `credit-cards.integration.test.ts`: `'../src/app'` → `'../../../app'`;
        keep `'./helpers/test-db'` unchanged; the dynamic
        `await import('../src/database/pool')` → `await import('../database/pool')`
        (now `src/credit-cards/database/pool`).
      - `helpers/test-db.ts`: `'../../src/database/pool'` → `'../../database/pool'` and
        `'../../src/database/migrate'` → `'../../database/migrate'`.
      - `helpers/jest.setup.ts`: no imports — unchanged.
      Files: 2 test files + 2 helper files edited; `tests/` dir removed.
      Verify: `ls tests` fails; `ls src/credit-cards/test src/credit-cards/test/helpers` lists all four files. Full verify in step 11/13.

- [ ] 8. Create the shared workers constant module.
      Create `src/workers/heavy-cpu-worker/worker-config.ts` exporting
      `export const HEAVY_ITERATIONS = 5_000_000_000;` with a Spanish comment: this is a
      deliberately heavy-but-FINITE loop count to demo Event Loop blocking vs offloading
      (replaces the original effectively-infinite loop). Both the route and the worker
      import this SAME constant.
      Files: src/workers/heavy-cpu-worker/worker-config.ts
      Verify: deferred to step 10 typecheck.

- [ ] 9. Create the worker-thread file (TS port of heavy-cpu-worker.js).
      Create `src/workers/heavy-cpu-worker/heavy-cpu-worker.ts`:
      - `import { parentPort } from 'node:worker_threads';`
      - `import { HEAVY_ITERATIONS } from './worker-config';`
      - Run the busy loop: `for (let i = 0; i < HEAVY_ITERATIONS; i += 1) {}` with a
        Spanish comment (same intensive loop as /heavy-cpu-block but isolated here).
      - Guard parentPort for null: `if (parentPort) { parentPort.postMessage({ message: 'CPU terminada en el worker. El Event Loop NUNCA se bloqueó.' }); }`
      - Keep `console.time`/`console.timeEnd('heavy-cpu-worker')` around the loop (optional, matches original intent).
      - This loop index is a counter where `let` is required (reassigned) — allowed; prefer `const` elsewhere.
      Files: src/workers/heavy-cpu-worker/heavy-cpu-worker.ts
      Verify: deferred to step 10 typecheck.

- [ ] 10. Create the workers Express router (TS port of index.js routes).
      Create `src/workers/endpoints/workers-routes.ts`:
      - `import path from 'node:path';`, `import { Worker } from 'node:worker_threads';`,
        `import { Router } from 'express';`, `import { HEAVY_ITERATIONS } from '../heavy-cpu-worker/worker-config';`.
      - `export const workersRouter = Router();` with these router paths (mounted later under
        `/api/v1/workers`):
        - `GET '/'` → `res.json({ message: 'Hello World' })` (becomes /api/v1/workers).
        - `GET '/health'` → `res.json({ status: 'ok', active: true })` (becomes /api/v1/workers/health; does NOT collide with the global root /health).
        - `GET '/fast'` → `res.json({ status: 'ok', message: 'Respuesta rápida (Event Loop libre)' })`.
        - `GET '/slow-io'` → `setTimeout(() => res.json({ message: 'I/O resuelto después de 4 seg' }), 4000)`.
        - `GET '/heavy-cpu-block'` → synchronous `for (let i = 0; i < HEAVY_ITERATIONS; i += 1) {}`
          on the main thread, then `res.json({ message: 'CPU terminada. El Event loop estuvo secuestrado.' })`.
          Spanish comment: bloquea el Event Loop a propósito.
        - `GET '/heavy-cpu-worker'` → spawn a Worker thread (see path resolution below),
          `worker.on('message', (result) => res.json(result))`,
          `worker.on('error', (err) => res.status(500).json({ error: err.message }))`,
          `worker.on('exit', (code) => { if (code !== 0) console.error(...) })`.
      - WORKER PATH RESOLUTION (must work under `npm run dev` ts-node-dev AND compiled dist):
        ```ts
        // Elegir extensión según el archivo en ejecución: .ts en dev, .js en producción.
        const ext = __filename.endsWith('.ts') ? 'ts' : 'js';
        const workerPath = path.join(__dirname, '..', 'heavy-cpu-worker', `heavy-cpu-worker.${ext}`);
        // En dev el worker debe transpilar TS al vuelo; en producción ya es .js.
        const worker = ext === 'ts'
          ? new Worker(workerPath, { execArgv: ['-r', 'ts-node/register/transpile-only'] })
          : new Worker(workerPath);
        ```
        `__dirname` for this file is `.../workers/endpoints`, so `..` + `heavy-cpu-worker` reaches
        the worker folder correctly in both src and dist layouts. `ts-node` is a devDependency
        already present (no new dep). Add a Spanish comment explaining the execArgv branch.
      - Fallback (only if ts-node/register proves unreliable): resolve to the compiled dist
        `.js` and document that `/heavy-cpu-worker` under dev needs a prior `npm run build`.
        PREFER the execArgv approach.
      Files: src/workers/endpoints/workers-routes.ts
      Verify: `npm run typecheck` passes (covers steps 4,5,8,9,10 and the import fixes).

- [ ] 11. Rewrite the shared `src/app.ts` to mount BOTH routers.
      Edit `src/app.ts`:
      - Imports: `import { getCorsOrigins } from './credit-cards/config/env';`,
        `import { creditCardRouter } from './credit-cards/credit-card/routes';`,
        `import { workersRouter } from './workers/endpoints/workers-routes';`,
        `import { errorHandler, notFoundHandler } from './credit-cards/middleware/error-handler';`.
      - Keep middleware order EXACTLY: cors (only if `getCorsOrigins()` non-empty, methods
        `['GET','POST','PATCH','DELETE']`), `express.json({ limit: '10kb' })`, global
        `GET '/health'` → `{ status: 'ok' }`, then
        `app.use('/api/v1/credit-cards', creditCardRouter)`,
        `app.use('/api/v1/workers', workersRouter)`, then `notFoundHandler`, then `errorHandler`.
      Files: src/app.ts
      Verify: `npm run typecheck` passes.

- [ ] 12. Update `src/server.ts` import paths (behavior unchanged).
      Edit `src/server.ts`: `import { env } from './credit-cards/config/env';` and
      `import { closePool } from './credit-cards/database/pool';`. Keep `createApp` from `./app`.
      Everything else (listen on `env.PORT`, SIGINT/SIGTERM graceful shutdown) unchanged.
      Files: src/server.ts
      Verify: `npm run typecheck` passes.

- [ ] 13. Update `jest.config.js` roots/setup to the new test location.
      Edit `jest.config.js`: `roots: ['<rootDir>/src/credit-cards/test']`,
      `setupFiles: ['<rootDir>/src/credit-cards/test/helpers/jest.setup.ts']`.
      Keep `testMatch: ['**/*.test.ts']`, preset ts-jest, testEnvironment node, testTimeout, clearMocks.
      Files: jest.config.js
      Verify: `npm run test:unit` runs the validator unit tests and they PASS (unit tests
      need no DB). If the integration suite runs and no test DB is available, it self-skips
      with a console notice (expected) — the unit suite must pass.

- [ ] 14. Update `package.json` `migrate` script path.
      Edit `package.json`: `"migrate": "ts-node src/credit-cards/database/migrate.ts"`.
      Leave `build`, `start`, `dev` (src/server.ts), `test`, `test:unit` (jest --runInBand
      card-validator — still matches by filename), `typecheck` unchanged. Do NOT rename the
      project or add dependencies.
      Files: package.json
      Verify: `npm run typecheck` still passes; `migrate` path points at an existing file (`ls src/credit-cards/database/migrate.ts`).

- [ ] 15. Confirm tsconfig covers the new tree (likely no edit).
      `rootDir: 'src'` and `include: ['src/**/*.ts']` already include `src/workers/**` and
      `src/credit-cards/**`; `exclude: ['**/*.test.ts']` still keeps the moved tests out of
      the build. Confirm the worker `.ts` files compile so
      `dist/workers/heavy-cpu-worker/heavy-cpu-worker.js` exists for production. No edit
      expected; if any issue appears, adjust include/exclude minimally.
      Files: tsconfig.json (verify only).
      Verify: `npm run build` succeeds and `ls dist/workers/heavy-cpu-worker/heavy-cpu-worker.js dist/workers/endpoints/workers-routes.js dist/credit-cards/credit-card/routes.js dist/app.js dist/server.js` all exist.

- [ ] 16. Rewrite root `README.md` as ONE unified, simplified Spanish document.
      Edit `README.md`. Outline:
      - Title + one-paragraph intro: a learning backend with TWO independent examples on
        the SAME Express server (single `npm run dev` / `npm start`), mounted under
        `/api/v1/credit-cards` and `/api/v1/workers`.
      - Architecture section reflecting the NEW tree (the Target structure block above).
      - "Cómo ejecutar" section: install, `.env` note, `npm run migrate`, `npm run dev`,
        `npm start`, `npm test` / `npm run test:unit`.
      - Section "Credit Cards" (condensed to essentials): what it does, stack
        (Node 20, TS strict, Express 4, PostgreSQL+pg, zod, Jest+supertest), the 5 endpoints
        under `/api/v1/credit-cards` (GET list, GET :id, POST, PATCH :id, DELETE :id) with
        status codes 200/201/204 and the `{ data }` / `{ error: { code, message, details? } }`
        envelopes; brief security notes (no PAN/CVV stored, HMAC fingerprint, parameterized
        SQL, soft delete); how to test. Link examples to the NEW location:
        [`src/credit-cards/docs/curl-examples.md`](src/credit-cards/docs/curl-examples.md)
        and [`src/credit-cards/docs/postman_collection.json`](src/credit-cards/docs/postman_collection.json).
      - Section "Workers" (EXPANDED): explain it demos the Node.js Event Loop and
        `worker_threads`. List routes under `/api/v1/workers` with one line each:
        `/` (hello), `/health`, `/fast` (termómetro del Event Loop), `/slow-io`
        (I/O no bloqueante, ~4s), `/heavy-cpu-block` (bloquea el Event Loop),
        `/heavy-cpu-worker` (misma carga en un hilo aparte). What to observe: while
        `/heavy-cpu-block` runs, `/fast` is frozen; while `/heavy-cpu-worker` runs, `/fast`
        still responds. Mention the busy loop is a deliberately heavy-but-finite constant
        (`HEAVY_ITERATIONS`). Include curl examples for the worker routes, e.g.
        `curl http://localhost:4000/api/v1/workers/fast`,
        `curl http://localhost:4000/api/v1/workers/heavy-cpu-block`,
        `curl http://localhost:4000/api/v1/workers/heavy-cpu-worker`.
      Files: README.md
      Verify: manual read — links resolve to existing files
      (`ls src/credit-cards/docs/curl-examples.md src/credit-cards/docs/postman_collection.json`);
      structure block matches the real tree.

- [ ] 17. Cleanup: remove now-empty old directories and confirm no stragglers.
      Remove any leftover empty dirs: old `src/config`, `src/database`, `src/errors`,
      `src/middleware`, root `tests/`, root `docs/`. (git mv already removed most; use
      `rmdir <dir>` on any empty remainder, or `ls` to confirm they are gone.) Ensure NO
      domain `.ts` files remain at `src/credit-cards/` root (they moved to `credit-card/`).
      Files: directory removals only.
      Verify: `ls src/config src/database src/errors src/middleware tests docs` each fail;
      `ls src/credit-cards/*.ts` returns nothing.

## Final verification checklist (run in order, all must pass)

1. `npm run typecheck` → no TS errors (strict, noUnusedLocals/Parameters, exactOptionalPropertyTypes).
2. `npm run build` → compiles; `dist/workers/heavy-cpu-worker/heavy-cpu-worker.js`,
   `dist/workers/endpoints/workers-routes.js`, `dist/credit-cards/credit-card/routes.js`,
   `dist/app.js`, `dist/server.js` all exist.
3. `npm run test:unit` → card-validator unit tests PASS (no DB needed).
4. `npm test` → full suite; integration suite passes if a test DB is reachable, otherwise
   self-skips with a console notice (that is acceptable — it must NOT fail).
5. Manual smoke (optional, if a DB + run are available): `npm run dev`, then
   `curl :4000/health` → `{ "status": "ok" }`;
   `curl :4000/api/v1/workers` → `{ "message": "Hello World" }`;
   `curl :4000/api/v1/workers/fast` → fast JSON;
   `curl :4000/api/v1/workers/heavy-cpu-worker` → worker completion message (route works
   out of the box under dev via the execArgv ts-node branch).

## Invariants to preserve (do NOT break)

- Credit-cards external API unchanged: paths under `/api/v1/credit-cards`, methods, status
  codes 200/201/204, `{ data }` success envelope, `{ error: { code, message, details? } }`
  error format, all existing validations (Luhn, brand, expiration, CVV, duplicate detection,
  strict bodies, UUID param).
- DB schema / migration SQL content unchanged (only folder location moves).
- `migrate.ts` resolves migrations via `join(__dirname, 'migrations')`; moving `database/`
  wholesale keeps that working.
- Do NOT touch `.env`, `.env.example`, `serviceAccountKey.json`.
- No new runtime dependencies. No git commit. No merge/checkout of `feature/javascript-workers`.

## Assumptions

- The `../X` import strings inside the moved domain files remain textually correct because
  siblings and domain files moved symmetrically under `src/credit-cards/`; step 10's
  typecheck is the authority — fix any path the compiler flags.
- `ts-node` (devDependency, already installed) powers the Worker's `ts-node/register/transpile-only`
  under dev; no new dependency is introduced.
