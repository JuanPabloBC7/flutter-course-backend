import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

// Cargar variables desde .env (si existe) hacia process.env
loadDotenv();

/**
 * Esquema de validación de las variables de entorno.
 * La aplicación no debe arrancar si la configuración es inválida.
 */
const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  // Lista de orígenes CORS separada por comas (puede venir vacía)
  CORS_ORIGINS: z.string().default(''),

  // PostgreSQL
  PGHOST: z.string().min(1).default('localhost'),
  PGPORT: z.coerce.number().int().positive().default(5432),
  PGUSER: z.string().min(1),
  PGPASSWORD: z.string(),
  PGDATABASE: z.string().min(1),
  PG_POOL_MAX: z.coerce.number().int().positive().default(10),
  PG_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),

  // Secreto para la huella criptográfica (fingerprint) de tarjetas
  CARD_FINGERPRINT_SECRET: z
    .string()
    .min(16, 'CARD_FINGERPRINT_SECRET debe tener al menos 16 caracteres'),
});

export type AppEnv = z.infer<typeof envSchema>;

/**
 * Valida y devuelve la configuración tipada.
 * Lanza un error legible (sin filtrar secretos) si algo falta o es inválido.
 */
function loadEnv(): AppEnv {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // Mostrar solo los nombres de campo y el motivo, nunca el valor recibido
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Configuración de entorno inválida. Revisa tu archivo .env:\n${issues}`,
    );
  }

  return parsed.data;
}

// Configuración validada, lista para usarse en toda la app
export const env: AppEnv = loadEnv();

/** Devuelve la lista de orígenes CORS ya parseada (sin elementos vacíos). */
export function getCorsOrigins(): string[] {
  return env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
