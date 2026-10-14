/**
 * Pruebas unitarias del módulo de validación de tarjetas.
 * No requieren base de datos.
 *
 * Nota: todos los números usados son sintéticos y Luhn-válidos, destinados
 * únicamente a pruebas. No corresponden a tarjetas reales.
 */

import {
  detectBrand,
  extractLast4,
  normalizeCardNumber,
  passesLuhn,
  validateCardNumber,
  validateCvv,
  validateExpiration,
} from '../src/credit-cards/card-validator';

describe('normalizeCardNumber', () => {
  it('elimina espacios y guiones', () => {
    expect(normalizeCardNumber('4111 1111-1111 1111')).toBe('4111111111111111');
  });
});

describe('passesLuhn', () => {
  it('acepta un número con checksum válido', () => {
    expect(passesLuhn('4111111111111111')).toBe(true);
  });

  it('rechaza un número con checksum inválido', () => {
    expect(passesLuhn('4111111111111112')).toBe(false);
  });

  it('rechaza entradas no numéricas', () => {
    expect(passesLuhn('4111abcd11111111')).toBe(false);
  });
});

describe('detectBrand', () => {
  it('identifica VISA (prefijo 4)', () => {
    expect(detectBrand('4111111111111111')).toBe('VISA');
  });

  it('identifica MASTERCARD en el rango 51-55', () => {
    expect(detectBrand('5105105105105100')).toBe('MASTERCARD');
    expect(detectBrand('5555555555554444')).toBe('MASTERCARD');
  });

  it('identifica MASTERCARD en el rango 2221-2720', () => {
    expect(detectBrand('2221000000000009')).toBe('MASTERCARD');
    expect(detectBrand('2720990000000015')).toBe('MASTERCARD');
  });

  it('devuelve null para prefijos fuera de rango', () => {
    // 2220 queda por debajo del rango nuevo de Mastercard
    expect(detectBrand('2220000000000000')).toBeNull();
    // 2721 queda por encima
    expect(detectBrand('2721000000000000')).toBeNull();
    // 60.. no es Visa ni Mastercard soportada
    expect(detectBrand('6011000000000004')).toBeNull();
  });
});

describe('validateCardNumber', () => {
  it('valida una Visa de 16 dígitos y devuelve la marca', () => {
    const result = validateCardNumber('4111 1111 1111 1111');
    expect(result.valid).toBe(true);
    expect(result.brand).toBe('VISA');
  });

  it('valida una Visa de 13 dígitos', () => {
    const result = validateCardNumber('4222222222222');
    expect(result.valid).toBe(true);
    expect(result.brand).toBe('VISA');
  });

  it('valida una Mastercard de 16 dígitos', () => {
    const result = validateCardNumber('5555555555554444');
    expect(result.valid).toBe(true);
    expect(result.brand).toBe('MASTERCARD');
  });

  it('rechaza checksum de Luhn incorrecto', () => {
    const result = validateCardNumber('4111111111111112');
    expect(result.valid).toBe(false);
  });

  it('rechaza caracteres no numéricos', () => {
    const result = validateCardNumber('4111-abcd-1111-1111');
    expect(result.valid).toBe(false);
  });

  it('rechaza longitud inválida para la marca', () => {
    // Visa con 15 dígitos no es longitud admitida
    const result = validateCardNumber('411111111111111');
    expect(result.valid).toBe(false);
  });
});

describe('validateExpiration', () => {
  // Fecha de negocio fija para pruebas deterministas: 15 de junio de 2026
  const reference = new Date(2026, 5, 15);

  it('acepta una fecha futura', () => {
    expect(validateExpiration(12, 2028, reference).valid).toBe(true);
  });

  it('acepta el mismo mes de vencimiento (vigente hasta fin de mes)', () => {
    expect(validateExpiration(6, 2026, reference).valid).toBe(true);
  });

  it('rechaza una tarjeta vencida (mes anterior)', () => {
    expect(validateExpiration(5, 2026, reference).valid).toBe(false);
  });

  it('rechaza un mes fuera de rango', () => {
    expect(validateExpiration(13, 2028, reference).valid).toBe(false);
    expect(validateExpiration(0, 2028, reference).valid).toBe(false);
  });
});

describe('validateCvv', () => {
  it('acepta 3 dígitos para VISA', () => {
    expect(validateCvv('123', 'VISA').valid).toBe(true);
  });

  it('acepta 3 dígitos para MASTERCARD', () => {
    expect(validateCvv('999', 'MASTERCARD').valid).toBe(true);
  });

  it('rechaza longitud incorrecta', () => {
    expect(validateCvv('12', 'VISA').valid).toBe(false);
    expect(validateCvv('1234', 'VISA').valid).toBe(false);
  });

  it('rechaza caracteres no numéricos', () => {
    expect(validateCvv('12a', 'VISA').valid).toBe(false);
  });
});

describe('extractLast4', () => {
  it('devuelve los últimos 4 dígitos', () => {
    expect(extractLast4('4111 1111 1111 1234')).toBe('1234');
  });
});
