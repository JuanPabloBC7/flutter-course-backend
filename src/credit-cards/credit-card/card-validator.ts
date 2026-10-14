/**
 * Módulo de validación de tarjetas de crédito.
 *
 * ALCANCE: estas funciones verifican formato, numeración, checksum (Luhn),
 * marca y fecha de vencimiento. NO comprueban que la tarjeta exista, esté
 * emitida, pertenezca al usuario o tenga crédito disponible. Para eso se
 * necesitaría una integración autorizada con un proveedor de pagos o emisor.
 *
 * Incluye además el cálculo de la huella criptográfica (fingerprint) de la
 * tarjeta, pues depende directamente de la normalización de la numeración.
 */

import { createHmac } from 'node:crypto';
import { env } from '../config/env';
import type { CardBrand } from './types';

/** Resultado de una validación con posible motivo de fallo. */
export interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/** Longitudes de PAN admitidas por marca. */
const BRAND_LENGTHS: Record<CardBrand, number[]> = {
  VISA: [13, 16, 19],
  MASTERCARD: [16],
  'AMERICAN EXPRESS': [15],
  DISCOVER: [16],
};

/**
 * Longitud de CVV esperada por marca.
 * Visa, Mastercard y Discover usan 3 dígitos; American Express usa 4 (CID).
 */
const BRAND_CVV_LENGTHS: Record<CardBrand, number[]> = {
  VISA: [3],
  MASTERCARD: [3],
  'AMERICAN EXPRESS': [4],
  DISCOVER: [3],
};

/**
 * Normaliza la numeración: elimina espacios y guiones permitidos.
 * No valida contenido; solo limpia separadores comunes.
 */
export function normalizeCardNumber(input: string): string {
  return input.replace(/[\s-]/g, '');
}

/** Indica si la cadena contiene únicamente dígitos (y no está vacía). */
export function isAllDigits(value: string): boolean {
  return value.length > 0 && /^[0-9]+$/.test(value);
}

/**
 * Detecta la marca a partir de los rangos de numeración conocidos.
 * Función centralizada y reutilizable.
 *
 * - VISA: comienza con 4.
 * - MASTERCARD: prefijos 51–55 y rango 2221–2720.
 *
 * Devuelve null si no corresponde a una marca soportada.
 */
export function detectBrand(cardNumber: string): CardBrand | null {
  const digits = normalizeCardNumber(cardNumber);
  if (!isAllDigits(digits) || digits.length < 2) {
    return null;
  }

  // VISA
  if (digits.startsWith('4')) {
    return 'VISA';
  }

  // MASTERCARD rango clásico 51–55
  const firstTwo = Number.parseInt(digits.slice(0, 2), 10);
  if (firstTwo >= 51 && firstTwo <= 55) {
    return 'MASTERCARD';
  }

  // MASTERCARD rango nuevo 2221–2720 (primeros 4 dígitos)
  const firstFour = Number.parseInt(digits.slice(0, 4), 10);
  if (firstFour >= 2221 && firstFour <= 2720) {
    return 'MASTERCARD';
  }

  // AMERICAN EXPRESS 34 o 37
  if (firstTwo === 34 || firstTwo === 37) {
    return 'AMERICAN EXPRESS';
  }

  // DISCOVER 6011, 65, 644-649 o 622126–622925
  const firstThree = Number.parseInt(digits.slice(0, 3), 10);
  const firstSix = Number.parseInt(digits.slice(0, 6), 10);
  if (firstFour === 6011) {
    return 'DISCOVER';
  }
  if (firstTwo === 65) {
    return 'DISCOVER';
  }
  if (firstThree >= 644 && firstThree <= 649) {
    return 'DISCOVER';
  }
  if (firstSix >= 622126 && firstSix <= 622925) {
    return 'DISCOVER';
  }

  return null;
}

/**
 * Implementa el algoritmo de Luhn para validar el checksum del PAN.
 * Espera una cadena de solo dígitos.
 */
