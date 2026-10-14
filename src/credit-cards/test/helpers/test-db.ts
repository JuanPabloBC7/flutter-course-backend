/**
 * Utilidades para pruebas de integración contra una base de datos de PRUEBAS.
 *
 * Seguridad: para evitar tocar producción por accidente, estas pruebas solo
 * corren si NODE_ENV=test. El runner de integración debe apuntar PGDATABASE a
 * una base de datos aislada de pruebas.
 */

import { pool, query } from '../../database/pool';
import { runMigrations } from '../../database/migrate';

/** Verifica si la base de datos de pruebas está accesible. */
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    await query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/** Aplica migraciones sobre la base de datos de pruebas. */
export async function setupSchema(): Promise<void> {
  await runMigrations();
}

/** Limpia la tabla de tarjetas para aislar cada prueba. */
export async function truncateCards(): Promise<void> {
  await query('TRUNCATE TABLE credit_cards RESTART IDENTITY CASCADE');
}

/** Cierra el pool al terminar la suite. */
export async function teardown(): Promise<void> {
  await pool.end();
}
