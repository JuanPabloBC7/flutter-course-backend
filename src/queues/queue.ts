/**
 * Cola de prioridad no bloqueante — Laboratorio 3, Pasos 1 y 2.
 *
 * Procesa tareas ordenadas por prioridad SIN estrangular el Event Loop. El
 * truco está en `_processLoop`: tras cada tarea, en vez de seguir en un bucle
 * sincrónico, se reagenda con `setImmediate`, cediendo el control al Event Loop
 * en cada iteración. Así el hilo principal queda libre para atender nuevas
 * peticiones (o inyectar tareas urgentes) entre tarea y tarea.
 */

/** Una tarea encolada: id, datos y prioridad (1 baja … 10 urgente). */
interface Task {
  id: string;
  data: unknown;
  priority: number;
}

export class PriorityQueue {
  // Arreglo interno de tareas pendientes.
  private tareas: Task[] = [];
  // Flag para evitar arrancar el procesamiento más de una vez a la vez.
  private isProcessing = false;

  /**
   * Inyecta una tarea y reordena de inmediato por prioridad (descendente).
   * Nota: el sort tras cada inserción es apto para este laboratorio; en
   * producción convendría un Min-Heap para mejor rendimiento.
   *
   * Si el procesamiento ya se había detenido (cola vacía), reanudarlo: así una
   * tarea que llega tarde (p. ej. tráfico VIP asíncrono) siempre se atiende.
   */
  add(id: string, data: unknown, priority = 1): void {
    this.tareas.push({ id, data, priority });
    this.tareas.sort((a, b) => b.priority - a.priority);

    if (!this.isProcessing) {
      this.start();
    }
  }

  /** Cantidad de tareas pendientes. */
  get length(): number {
    return this.tareas.length;
  }

  /** Extrae la tarea prioritaria (la del índice 0). */
  next(): Task | undefined {
    return this.tareas.shift();
  }

  /** Arranca el procesamiento (protegido por el flag para evitar concurrencia). */
  start(): void {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;
    this._processLoop();
  }

  /** Bucle de procesamiento recursivo y no bloqueante. */
  private _processLoop(): void {
    // Si no quedan tareas, terminar y liberar el flag.
    if (this.length === 0) {
      this.isProcessing = false;
      console.log('Cola vaciada.');
      return;
    }

    const tarea = this.next();
    if (tarea === undefined) {
      this.isProcessing = false;
      return;
    }

    // Esfuerzo computacional simulado para el item individual: serializamos su
    // dato varias veces para que cada tarea "pese" un poco. Esto hace que las
    // 5000 tareas no se vacíen al instante y se note cómo el tráfico VIP se
    // adelanta en pleno procesamiento (en una maquina rapida, sin este peso,
    // la cola terminaria antes de que lleguen las VIP).
    for (let i = 0; i < 4000; i += 1) {
      JSON.stringify(tarea.data);
    }

    if (tarea.priority > 5) {
      console.log(`[URGENTE] Procesado: ${tarea.id}`);
    }

    // MAGIA: liberar el Event Loop en cada iteración. setImmediate reagenda el
    // siguiente paso en la fase "check" del próximo ciclo, oxigenando el hilo.
    setImmediate(() => {
      this._processLoop();
    });
  }
}