export function passesLuhn(cardNumber: string): boolean {
  const digits = normalizeCardNumber(cardNumber);
  if (!isAllDigits(digits)) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  // Recorrer de derecha a izquierda
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = digits.charCodeAt(i) - 48; // '0' = 48
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

/**
 * Valida la numeración completa: limpieza, dígitos, marca soportada,
 * longitud según marca y checksum de Luhn.
 * Devuelve también la marca detectada cuando es válida.
 */
export function validateCardNumber(input: string): ValidationResult & {
  brand?: CardBrand;
} {
  const digits = normalizeCardNumber(input);

  if (!isAllDigits(digits)) {
    return { valid: false, reason: 'La numeración contiene caracteres no numéricos' };
  }

  const brand = detectBrand(digits);
  if (brand === null) {
    return { valid: false, reason: 'Marca no soportada o numeración no reconocida' };
  }

  if (!BRAND_LENGTHS[brand].includes(digits.length)) {
    return {
      valid: false,
      reason: `Longitud inválida para ${brand}`,
    };
  }

  if (!passesLuhn(digits)) {
    return { valid: false, reason: 'La numeración no supera el algoritmo de Luhn' };
  }

  return { valid: true, brand };
}

/**
 * Valida la fecha de vencimiento. La tarjeta es válida hasta el último día
 * del mes de vencimiento. `referenceDate` permite inyectar la fecha de negocio
 * (útil para pruebas deterministas); por defecto usa la fecha actual.
 */
export function validateExpiration(
  month: number,
  year: number,
  referenceDate: Date = new Date(),
): ValidationResult {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { valid: false, reason: 'El mes de vencimiento debe estar entre 1 y 12' };
  }

  if (!Number.isInteger(year) || year < 1970 || year > 2100) {
    return { valid: false, reason: 'El año de vencimiento es inválido' };
  }

  // Último instante del mes de vencimiento: inicio del mes siguiente - 1 ms.
  // new Date(year, month, 1) ya apunta al mes siguiente (meses 0-indexados).
  const endOfExpirationMonth = new Date(year, month, 1).getTime() - 1;

  if (referenceDate.getTime() > endOfExpirationMonth) {
    return { valid: false, reason: 'La tarjeta está vencida' };
  }

  return { valid: true };
}

/**
 * Valida el CVV/CVC según la marca: debe ser numérico y tener la longitud
 * esperada (3 dígitos para Visa y Mastercard).
 */
export function validateCvv(cvv: string, brand: CardBrand): ValidationResult {
  if (!isAllDigits(cvv)) {
    return { valid: false, reason: 'El CVV debe ser numérico' };
  }

  if (!BRAND_CVV_LENGTHS[brand].includes(cvv.length)) {
    return { valid: false, reason: `Longitud de CVV inválida para ${brand}` };
  }

  return { valid: true };
}

/** Devuelve los últimos 4 dígitos del PAN normalizado. */
export function extractLast4(cardNumber: string): string {
  const digits = normalizeCardNumber(cardNumber);
  return digits.slice(-4);
}

/**
 * Genera la huella HMAC-SHA256 del PAN normalizado.
 *
 * Objetivo: poder detectar la MISMA tarjeta (para evitar duplicados) sin
 * almacenar el PAN. Se usa HMAC-SHA256 con un secreto de servidor
 * (CARD_FINGERPRINT_SECRET), no un hash simple del número. El PAN solo vive
 * en memoria el tiempo necesario para calcular la huella.
 *
 * LIMITACIÓN: esto NO sustituye la tokenización de un proveedor de pagos ni
 * los controles PCI DSS. Es una referencia interna para correlación local.
 * Una integración real debe delegar el manejo del PAN a un proveedor
 * certificado y guardar únicamente el token que este devuelva.
 */
export function computeCardFingerprint(cardNumber: string): string {
  const normalized = normalizeCardNumber(cardNumber);
  return createHmac('sha256', env.CARD_FINGERPRINT_SECRET)
    .update(normalized)
    .digest('hex');
}
