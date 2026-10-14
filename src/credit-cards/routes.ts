/**
 * Rutas y controladores de tarjetas bajo /api/v1/credit-cards.
 *
 * Los controladores traducen request/response <-> servicio: no contienen
 * lógica de negocio ni acceso a datos. Se definen aquí mismo porque son una
 * capa delgada de mapeo sobre el router.
 */

import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { validateBody, validateParams } from '../middleware/validate';
import {
  cardIdParamSchema,
  createCardSchema,
  updateCardSchema,
} from './schemas';
import type { CreateCardBody, UpdateCardBody } from './schemas';
import * as service from './service';
import type { CreateCardInput, UpdateCardInput } from './types';

/**
 * Envuelve un handler async para propagar errores al manejador central.
 * Evita try/catch repetido en cada controlador.
 */
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/** GET /api/v1/credit-cards — lista tarjetas activas. */
const listCards = asyncHandler(async (_req, res) => {
  const cards = await service.listActiveCards();
  res.status(200).json({ data: cards });
});

/** GET /api/v1/credit-cards/:id — obtiene una tarjeta por id. */
const getCard = asyncHandler(async (req, res) => {
  const { id } = req.params as { id: string };
  const card = await service.getCardById(id);
  res.status(200).json({ data: card });
});

/** POST /api/v1/credit-cards — crea una tarjeta. */
const createCard = asyncHandler(async (req, res) => {
  const body = req.body as CreateCardBody;
  const input: CreateCardInput = {
    userId: body.userId,
    cardNumber: body.cardNumber,
    expirationMonth: body.expirationMonth,
    expirationYear: body.expirationYear,
    cvv: body.cvv,
    creditLimit: body.creditLimit,
  };
  const card = await service.createCard(input);
  // Nota: el CVV y el PAN quedan solo en memoria durante esta solicitud.
  res.status(201).json({ data: card });
});

/** PATCH /api/v1/credit-cards/:id — actualiza creditLimit y/o status. */
const updateCard = asyncHandler(async (req, res) => {
  const { id } = req.params as { id: string };
  const body = req.body as UpdateCardBody;
  const input: UpdateCardInput = {
    ...(body.creditLimit !== undefined ? { creditLimit: body.creditLimit } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
  };
  const card = await service.updateCard(id, input);
  res.status(200).json({ data: card });
});

/** DELETE /api/v1/credit-cards/:id — eliminación lógica. */
const deleteCard = asyncHandler(async (req, res) => {
  const { id } = req.params as { id: string };
  await service.deleteCard(id);
  // 204 sin cuerpo
  res.status(204).send();
});

export const creditCardRouter = Router();

// GET /api/v1/credit-cards
creditCardRouter.get('/', listCards);

// POST /api/v1/credit-cards
creditCardRouter.post('/', validateBody(createCardSchema), createCard);

// GET /api/v1/credit-cards/:id
creditCardRouter.get('/:id', validateParams(cardIdParamSchema), getCard);

// PATCH /api/v1/credit-cards/:id
creditCardRouter.patch(
  '/:id',
  validateParams(cardIdParamSchema),
  validateBody(updateCardSchema),
  updateCard,
);

// DELETE /api/v1/credit-cards/:id
creditCardRouter.delete(
  '/:id',
  validateParams(cardIdParamSchema),
  deleteCard,
);
