/**
 * Capa de servicio: lógica de negocio de tarjetas.
 * No conoce HTTP ni SQL directo; orquesta validación, seguridad y repositorio.
 */

import {
  ConflictError,
  NotFoundError,
  ValidationError,
  type ErrorDetail,
} from '../errors/app-error';
import {
  computeCardFingerprint,
  extractLast4,
  validateCardNumber,
  validateCvv,
  validateExpiration,
} from './card-validator';
import * as repo from './repository';
import type {
  CreateCardInput,
  CreditCardPublic,
  CreditCardRow,
  UpdateCardInput,
} from './types';

/**
 * Mapea una fila de BD a la representación pública.
 * Excluye card_fingerprint y cualquier dato sensible. Nunca expone PAN/CVV.
 */
function toPublic(row: CreditCardRow): CreditCardPublic {
  return {
    id: row.id,
    userId: row.user_id,
    brand: row.brand,
    last4: row.last4,
    creditLimit: row.credit_limit,
    status: row.status,
    expirationMonth: row.expiration_month,
    expirationYear: row.expiration_year,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

/** Lista las tarjetas activas (no eliminadas). */
export async function listActiveCards(): Promise<CreditCardPublic[]> {
  const rows = await repo.findAllActive();
  return rows.map(toPublic);
}

/** Obtiene una tarjeta por id o lanza 404 si no existe/está eliminada. */
export async function getCardById(id: string): Promise<CreditCardPublic> {
  const row = await repo.findById(id);
  if (row === null) {
    throw new NotFoundError('La tarjeta no existe o fue eliminada');
  }
  return toPublic(row);
}

/**
 * Crea una tarjeta tras validar numeración (Luhn + marca), vencimiento y CVV.
 * - La marca se determina a partir de la numeración; no se acepta del cliente.
 * - El CVV se valida pero NUNCA se persiste.
 * - Se guarda solo last4 + fingerprint HMAC (no el PAN completo).
 * - Se evita duplicar la misma tarjeta vigente del mismo usuario.
 */
export async function createCard(
  input: CreateCardInput,
): Promise<CreditCardPublic> {
  const details: ErrorDetail[] = [];

  // 1) Numeración + marca (Luhn)
  const numberResult = validateCardNumber(input.cardNumber);
  if (!numberResult.valid || numberResult.brand === undefined) {
    details.push({
      field: 'cardNumber',
      message: numberResult.reason ?? 'Numeración inválida',
    });
  }

  // 2) Vencimiento
  const expResult = validateExpiration(
    input.expirationMonth,
    input.expirationYear,
  );
  if (!expResult.valid) {
    details.push({
      field: 'expiration',
      message: expResult.reason ?? 'Fecha de vencimiento inválida',
    });
  }

  // 3) CVV (requiere conocer la marca; si la numeración falló, no se evalúa)
  if (numberResult.valid && numberResult.brand !== undefined) {
    const cvvResult = validateCvv(input.cvv, numberResult.brand);
    if (!cvvResult.valid) {
      details.push({
        field: 'cvv',
        message: cvvResult.reason ?? 'CVV inválido',
      });
    }
  }

  if (details.length > 0) {
    throw new ValidationError('La solicitud contiene datos inválidos', details);
  }

  // A partir de aquí la marca está garantizada
  const brand = numberResult.brand!;
  const last4 = extractLast4(input.cardNumber);
  const fingerprint = computeCardFingerprint(input.cardNumber);

  // 4) Detección de duplicados (misma tarjeta vigente del mismo usuario)
  const existing = await repo.findActiveByUserAndFingerprint(
    input.userId,
    fingerprint,
  );
  if (existing !== null) {
    throw new ConflictError('El usuario ya tiene registrada esta tarjeta');
  }

  // 5) Persistir solo datos mínimos y seguros (sin PAN ni CVV)
  try {
    const row = await repo.insert({
      userId: input.userId,
      cardFingerprint: fingerprint,
      last4,
      brand,
      creditLimit: input.creditLimit,
      expirationMonth: input.expirationMonth,
      expirationYear: input.expirationYear,
    });
    return toPublic(row);
  } catch (error: unknown) {
    // Violación de índice único (duplicado por carrera): devolver 409
    if (isUniqueViolation(error)) {
      throw new ConflictError('El usuario ya tiene registrada esta tarjeta');
    }
    throw error;
  }
}

/** Actualiza creditLimit y/o status. Lanza 404 si no existe/está eliminada. */
export async function updateCard(
  id: string,
  input: UpdateCardInput,
): Promise<CreditCardPublic> {
  const row = await repo.update(id, input);
  if (row === null) {
    throw new NotFoundError('La tarjeta no existe o fue eliminada');
  }
  return toPublic(row);
}

/** Eliminación lógica. Lanza 404 si no existe o ya estaba eliminada. */
export async function deleteCard(id: string): Promise<void> {
  const deleted = await repo.softDelete(id);
  if (!deleted) {
    throw new NotFoundError('La tarjeta no existe o ya fue eliminada');
  }
}

/** Detecta el error de violación de restricción única de PostgreSQL (code 23505). */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}
