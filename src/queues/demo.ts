/**
 * Interrupción de pila dinámica — Laboratorio 3, Paso 3.
 *
 * Demuestra el despacho no bloqueante: se cargan 5000 tareas lentas de
 * prioridad baja y, mientras se procesan, a los 2 segundos llegan 3
 * transacciones VIP (prioridad 10). Gracias a la reordenación por prioridad y a
 * que `_processLoop` cede el control con `setImmediate` en cada iteración, las
 * VIP se cuelan al frente y se procesan casi al instante, sin que el Event Loop
 * haya quedado colapsado.
 *
 * NOTA: el PDF lo llama `app.js`, pero aquí se llama `demo.ts` para no chocar
 * con el `src/app.ts` del servidor Express. Se ejecuta así:
 *   npx ts-node src/queues/demo.ts
 */

import { PriorityQueue } from './queue';

const q = new PriorityQueue();

// Inyección base bloqueante: 5000 reportes lentos de prioridad 1.
console.log('Cargando 5000 reportes lentos...');
for (let i = 0; i < 5000; i += 1) {
  q.add(`Rep-${i}`, { mock: true }, 1);
}

// Despacho no bloqueante en segundo plano.
q.start();

// Simulación de inyección asíncrona urgente a los 2 segundos.
setTimeout(() => {
  console.log('\n--- LLEGA TRAFICO VIP ---');
  q.add('Transf-A', { user: 'CEO' }, 10);
  q.add('Transf-B', { user: 'CFO' }, 10);
  q.add('Transf-C', { user: 'CTO' }, 10);
}, 2000);
