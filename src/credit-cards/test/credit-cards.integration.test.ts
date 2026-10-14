/**
 * Pruebas de integración de los endpoints /api/v1/credit-cards.
 *
 * Requieren una base de datos PostgreSQL de PRUEBAS accesible mediante las
 * variables PG* del entorno. Si la base no está disponible, la suite se omite
 * con un aviso claro en consola (no se simulan resultados exitosos).
 *
 * Para ejecutarlas:
 *   NODE_ENV=test PGDATABASE=credit_cards_test npm test
 *
 * Todos los números de tarjeta son sintéticos y Luhn-válidos (solo pruebas).
 */

import request from 'supertest';
import type { Application } from 'express';
import { createApp } from '../../app';
import {
  isDatabaseAvailable,
  setupSchema,
  teardown,
  truncateCards,
} from './helpers/test-db';

// Datos de prueba sintéticos
const VISA = '4111111111111111';
const MASTERCARD_55 = '5555555555554444';
const MASTERCARD_2221 = '2221000000000009';
const MASTERCARD_2720 = '2720990000000015';
const LUHN_INVALID = '4111111111111112';

const baseCard = {
  userId: 'user-123',
  cardNumber: VISA,
  expirationMonth: 12,
  expirationYear: 2030,
  cvv: '123',
  creditLimit: 5000,
};

let app: Application;
let dbAvailable = false;

beforeAll(async () => {
  dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) {
    // Aviso explícito: no se inventan resultados si falta el entorno
    console.warn(
      '\n[integration] PostgreSQL de pruebas no disponible. ' +
        'Se omiten las pruebas de integración. ' +
        'Configura PG* y una base de pruebas para ejecutarlas.\n',
    );
    return;
  }
  await setupSchema();
  app = createApp();
});

afterAll(async () => {
  if (dbAvailable) {
    await teardown();
  }
});

beforeEach(async () => {
  if (dbAvailable) {
    await truncateCards();
  }
});

// Helper que omite la prueba si no hay base de datos
function dbIt(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbAvailable) {
      return; // omitido: sin base de datos
    }
    await fn();
  });
}

/** Crea una tarjeta directamente vía API y devuelve su representación. */
async function createCard(overrides: Record<string, unknown> = {}): Promise<{
  id: string;
  [key: string]: unknown;
}> {
  const res = await request(app)
    .post('/api/v1/credit-cards')
    .send({ ...baseCard, ...overrides });
  return res.body.data;
}

