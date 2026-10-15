/**
 * Balanceador de carga (proxy TCP de Capa 4) — Laboratorio 1, Paso 2.
 *
 * Actúa como proxy público en el puerto 8080 y reparte las conexiones entre los
 * nodos trabajadores con el algoritmo Round-Robin (idx % total_nodos). Opera a
 * nivel de transporte (Capa 4 OSI): no analiza cabeceras HTTP, solo conecta los
 * flujos de red (streams) del cliente con los del nodo mediante piping.
 *
 * Se arranca a mano en su propia terminal (con los nodos ya levantados):
 *   npx ts-node src/scaling-nodes/balancer.ts
 */

import net from 'node:net';

// Puertos destino de los nodos trabajadores.
const NODES = [3001, 3002, 3003];
// Contador para el reparto secuencial Round-Robin.
let idx = 0;

const balancer = net.createServer((client) => {
  // Algoritmo Round-Robin: elegir el siguiente nodo y avanzar el contador.
  const targetPort = NODES[idx % NODES.length];
  idx += 1;
  console.log(`Enrutando trafico -> Puerto ${targetPort}`);

  // Crear el túnel hacia el nodo interno elegido.
  const node = net.createConnection({ port: targetPort });

  // Tubería bidireccional: lo que entra del cliente va al nodo y viceversa.
  client.pipe(node);
  node.pipe(client);

  // Manejo preventivo de fallos: si el nodo cae, no debe tumbar al balanceador.
  node.on('error', () => {
    console.error(`Nodo ${targetPort} caido`);
    client.end('Error Interno del Servidor\n');
  });

  // Si el cliente se desconecta, cerrar también la conexión con el nodo.
  client.on('error', () => {
    node.end();
  });
});

balancer.listen(8080, () => {
  console.log('Proxy OK en 8080');
});
