# Verification — restructure into credit-cards + workers examples

Refactor split `src/` into TWO self-contained examples sharing ONE Express
server. Credit-cards infra (`config/`, `database/`, `errors/`, `middleware/`)
moved under `src/credit-cards/`; the six domain files moved into
`src/credit-cards/credit-card/`; tests to `src/credit-cards/test/`; docs to
`src/credit-cards/docs/`. New `src/workers/` example ported from the
`feature/javascript-workers` branch (index.js + heavy-cpu-worker.js) to strict
TypeScript. Shared `src/app.ts` mounts both routers under
`/api/v1/credit-cards` and `/api/v1/workers`; `src/server.ts` unchanged in
behavior. No runtime dependencies added. No git commit created.

## Commands run (from project root)

1. `npm run typecheck` (`tsc --noEmit`) — PASS, exit 0, zero errors
   (strict + noUnusedLocals + noUnusedParameters + exactOptionalPropertyTypes).
2. `npm run build` (`tsc`) — PASS, exit 0.
3. `npm run test:unit` (`jest card-validator`) — 22 passed, 1 failed (total 23).
4. `NODE_ENV=test PGDATABASE=credit_cards_test npm test` — 48 passed, 1 failed
   (total 49). Integration suite SKIPS gracefully (no PostgreSQL): prints
   `[integration] PostgreSQL de pruebas no disponible` and the suite PASSES.

## Worker .js emitted: YES

`dist/workers/heavy-cpu-worker/heavy-cpu-worker.js` exists after `npm run build`.
Also confirmed present: `dist/workers/endpoints/workers-routes.js`,
`dist/credit-cards/credit-card/routes.js`, `dist/app.js`, `dist/server.js`.

## Worker path resolution (dev vs prod)

`workers-routes.ts` derives the worker path from `__dirname` and picks the
extension from the running file: `const ext = __filename.endsWith('.ts') ? 'ts' : 'js';`
then `path.join(__dirname, '..', 'heavy-cpu-worker', 'heavy-cpu-worker.' + ext)`.

- DEV (`npm run dev` via ts-node-dev): running file is `.ts`, so the Worker is
  created with `{ execArgv: ['-r', 'ts-node/register/transpile-only'] }` to
  transpile the worker on the fly. `ts-node` is an existing devDependency; no
  new dependency added. `/heavy-cpu-worker` works out of the box under dev.
- PROD (`npm start` via compiled dist): running file is `.js`, so the Worker is
  created with no execArgv and loads `dist/workers/heavy-cpu-worker/heavy-cpu-worker.js`.

## The single failing assertion is pre-existing baseline, not a regression

`src/credit-cards/test/card-validator.test.ts:60`
`expect(detectBrand('6011000000000004')).toBeNull()` fails because the validator
supports DISCOVER (6011...), so `detectBrand` returns `'DISCOVER'`. This failure
predates the refactor and is OUT OF SCOPE; validation behavior was left
unchanged. All other 22 unit assertions pass.

## Reference integrity

Old directories removed: `src/config`, `src/database`, `src/errors`,
`src/middleware`, root `tests/`, root `docs/`. No `.ts` domain files remain at
`src/credit-cards/` root. `grep` across `src/**/*.ts` finds no stale import
paths broken by the moves. External credit-cards HTTP API unchanged (paths,
methods, status codes 200/201/204, `{ data }` envelope, error shape).
