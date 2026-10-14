/**
 * Rutas del ejemplo de workers bajo /api/v1/workers.
 *
 * Demuestran el Event Loop de Node.js y los worker_threads: cómo una carga de
 * CPU sincrónica bloquea el hilo principal frente a cómo delegarla a un worker
 * lo mantiene libre. No contienen lógica de negocio.
 */

import path from 'node:path';
import { Worker } from 'node:worker_threads';
import { Router } from 'express';
import { HEAVY_ITERATIONS } from '../heavy-cpu-worker/worker-config';

export const workersRouter = Router();

// GET /api/v1/workers — saludo básico.
workersRouter.get('/', (_req, res) => {
  res.json({ message: 'Hello World' });
});

// GET /api/v1/workers/health — salud del ejemplo (no colisiona con el /health global).
workersRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', active: true });
});

// GET /api/v1/workers/fast — ruta rápida: el Event Loop responde al instante.
// Úsala como "termómetro": si tarda, el Event Loop está bloqueado.
workersRouter.get('/fast', (_req, res) => {
  res.json({ status: 'ok', message: 'Respuesta rapida (Event Loop libre)' });
});

// GET /api/v1/workers/slow-io — I/O no bloqueante: setTimeout delega la espera
// al sistema (libuv) y el Event Loop sigue libre durante los 4 segundos.
workersRouter.get('/slow-io', (_req, res) => {
  setTimeout(() => {
    res.json({ message: 'I/O resuelto despues de 4 seg' });
  }, 4000);
});

// GET /api/v1/workers/heavy-cpu-block — CPU pesada EN el hilo principal.
// El bucle es sincrono: bloquea el Event Loop a proposito, por lo que /fast y
// cualquier otra ruta quedan congeladas hasta que termine.
workersRouter.get('/heavy-cpu-block', (_req, res) => {
  console.time('heavy-cpu-block');
  // `let` es necesario porque el contador se reasigna en cada iteración.
  for (let i = 0; i < HEAVY_ITERATIONS; i += 1) {
    // Trabajo de CPU intencionalmente vacío: solo quema ciclos.
  }
  console.timeEnd('heavy-cpu-block');
  res.json({ message: 'CPU terminada. El Event loop estuvo secuestrado.' });
});

// GET /api/v1/workers/heavy-cpu-worker — la misma carga, pero en un worker thread.
// El Event Loop del hilo principal queda LIBRE: /fast sigue respondiendo al
// instante mientras el worker calcula. Al terminar, el worker avisa y respondemos.
workersRouter.get('/heavy-cpu-worker', (_req, res) => {
  console.time('heavy-cpu-worker (main)');

  // Elegir la extensión según el archivo en ejecución: .ts en dev (ts-node-dev),
  // .js en producción (código ya compilado en dist/).
  const ext = __filename.endsWith('.ts') ? 'ts' : 'js';
  const workerPath = path.join(
    __dirname,
    '..',
    'heavy-cpu-worker',
    `heavy-cpu-worker.${ext}`,
  );

  // En dev el worker debe transpilar TypeScript al vuelo con ts-node; en
  // producción ya es un .js y no requiere execArgv adicional.
  const worker =
    ext === 'ts'
      ? new Worker(workerPath, {
          execArgv: ['-r', 'ts-node/register/transpile-only'],
        })
      : new Worker(workerPath);

  // Cuando el worker termina, envía el resultado y respondemos la petición.
  worker.on('message', (result: unknown) => {
    console.timeEnd('heavy-cpu-worker (main)');
    res.json(result);
  });

  // Manejo de error del worker.
  worker.on('error', (err: Error) => {
    res.status(500).json({ error: err.message });
  });

  // Aviso si el worker termina con un código distinto de 0.
  worker.on('exit', (code: number) => {
    if (code !== 0) {
      console.error(`Worker finalizo con codigo de salida ${code}`);
    }
  });
});
