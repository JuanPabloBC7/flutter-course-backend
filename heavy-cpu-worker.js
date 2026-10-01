// --------------------------------------------------------------------------------
// WORKER THREAD: CPU PESADA FUERA DEL HILO PRINCIPAL
// Este archivo corre en un hilo separado (worker_threads). El bucle intensivo
// se ejecuta aquí, por lo que el Event Loop del hilo principal queda LIBRE y
// puede seguir atendiendo /fast, /slow-io, etc. mientras esto trabaja.
// --------------------------------------------------------------------------------
const { parentPort } = require('worker_threads');

console.time('heavy-cpu-worker');
// Mismo bucle intensivo que /heavy-cpu-block, pero aislado en el worker.
for (let i = 0; i < 50000000000000000; i++) {}
console.timeEnd('heavy-cpu-worker');

// Avisar al hilo principal que terminó para que responda la petición.
parentPort.postMessage({ message: 'CPU terminada en el worker. El Event Loop NUNCA se bloqueó.' });
