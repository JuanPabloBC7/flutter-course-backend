/**
 * Manejo centralizado de errores y de rutas no encontradas.
 * Garantiza un formato de respuesta uniforme y no filtra detalles internos.
 */

import type { NextFunction, Request, Response } from 'express';
import { AppError, NotFoundError, toErrorBody } from '../errors/app-error';

/** Middleware para rutas inexistentes: produce un 404 uniforme. */
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new NotFoundError(`Ruta no encontrada: ${req.method} ${req.path}`));
}

/** Detecta el error de JSON malformado que lanza express.json(). */
function isJsonParseError(err: unknown): boolean {
  return (
    err instanceof SyntaxError &&
    'status' in err &&
    (err as { status?: number }).status === 400 &&
    'body' in err
  );
}

/**
 * Manejador de errores final. Debe registrarse con 4 argumentos para que
 * Express lo reconozca como error handler.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // next es requerido por la firma de Express aunque no se use
  _next: NextFunction,
): void {
  // Errores de negocio conocidos: responder con su código y formato
  if (err instanceof AppError) {
    res.status(err.statusCode).json(toErrorBody(err));
    return;
  }

  // JSON malformado en el cuerpo de la solicitud
  if (isJsonParseError(err)) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'El cuerpo de la solicitud no es un JSON válido',
      },
    });
    return;
  }

  // Error inesperado: registrar solo información segura, no filtrar al cliente
  const message = err instanceof Error ? err.message : 'desconocido';
  console.error('[error] Error inesperado:', message);

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Ocurrió un error interno',
    },
  });
}
