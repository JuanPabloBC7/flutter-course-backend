# Ejemplos de cURL

Base: `http://localhost:4000/api/v1`. Ajusta el puerto según tu `.env`.

> Los números de tarjeta son **sintéticos** y Luhn-válidos, solo para pruebas.
> No uses tarjetas reales.

Variable de ayuda:

```bash
BASE=http://localhost:4000/api/v1
```

- Rangos:
| Red              | Código     | Dígitos | Inicio Típico                     | Dígitos     |
| ---------------- |:----------:|:-------:|:---------------------------------:|:-----------:|
| Visa             | CVV / CVV2 | 3       | 4                                 | 16, 13 y 19 |
| Mastercard       | CVC / CVC2 | 3       | 51-55 o 222100-272099             | 16          |
| American Express | CID        | 4       | 34 o 37                           | 15          |
| Discover         | CID        | 3       | 6011, 65, 644-649 o 622126–622925 | 16          |

- Examples:
| Visa             | Mastercard       | American Express | Discover         |
| ---------------- |:----------------:|:----------------:|:----------------:|
| 4111111111111111 | 5555555555554444 | 378282246310005  | 6011111111111117 |
| 4012888888881881 | 5105105105105100 | 371449635398431  | 6011000990139424 |
| 4222222222222220 | 5200828282828210 | 378734493671000  | 6011000000000004 |
| 4532015112830366 | 2223000048400011 | 340000000000009  | 6500000000000002 |
| 4916338506082832 | 2720991234567890 | 370000000000002  | 6440000000000008 |

---

## API 3 — Crear tarjeta (POST) — caso exitoso

```bash
curl -i -X POST "$BASE/credit-cards" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "cardNumber": "4111 1111 1111 1111",
    "expirationMonth": 12,
    "expirationYear": 2030,
    "cvv": "123",
    "creditLimit": 5000.00
  }'
# 201 Created
# { "data": { "id": "...", "userId": "user-123", "brand": "VISA",
#             "last4": "1111", "creditLimit": "5000.00", "status": "ACTIVE",
#             "expirationMonth": 12, "expirationYear": 2030, ... } }
```

### Crear — error: falta userId (400)

```bash
curl -i -X POST "$BASE/credit-cards" \
  -H "Content-Type: application/json" \
  -d '{ "cardNumber": "4111111111111111", "expirationMonth": 12,
        "expirationYear": 2030, "cvv": "123", "creditLimit": 5000 }'
# 400 Bad Request -> error.code = VALIDATION_ERROR
```

### Crear — error: checksum de Luhn inválido (400)

```bash
curl -i -X POST "$BASE/credit-cards" \
  -H "Content-Type: application/json" \
  -d '{ "userId": "user-123", "cardNumber": "4111111111111112",
        "expirationMonth": 12, "expirationYear": 2030, "cvv": "123",
        "creditLimit": 5000 }'
# 400 Bad Request
```

### Crear — Mastercard (rango 2221–2720)

```bash
curl -i -X POST "$BASE/credit-cards" \
  -H "Content-Type: application/json" \
  -d '{ "userId": "user-456", "cardNumber": "2221000000000009",
        "expirationMonth": 6, "expirationYear": 2029, "cvv": "321",
        "creditLimit": 3000 }'
# 201 Created -> data.brand = "MASTERCARD"
```

---

## API 1 — Listar tarjetas activas (GET)

```bash
curl -i "$BASE/credit-cards"
# 200 OK -> { "data": [ ... ] }   (array vacío si no hay tarjetas)
```

---

## API 5 — Obtener una tarjeta por id (GET)

Sustituye `<ID>` por el id devuelto al crear.

```bash
curl -i "$BASE/credit-cards/<ID>"
# 200 OK -> { "data": { ... } }
```

### Obtener — no existe (404)

```bash
curl -i "$BASE/credit-cards/550e8400-e29b-41d4-a716-446655440000"
# 404 Not Found -> error.code = NOT_FOUND
```

### Obtener — id con formato inválido (400)

```bash
curl -i "$BASE/credit-cards/not-a-uuid"
# 400 Bad Request -> error.code = VALIDATION_ERROR
```

---

## API 2 — Actualizar tarjeta (PATCH)

```bash
curl -i -X PATCH "$BASE/credit-cards/<ID>" \
  -H "Content-Type: application/json" \
  -d '{ "creditLimit": 7500.00, "status": "ACTIVE" }'
# 200 OK -> { "data": { ..., "creditLimit": "7500.00" } }
```

### Actualizar solo un campo

```bash
curl -i -X PATCH "$BASE/credit-cards/<ID>" \
  -H "Content-Type: application/json" \
  -d '{ "status": "BLOCKED" }'
# 200 OK
```

### Actualizar — cuerpo vacío (400)

```bash
curl -i -X PATCH "$BASE/credit-cards/<ID>" \
  -H "Content-Type: application/json" \
  -d '{}'
# 400 Bad Request
```

### Actualizar — campo no permitido (400)

```bash
curl -i -X PATCH "$BASE/credit-cards/<ID>" \
  -H "Content-Type: application/json" \
  -d '{ "userId": "otro" }'
# 400 Bad Request (strict: solo creditLimit y status)
```

### Actualizar — valor inválido (400)

```bash
curl -i -X PATCH "$BASE/credit-cards/<ID>" \
  -H "Content-Type: application/json" \
  -d '{ "creditLimit": -1 }'
# 400 Bad Request
```

### Actualizar — tarjeta inexistente (404)

```bash
curl -i -X PATCH "$BASE/credit-cards/550e8400-e29b-41d4-a716-446655440000" \
  -H "Content-Type: application/json" \
  -d '{ "status": "ACTIVE" }'
# 404 Not Found
```

---

## API 4 — Eliminar tarjeta (DELETE, soft delete)

```bash
curl -i -X DELETE "$BASE/credit-cards/<ID>"
# 204 No Content (sin cuerpo)
```

### Eliminar — ya eliminada o inexistente (404)

```bash
curl -i -X DELETE "$BASE/credit-cards/<ID>"
# 404 Not Found (al repetir sobre una ya eliminada)
```

### Verificar que no reaparece

```bash
curl -i "$BASE/credit-cards/<ID>"      # 404
curl -i "$BASE/credit-cards"           # no incluye la tarjeta eliminada
```
