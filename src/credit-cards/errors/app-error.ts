/**
 * Jerarquía de errores de la aplicación y formato uniforme de respuesta.
 */

/** Detalle de validación por campo. */
export interface ErrorDetail {
  field: string;
  message: string;
}

/** Códigos de error de negocio (estables para los clientes). */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR';

/**
 * Error base de la aplicación. Lleva el código HTTP, un código de negocio
 * y, opcionalmente, detalles por campo. Nunca debe contener datos sensibles.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: ErrorCode;
  public readonly details?: ErrorDetail[];

  constructor(
    statusCode: number,
    code: ErrorCode,
    message: string,
    details?: ErrorDetail[],
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

/** 400 — Entrada inválida. */
export class ValidationError extends AppError {
  constructor(message = 'La solicitud contiene datos inválidos', details?: ErrorDetail[]) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

/** 404 — Recurso inexistente o eliminado. */
export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado') {
    super(404, 'NOT_FOUND', message);
    this.name = 'NotFoundError';
  }
}

/** 409 — Conflicto de integridad o duplicidad. */
export class ConflictError extends AppError {
  constructor(message = 'Conflicto con el estado actual del recurso') {
    super(409, 'CONFLICT', message);
    this.name = 'ConflictError';
  }
}

/** Estructura serializable del cuerpo de error que devuelve la API. */
export interface ErrorResponseBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
}

/** Construye el cuerpo de error uniforme a partir de un AppError. */
export function toErrorBody(error: AppError): ErrorResponseBody {
  return {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
  };
}
