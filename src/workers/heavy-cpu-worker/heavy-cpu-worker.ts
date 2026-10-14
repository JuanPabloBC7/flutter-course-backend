/**
 * WORKER THREAD: CPU PESADA FUERA DEL HILO PRINCIPAL
 *
 * Este archivo corre en un hilo separado (worker_threads). El bucle intensivo
 * se ejecuta aquí, por lo que el Event Loop del hilo principal queda LIBRE y
 * puede seguir atendiendo /fast, /slow-io, etc. mientras esto trabaja.
 */

import { parentPort } from 'node:worker_threads';
import { HEAVY_ITERATIONS } from './worker-config';

console.time('heavy-cpu-worker');

// Mismo bucle intensivo que /heavy-cpu-block, pero aislado en el worker.
// `let` es necesario porque el contador se reasigna en cada iteración.
for (let i = 0; i < HEAVY_ITERATIONS; i += 1) {
  // Trabajo de CPU intencionalmente vacío: solo quema ciclos.
}

console.timeEnd('heavy-cpu-worker');

// Avisar al hilo principal que terminó para que responda la petición.
// Se protege contra null: parentPort es null si el archivo no corre como worker.
if (parentPort) {
  parentPort.postMessage({
    message: 'CPU terminada en el worker. El Event Loop NUNCA se bloqueó.',
  });
}
