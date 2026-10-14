/**
 * Punto de entrada: arranca el servidor HTTP y gestiona el apagado ordenado.
 */

import type { Server } from 'node:http';
import { createApp } from './app';
import { env } from './credit-cards/config/env';
import { closePool } from './credit-cards/database/pool';

const app = createApp();

const server: Server = app.listen(env.PORT, () => {
  console.log(`[server] Escuchando en http://localhost:${env.PORT} (${env.NODE_ENV})`);
});

/**
 * Apagado ordenado: deja de aceptar conexiones, cierra el servidor HTTP y
 * libera el pool de PostgreSQL. Evita conexiones colgadas.
 */
async function shutdown(signal: string): Promise<void> {
  console.log(`[server] Señal ${signal} recibida. Cerrando...`);

  // Dejar de aceptar nuevas conexiones y esperar a cerrar el servidor
  await new Promise<void>((resolve) => {
    server.close(() => resolve());
  });

  // Cerrar el pool de la base de datos
  await closePool().catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'desconocido';
    console.error('[server] Error al cerrar el pool:', message);
  });

  console.log('[server] Apagado completo.');
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
