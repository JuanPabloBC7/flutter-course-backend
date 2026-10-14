/**
 * Middleware de validación basado en zod.
 * Convierte errores de zod al formato uniforme (ValidationError 400).
 */

import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { ValidationError, type ErrorDetail } from '../errors/app-error';

/** Transforma los issues de zod en detalles por campo. */
function toDetails(error: ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || '(body)',
    message: issue.message,
  }));
}

/** Valida req.body contra el esquema y reemplaza body por el valor parseado. */
export function validateBody(schema: ZodSchema): (
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ValidationError('La solicitud contiene datos inválidos', toDetails(result.error)));
      return;
    }
    req.body = result.data;
    next();
  };
}

/** Valida req.params contra el esquema. */
export function validateParams(schema: ZodSchema): (
  req: Request,
  res: Response,
  next: NextFunction,
) => void {
  return (req, _res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      next(new ValidationError('Parámetro de ruta inválido', toDetails(result.error)));
      return;
    }
    next();
  };
}
