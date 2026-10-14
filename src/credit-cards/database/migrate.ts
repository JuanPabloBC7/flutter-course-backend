/**
 * Runner de migraciones versionadas.
 *
 * Lee los archivos .sql de ./migrations en orden alfabético y aplica los que
 * aún no se hayan ejecutado, registrándolos en la tabla schema_migrations.
 * Idempotente: se puede correr varias veces sin efectos adversos.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { closePool, pool, withTransaction } from './pool';

const MIGRATIONS_DIR = join(__dirname, 'migrations');

/** Crea la tabla de control de migraciones si no existe. */
async function ensureMigrationsTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

/** Devuelve el conjunto de migraciones ya aplicadas. */
async function getApplied(): Promise<Set<string>> {
  const result = await pool.query<{ filename: string }>(
    'SELECT filename FROM schema_migrations',
  );
  return new Set(result.rows.map((row) => row.filename));
}

async function runMigrations(): Promise<void> {
  await ensureMigrationsTable();
  const applied = await getApplied();

  // Tomar solo archivos .sql y ordenarlos por nombre (001_, 002_, ...)
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  let count = 0;
  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');

    // Cada migración corre en su propia transacción
    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename) VALUES ($1)',
        [file],
      );
    });

    console.log(`[migrate] Aplicada: ${file}`);
    count += 1;
  }

  if (count === 0) {
    console.log('[migrate] No hay migraciones pendientes.');
  } else {
    console.log(`[migrate] ${count} migración(es) aplicada(s).`);
  }
}

// Permitir ejecutar como script (npm run migrate) y también importar la función.
if (require.main === module) {
  runMigrations()
    .then(() => closePool())
    .then(() => process.exit(0))
    .catch(async (error: unknown) => {
      const message = error instanceof Error ? error.message : 'desconocido';
      console.error(`[migrate] Error al aplicar migraciones: ${message}`);
      await closePool().catch(() => undefined);
      process.exit(1);
    });
}

export { runMigrations };
