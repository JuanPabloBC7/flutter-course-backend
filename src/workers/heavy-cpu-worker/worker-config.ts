/**
 * Configuración compartida del ejemplo de workers.
 *
 * HEAVY_ITERATIONS es un bucle deliberadamente pesado PERO FINITO: su único
 * propósito es demostrar cómo una carga de CPU sincrónica bloquea el Event Loop
 * frente a cómo delegarla a un worker thread lo mantiene libre. El valor es lo
 * bastante grande para notar el bloqueo, pero termina en un tiempo razonable
 * (reemplaza el bucle casi infinito del ejemplo original en JavaScript).
 */
export const HEAVY_ITERATIONS = 5_000_000_000;
