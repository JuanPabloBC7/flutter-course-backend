/**
 * Setup global de Jest.
 *
 * Define valores por defecto SEGUROS para las variables de entorno necesarias
 * de modo que los módulos (que validan env al importarse) puedan cargarse
 * durante las pruebas. Estos valores NO son credenciales reales y apuntan a
 * una base de datos de PRUEBAS. No sobreescriben lo que ya exista en el entorno.
 */

process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.PGHOST = process.env.PGHOST ?? 'localhost';
process.env.PGPORT = process.env.PGPORT ?? '5432';
process.env.PGUSER = process.env.PGUSER ?? 'postgres';
process.env.PGPASSWORD = process.env.PGPASSWORD ?? 'postgres';
// Base de datos de PRUEBAS por defecto (aislada de desarrollo/producción)
process.env.PGDATABASE = process.env.PGDATABASE ?? 'credit_cards_test';
process.env.CARD_FINGERPRINT_SECRET =
  process.env.CARD_FINGERPRINT_SECRET ?? 'test-secret-at-least-16-chars-long';
