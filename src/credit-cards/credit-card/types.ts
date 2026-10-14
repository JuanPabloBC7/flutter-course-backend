/**
 * Tipos y modelos del dominio de tarjetas de crédito.
 */

/** Marcas de tarjeta soportadas por la validación. */
export type CardBrand = 'VISA' | 'MASTERCARD' | 'AMERICAN EXPRESS' | 'DISCOVER';

/** Estados admitidos para una tarjeta. */
export type CardStatus = 'ACTIVE' | 'BLOCKED' | 'EXPIRED';

/** Conjunto de estados válidos, reutilizable en validaciones. */
export const CARD_STATUSES: readonly CardStatus[] = [
  'ACTIVE',
  'BLOCKED',
  'EXPIRED',
];

/**
 * Fila tal como se almacena en PostgreSQL (snake_case).
 * Nunca contiene el PAN completo ni el CVV.
 */
export interface CreditCardRow {
  id: string;
  user_id: string;
  card_fingerprint: string;
  last4: string;
  brand: CardBrand;
  credit_limit: string; // NUMERIC llega como string desde pg
  expiration_month: number;
  expiration_year: number;
  status: CardStatus;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

/**
 * Representación pública de una tarjeta (lo que devuelve la API).
 * Excluye deliberadamente el fingerprint y cualquier dato sensible.
 */
export interface CreditCardPublic {
  id: string;
  userId: string;
  brand: CardBrand;
  last4: string;
  creditLimit: string;
  status: CardStatus;
  expirationMonth: number;
  expirationYear: number;
  createdAt: string;
  updatedAt: string;
}

/** Datos necesarios para crear una tarjeta (ya validados). */
export interface CreateCardInput {
  userId: string;
  cardNumber: string;
  expirationMonth: number;
  expirationYear: number;
  cvv: string;
  creditLimit: number;
}

/** Campos actualizables vía PATCH. Ambos opcionales, pero al menos uno requerido. */
export interface UpdateCardInput {
  creditLimit?: number;
  status?: CardStatus;
}
