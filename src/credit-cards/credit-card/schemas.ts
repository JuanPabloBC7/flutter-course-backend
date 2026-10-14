/**
 * Esquemas de validación de entrada (zod) para rutas y cuerpos de solicitud.
 * Separan la validación sintáctica de la lógica de negocio.
 */

import { z } from 'zod';
import { CARD_STATUSES } from './types';

/** UUID v4 válido para el parámetro :id. */
export const cardIdParamSchema = z.object({
  id: z.string().uuid('El identificador debe ser un UUID válido'),
});

/**
 * Cuerpo para crear una tarjeta.
 * `.strict()` rechaza campos no permitidos. El CVV se valida pero NO se persiste.
 */
export const createCardSchema = z
  .object({
    userId: z.string().min(1, 'userId es obligatorio').max(128),
    cardNumber: z.string().min(12).max(25),
    expirationMonth: z.number().int().min(1).max(12),
    expirationYear: z.number().int().min(1970).max(2100),
    cvv: z.string().min(3).max(4),
    creditLimit: z.number().finite().min(0, 'creditLimit no puede ser negativo'),
  })
  .strict();

export type CreateCardBody = z.infer<typeof createCardSchema>;

/**
 * Cuerpo para actualizar una tarjeta (PATCH).
 * Solo se permiten creditLimit y status. `.strict()` rechaza otros campos
 * (incluidos userId, id, fechas o datos de tarjeta). Al menos uno es requerido.
 */
export const updateCardSchema = z
  .object({
    creditLimit: z.number().finite().min(0, 'creditLimit no puede ser negativo').optional(),
    status: z.enum([CARD_STATUSES[0], ...CARD_STATUSES.slice(1)]).optional(),
  })
  .strict()
  .refine(
    (data) => data.creditLimit !== undefined || data.status !== undefined,
    { message: 'Debe enviar al menos un campo: creditLimit o status' },
  );

export type UpdateCardBody = z.infer<typeof updateCardSchema>;