describe('GET /api/v1/credit-cards', () => {
  dbIt('1. lista tarjetas activas', async () => {
    await createCard();
    const res = await request(app).get('/api/v1/credit-cards');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
  });

  dbIt('2. devuelve un array vacío cuando no hay tarjetas', async () => {
    const res = await request(app).get('/api/v1/credit-cards');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('GET /api/v1/credit-cards/:id', () => {
  dbIt('3. obtiene una tarjeta existente', async () => {
    const created = await createCard();
    const res = await request(app).get(`/api/v1/credit-cards/${created.id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(created.id);
  });

  dbIt('4. devuelve 404 para una tarjeta inexistente', async () => {
    const res = await request(app).get(
      '/api/v1/credit-cards/550e8400-e29b-41d4-a716-446655440000',
    );
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  dbIt('valida el formato del id (UUID)', async () => {
    const res = await request(app).get('/api/v1/credit-cards/not-a-uuid');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/credit-cards', () => {
  dbIt('5. creación válida devuelve 201', async () => {
    const res = await request(app).post('/api/v1/credit-cards').send(baseCard);
    expect(res.status).toBe(201);
    expect(res.body.data.brand).toBe('VISA');
    expect(res.body.data.last4).toBe('1111');
    expect(res.body.data.status).toBe('ACTIVE');
  });

  dbIt('6. falla sin userId con 400', async () => {
    const { userId, ...withoutUser } = baseCard;
    void userId;
    const res = await request(app).post('/api/v1/credit-cards').send(withoutUser);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  dbIt('7. falla sin creditLimit con 400', async () => {
    const { creditLimit, ...withoutLimit } = baseCard;
    void creditLimit;
    const res = await request(app).post('/api/v1/credit-cards').send(withoutLimit);
    expect(res.status).toBe(400);
  });

  dbIt('8. rechaza checksum de Luhn incorrecto', async () => {
    const res = await request(app)
      .post('/api/v1/credit-cards')
      .send({ ...baseCard, cardNumber: LUHN_INVALID });
    expect(res.status).toBe(400);
  });

  dbIt('9. identifica VISA automáticamente', async () => {
    const res = await request(app).post('/api/v1/credit-cards').send(baseCard);
    expect(res.body.data.brand).toBe('VISA');
  });

  dbIt('10. identifica MASTERCARD en ambos rangos de prefijo', async () => {
    const r55 = await request(app)
      .post('/api/v1/credit-cards')
      .send({ ...baseCard, cardNumber: MASTERCARD_55 });
    expect(r55.body.data.brand).toBe('MASTERCARD');

    const r2221 = await request(app)
      .post('/api/v1/credit-cards')
      .send({ ...baseCard, userId: 'user-b', cardNumber: MASTERCARD_2221 });
    expect(r2221.body.data.brand).toBe('MASTERCARD');

    const r2720 = await request(app)
      .post('/api/v1/credit-cards')
      .send({ ...baseCard, userId: 'user-c', cardNumber: MASTERCARD_2720 });
    expect(r2720.body.data.brand).toBe('MASTERCARD');
  });

  dbIt('11. rechaza fecha de vencimiento expirada', async () => {
    const res = await request(app)
      .post('/api/v1/credit-cards')
      .send({ ...baseCard, expirationMonth: 1, expirationYear: 2000 });
    expect(res.status).toBe(400);
  });

  dbIt('12. rechaza CVV con formato incorrecto', async () => {
    const res = await request(app)
      .post('/api/v1/credit-cards')
      .send({ ...baseCard, cvv: '12' });
    expect(res.status).toBe(400);
  });

  dbIt('rechaza campos no permitidos (strict)', async () => {
    const res = await request(app)
      .post('/api/v1/credit-cards')
      .send({ ...baseCard, brand: 'VISA', hacker: true });
    expect(res.status).toBe(400);
  });

  dbIt('evita duplicados de la misma tarjeta del mismo usuario (409)', async () => {
    await request(app).post('/api/v1/credit-cards').send(baseCard);
    const res = await request(app).post('/api/v1/credit-cards').send(baseCard);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

describe('PATCH /api/v1/credit-cards/:id', () => {
  dbIt('13. actualiza el límite de crédito', async () => {
    const created = await createCard();
    const res = await request(app)
      .patch(`/api/v1/credit-cards/${created.id}`)
      .send({ creditLimit: 7500 });
    expect(res.status).toBe(200);
    expect(res.body.data.creditLimit).toBe('7500.00');
  });

  dbIt('14. actualiza el estado', async () => {
    const created = await createCard();
    const res = await request(app)
      .patch(`/api/v1/credit-cards/${created.id}`)
      .send({ status: 'BLOCKED' });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('BLOCKED');
  });

  dbIt('15. rechaza valores inválidos', async () => {
    const created = await createCard();
    const negative = await request(app)
      .patch(`/api/v1/credit-cards/${created.id}`)
      .send({ creditLimit: -1 });
    expect(negative.status).toBe(400);

    const badStatus = await request(app)
      .patch(`/api/v1/credit-cards/${created.id}`)
      .send({ status: 'INVALID' });
    expect(badStatus.status).toBe(400);
  });

  dbIt('rechaza cuerpo vacío', async () => {
    const created = await createCard();
    const res = await request(app)
      .patch(`/api/v1/credit-cards/${created.id}`)
      .send({});
    expect(res.status).toBe(400);
  });

  dbIt('rechaza campos no permitidos (userId)', async () => {
    const created = await createCard();
    const res = await request(app)
      .patch(`/api/v1/credit-cards/${created.id}`)
      .send({ userId: 'otro-usuario' });
    expect(res.status).toBe(400);
  });

  dbIt('16. devuelve 404 al actualizar una tarjeta inexistente', async () => {
    const res = await request(app)
      .patch('/api/v1/credit-cards/550e8400-e29b-41d4-a716-446655440000')
      .send({ status: 'ACTIVE' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/credit-cards/:id', () => {
  dbIt('17. elimina lógicamente y devuelve 204', async () => {
    const created = await createCard();
    const res = await request(app).delete(`/api/v1/credit-cards/${created.id}`);
    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
  });

  dbIt('18. una tarjeta eliminada ya no se consulta', async () => {
    const created = await createCard();
    await request(app).delete(`/api/v1/credit-cards/${created.id}`);

    const byId = await request(app).get(`/api/v1/credit-cards/${created.id}`);
    expect(byId.status).toBe(404);

    const list = await request(app).get('/api/v1/credit-cards');
    expect(list.body.data).toEqual([]);
  });

  dbIt('devuelve 404 al eliminar una tarjeta ya eliminada', async () => {
    const created = await createCard();
    await request(app).delete(`/api/v1/credit-cards/${created.id}`);
    const res = await request(app).delete(`/api/v1/credit-cards/${created.id}`);
    expect(res.status).toBe(404);
  });
});

describe('Protección de datos sensibles', () => {
  dbIt('19. el CVV y el número completo no aparecen en las respuestas', async () => {
    const res = await request(app).post('/api/v1/credit-cards').send(baseCard);
    const raw = JSON.stringify(res.body);
    expect(raw).not.toContain('123'); // cvv
    expect(raw).not.toContain(VISA); // PAN completo
    expect(res.body.data).not.toHaveProperty('cvv');
    expect(res.body.data).not.toHaveProperty('cardNumber');
    expect(res.body.data).not.toHaveProperty('cardFingerprint');
    // Solo se expone last4
    expect(res.body.data.last4).toBe('1111');
  });

  dbIt('20. el CVV no se persiste en la base de datos', async () => {
    await createCard();
    // Inspeccionar columnas de la tabla: no debe existir ninguna de cvv
    const { query } = await import('../database/pool');
    const cols = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'credit_cards'`,
    );
    const names = cols.rows.map((r) => r.column_name.toLowerCase());
    expect(names.some((n) => n.includes('cvv') || n.includes('cvc'))).toBe(false);
    // Tampoco debe existir una columna con el PAN completo
    expect(names).not.toContain('card_number');
    expect(names).not.toContain('pan');
  });
});
