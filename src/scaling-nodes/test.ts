/**
 * Script de prueba de estrés — Laboratorio 1, Paso 3.
 *
 * Bombardea el balanceador (puerto 8080) con 6 conexiones. Con el Round-Robin
 * y 3 nodos, las respuestas deben alternarse entre los puertos 3001, 3002 y
 * 3003, demostrando que la carga se distribuye entre nodos independientes.
 *
 * Se corre en una terminal aparte (con nodos + balanceador ya levantados):
 *   npx ts-node src/scaling-nodes/test.ts
 */

import net from 'node:net';

for (let i = 1; i <= 6; i += 1) {
  const client = net.createConnection({ port: 8080 });
  client.write('Ping\n');

  // Al recibir datos del proxy, mostrar qué nodo respondió y cerrar.
  client.on('data', (data: Buffer) => {
    console.log(`Req ${i}: ${data.toString().trim()}`);
    client.end();
  });

  // Evitar que un error de conexión tumbe el script de prueba.
  client.on('error', (err: Error) => {
    console.error(`Req ${i} fallo: ${err.message}`);
  });
}
