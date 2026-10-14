-- Migración 001: tabla credit_cards
-- Nomenclatura snake_case (convención PostgreSQL).

-- Extensión para generar UUIDs. pgcrypto provee gen_random_uuid().
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Tipo enumerado para el estado de la tarjeta.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'card_status') THEN
    CREATE TYPE card_status AS ENUM ('ACTIVE', 'BLOCKED', 'EXPIRED');
  END IF;
END$$;

-- Tipo enumerado para la marca de la tarjeta.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'card_brand') THEN
    CREATE TYPE card_brand AS ENUM ('VISA', 'MASTERCARD');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS credit_cards (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           TEXT NOT NULL,
  -- Huella criptográfica (HMAC-SHA256) para detectar duplicados sin guardar el PAN.
  card_fingerprint  TEXT NOT NULL,
  -- Solo los últimos 4 dígitos, suficientes para reconocer la tarjeta en UI.
  last4             CHAR(4) NOT NULL,
  brand             card_brand NOT NULL,
  -- Límite de crédito: numérico y no negativo.
  credit_limit      NUMERIC(14, 2) NOT NULL CHECK (credit_limit >= 0),
  expiration_month  SMALLINT NOT NULL CHECK (expiration_month BETWEEN 1 AND 12),
  expiration_year   SMALLINT NOT NULL CHECK (expiration_year BETWEEN 1970 AND 2100),
  status            card_status NOT NULL DEFAULT 'ACTIVE',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Eliminación lógica (soft delete). NULL = tarjeta vigente.
  deleted_at        TIMESTAMPTZ NULL
);

-- Índice para listar/buscar tarjetas vigentes de un usuario rápidamente.
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_active
  ON credit_cards (user_id)
  WHERE deleted_at IS NULL;

-- Evitar duplicados de la MISMA tarjeta vigente para el MISMO usuario.
-- El índice único parcial solo aplica a filas no eliminadas.
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_cards_user_fingerprint_active
  ON credit_cards (user_id, card_fingerprint)
  WHERE deleted_at IS NULL;

ALTER TYPE card_brand ADD VALUE IF NOT EXISTS 'AMERICAN EXPRESS';
ALTER TYPE card_brand ADD VALUE IF NOT EXISTS 'DISCOVER';
