/**
 * Construcción de la aplicación Express (sin arrancar el listener).
 * Se exporta para poder usarla en pruebas de integración con supertest.
 */

import cors, { type CorsOptions } from 'cors';
import express, { type Application } from 'express';
import { getCorsOrigins } from './config/env';
import { creditCardRouter } from './credit-cards/routes';
import { errorHandler, notFoundHandler } from './middleware/error-handler';

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

  // Healthcheck simple
  app.get('/health', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  // Rutas de negocio bajo el prefijo /api/v1
  app.use('/api/v1/credit-cards', creditCardRouter);

  // 404 para rutas no registradas
  app.use(notFoundHandler);

  // Manejo centralizado de errores (siempre al final)
  app.use(errorHandler);

  return app;
}
