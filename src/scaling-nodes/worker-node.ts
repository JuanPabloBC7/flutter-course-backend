/**
 * Nodo trabajador (TCP puro) — Laboratorio 1, Paso 1.
 *
 * Cada nodo es un proceso independiente del sistema operativo: su propia
 * instancia de V8, su propia memoria y su propio Event Loop. No comparte estado
 * con los demás nodos; se comunican únicamente por sockets TCP.
 *
 * NO usa Express ni HTTP: es un servidor TCP crudo con el módulo nativo `net`.
 * Se arranca a mano en su propia terminal indicando el puerto, por ejemplo:
 *   npx ts-node src/scaling-nodes/worker-node.ts 3001
 */

import net from 'node:net';

// Puerto dinámico tomado de la CLI (process.argv[2]); por defecto 3001.
const PORT = Number(process.argv[2]) || 3001;
const NODE_ID = `Nodo-${PORT}`;

// Un socket por cada cliente que se conecta.
const server = net.createServer((socket) => {
  console.log(`[+] Conexion recibida en ${NODE_ID}`);

  // Simulación de carga (tarea CPU-bound) con una espera de 500 ms.
  // El setTimeout delega la espera al sistema y no bloquea el Event Loop.
  setTimeout(() => {
    socket.write(`Respuesta desde ${NODE_ID}\n`);
    // Cerrar la conexión para liberar recursos y evitar desbordamiento.
    socket.end();
  }, 500);
});

server.listen(PORT, () => {
  console.log(`${NODE_ID} escuchando...`);
});
