/**
 * Repositorio de tarjetas. Única capa que habla con PostgreSQL.
 * Todas las consultas son parametrizadas (previene inyección SQL).
 * Las tarjetas eliminadas lógicamente (deleted_at IS NOT NULL) se excluyen
 * de todas las lecturas.
 */

import { query } from '../database/pool';
import type { CardBrand, CardStatus, CreditCardRow } from './types';

/** Datos para insertar una fila (ya validados y sin PAN/CVV). */
export interface InsertCardData {
  userId: string;
  cardFingerprint: string;
  last4: string;
  brand: CardBrand;
  creditLimit: number;
  expirationMonth: number;
  expirationYear: number;
}

/** Campos actualizables en la fila. */
export interface UpdateCardData {
  creditLimit?: number;
  status?: CardStatus;
}

/** Lista todas las tarjetas no eliminadas, más recientes primero. */
export async function findAllActive(): Promise<CreditCardRow[]> {
  const result = await query<CreditCardRow>(
    `SELECT * FROM credit_cards
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC`,
  );
  return result.rows;
}

/** Busca una tarjeta vigente por id. Devuelve null si no existe o fue eliminada. */
export async function findById(id: string): Promise<CreditCardRow | null> {
  const result = await query<CreditCardRow>(
    `SELECT * FROM credit_cards
     WHERE id = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

/**
 * Busca una tarjeta vigente por usuario + fingerprint (para detectar duplicados).
 */
export async function findActiveByUserAndFingerprint(
  userId: string,
  fingerprint: string,
): Promise<CreditCardRow | null> {
  const result = await query<CreditCardRow>(
    `SELECT * FROM credit_cards
     WHERE user_id = $1 AND card_fingerprint = $2 AND deleted_at IS NULL
     LIMIT 1`,
    [userId, fingerprint],
  );
  return result.rows[0] ?? null;
}

/** Inserta una nueva tarjeta y devuelve la fila creada. */
export async function insert(data: InsertCardData): Promise<CreditCardRow> {
  const result = await query<CreditCardRow>(
    `INSERT INTO credit_cards
       (user_id, card_fingerprint, last4, brand, credit_limit,
        expiration_month, expiration_year, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'ACTIVE')
     RETURNING *`,
    [
      data.userId,
      data.cardFingerprint,
      data.last4,
      data.brand,
      data.creditLimit,
      data.expirationMonth,
      data.expirationYear,
    ],
  );
  // RETURNING siempre devuelve una fila en un INSERT exitoso
  return result.rows[0] as CreditCardRow;
}

/**
 * Actualiza creditLimit y/o status de una tarjeta vigente.
 * Construye el SET dinámicamente pero siempre con parámetros ($n).
 * Devuelve la fila actualizada o null si no existe/está eliminada.
 */
export async function update(
  id: string,
  data: UpdateCardData,
): Promise<CreditCardRow | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (data.creditLimit !== undefined) {
    sets.push(`credit_limit = $${idx}`);
    params.push(data.creditLimit);
    idx += 1;
  }

  if (data.status !== undefined) {
    sets.push(`status = $${idx}`);
    params.push(data.status);
    idx += 1;
  }

  // Mantener updated_at al día
  sets.push('updated_at = now()');

  // El id es el último parámetro
  params.push(id);

  const result = await query<CreditCardRow>(
    `UPDATE credit_cards
     SET ${sets.join(', ')}
     WHERE id = $${idx} AND deleted_at IS NULL
     RETURNING *`,
    params,
  );

  return result.rows[0] ?? null;
}

/**
 * Eliminación lógica: marca deleted_at con la fecha de la base de datos.
 * Devuelve true si se eliminó, false si no existía o ya estaba eliminada.
 */
export async function softDelete(id: string): Promise<boolean> {
  const result = await query(
    `UPDATE credit_cards
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}
