/**
 * Sembrado masivo controlado — Laboratorio 2, Paso 1.
 *
 * Genera un CSV gigante (`big.csv`) escribiendo millones de filas, pero SIN
 * reventar la memoria. La clave es respetar la CONTRAPRESIÓN (backpressure):
 * `write()` devuelve false cuando el buffer interno se llena; en ese momento se
 * pausa el bucle y se espera el evento `drain` (buffer vacío) para reanudar.
 *
 * Se ejecuta en su propia terminal:
 *   npx ts-node src/ram-memory/seed.ts
 */

import fs from 'node:fs';
import path from 'node:path';

// El archivo se genera junto a este ejemplo, dentro de src/ram-memory/.
const CSV_PATH = path.join(__dirname, 'big.csv');
const out = fs.createWriteStream(CSV_PATH);

// Total altísimo de iteraciones para forzar ~1GB en disco.
let iter = 10_000_000;

function escribirBloque(): void {
  let ok = true;

  // Escribir mientras el buffer lo permita (ok === true).
  while (iter > 0 && ok) {
    iter -= 1;
    const fila = `${iter},${Math.random() * 5000},ACTIVO\n`;

    if (iter === 0) {
      // Última fila: escribir sin revisar el buffer (ya no hay más).
      out.write(fila);
    } else {
      // write() devuelve false si el buffer interno se llena (backpressure).
      ok = out.write(fila);
    }
  }

  if (iter > 0) {
    // Backpressure detectado: pausar y esperar a que el buffer se vacíe.
    out.once('drain', escribirBloque);
  } else {
    console.log('Sembrado Masivo Completado.');
  }
}

escribirBloque();
