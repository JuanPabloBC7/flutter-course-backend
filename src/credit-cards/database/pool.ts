import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { env } from '../config/env';

/**
 * Pool de conexiones a PostgreSQL.
 * Un único pool compartido por toda la aplicación; pg reutiliza y recicla
 * las conexiones internamente.
 */
export const pool = new Pool({
  host: env.PGHOST,
  port: env.PGPORT,
  user: env.PGUSER,
  password: env.PGPASSWORD,
  database: env.PGDATABASE,
  max: env.PG_POOL_MAX,
  // SSL opcional para entornos gestionados
  ssl: env.PG_SSL ? { rejectUnauthorized: false } : false,
});

// Evitar que un error inesperado del pool tumbe el proceso sin registro
pool.on('error', (err: Error) => {
  // No se filtran datos sensibles: solo el mensaje del error de conexión
  console.error('[db] Error inesperado en el pool de PostgreSQL:', err.message);
});

/**
 * Ejecuta una consulta parametrizada.
 * El uso de `params` garantiza consultas preparadas y previene inyección SQL.
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as unknown[]);
}

/**
 * Ejecuta una función dentro de una transacción.
 * Hace COMMIT si todo va bien y ROLLBACK ante cualquier error.
 */
export async function withTransaction<T>(
  handler: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await handler(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    // Siempre devolver la conexión al pool
    client.release();
  }
}

/** Cierra el pool de forma ordenada (para apagado o fin de pruebas). */
export async function closePool(): Promise<void> {
  await pool.end();
}
