/**
 * Construcción de la aplicación Express (sin arrancar el listener).
 * Monta los dos ejemplos independientes sobre el MISMO servidor:
 *   - /api/v1/credit-cards (gestión de tarjetas)
 *   - /api/v1/workers      (Event Loop + worker_threads)
 * Se exporta para poder usarla en pruebas de integración con supertest.
 */

import cors, { type CorsOptions } from 'cors';
import express, { type Application } from 'express';
import { getCorsOrigins } from './credit-cards/config/env';
import { creditCardRouter } from './credit-cards/credit-card/routes';
import { errorHandler, notFoundHandler } from './credit-cards/middleware/error-handler';
import { workersRouter } from './workers/endpoints/workers-routes';

export function createApp(): Application {
  const app = express();

  // CORS explícito: solo los orígenes configurados. Si la lista está vacía,
  // no se habilita CORS (comportamiento restrictivo por defecto).
  const origins = getCorsOrigins();
  if (origins.length > 0) {
    const corsOptions: CorsOptions = {
      origin: origins,
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
    };
    app.use(cors(corsOptions));
  }

  // Límite razonable para el tamaño del cuerpo (previene payloads enormes)
  app.use(express.json({ limit: '10kb' }));

  // Healthcheck global del servidor
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Ejemplo 1: tarjetas de crédito
  app.use('/api/v1/credit-cards', creditCardRouter);

  // Ejemplo 2: workers y Event Loop
  app.use('/api/v1/workers', workersRouter);

  // 404 para rutas no registradas
  app.use(notFoundHandler);

  // Manejo centralizado de errores (siempre al final)
  app.use(errorHandler);

  return app;
}
