/**
 * Transformador de memoria fija — Laboratorio 2, Paso 2.
 *
 * Clase Transform que procesa el archivo por CHUNKS (fragmentos), no entero en
 * memoria. Cada chunk llega como Buffer binario; aquí se convierte a texto y se
 * aplica una mutación (reemplazar comas por el símbolo pipe `|`). Al trabajar
 * fragmento a fragmento, el consumo de RAM se mantiene estático sin importar el
 * tamaño total del archivo.
 */

import { Transform, type TransformCallback } from 'node:stream';

export class FormateadorCSV extends Transform {
  // `chunk` es un Buffer que recibe los datos por partes.
  _transform(
    chunk: Buffer,
    _encoding: BufferEncoding,
    callback: TransformCallback,
  ): void {
    // Parseo a texto y transformación: todas las comas pasan a ` | `.
    const dataTexto = chunk.toString();
    const dataMutada = dataTexto.replace(/,/g, ' | ');

    // Enviar el texto mutado al stream de lectura interno.
    this.push(dataMutada);

    // Señalar la finalización del procesamiento de este bloque.
    callback();
  }
}
