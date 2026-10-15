/**
 * Ensamblaje seguro de tuberías — Laboratorio 2, Paso 3.
 *
 * Conecta lectura -> transformación -> escritura con el utilitario nativo
 * `pipeline()`, que propaga bien los errores y limpia los streams al terminar
 * (a diferencia de encadenar `.pipe()`, que gestiona mal los fallos de memoria).
 *
 * Un setInterval imprime el consumo del Heap cada 500 ms: aunque el archivo
 * pese gigabytes, la RAM se mantiene estable (~30 MB) porque se procesa por
 * fragmentos, no cargando todo el archivo en memoria.
 *
 * Requiere haber generado antes `big.csv` con seed.ts. Se corre así:
 *   npx ts-node src/ram-memory/pipeline.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream';
import { FormateadorCSV } from './etl';

const INPUT_PATH = path.join(__dirname, 'big.csv');
const OUTPUT_PATH = path.join(__dirname, 'final.txt');

const input = fs.createReadStream(INPUT_PATH);
const transformer = new FormateadorCSV();
const output = fs.createWriteStream(OUTPUT_PATH);

// Profiler de RAM no bloqueante: muestra el Heap usado cada 500 ms.
const intervalo = setInterval(() => {
  const mb = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`[+] Consumo RAM: ${mb.toFixed(2)} MB`);
}, 500);

// pipeline gestiona errores y limpieza de recursos de forma segura.
pipeline(input, transformer, output, (err) => {
  clearInterval(intervalo);
  if (err) {
    console.error('Error de Stream', err);
  } else {
    console.log('Procesamiento completado sin crashear.');
  }
});
