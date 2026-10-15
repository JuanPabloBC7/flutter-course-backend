# flutter_course_backend

Backend de aprendizaje con **dos ejemplos independientes** que corren sobre el
**mismo servidor Express**. No hay que levantar procesos distintos: un único
`npm run dev` (o `npm start`) expone ambos bajo `/api/v1`:

- **Credit Cards** (`/api/v1/credit-cards`): API REST para gestionar tarjetas de
  crédito con validación de numeración (Luhn), marca, vencimiento y CVV.
- **Workers** (`/api/v1/workers`): demostración del **Event Loop** de Node.js y
  de los **worker_threads** (cómo una carga de CPU bloquea el hilo principal
  frente a cómo delegarla a un hilo aparte lo mantiene libre).

Además hay un tercer ejemplo que **no** corre sobre Express y se ejecuta aparte:

- **Scaling Nodes** (`src/scaling-nodes/`): escalamiento horizontal con **TCP
  puro** (módulo `net`). Varios nodos trabajadores independientes y un
  balanceador Round-Robin que reparte la carga entre ellos. Vive en `src/` como
  los demás, pero se levanta en varias terminales (ver su sección abajo).

> Ámbito del ejemplo de tarjetas: administración de tarjetas y sus límites.
> **No** procesa pagos ni cobros reales.

## Arquitectura

```
src/
├── credit-cards/            Ejemplo 1: gestión de tarjetas
│   ├── config/              Validación y carga de variables de entorno (zod)
│   ├── credit-card/         Dominio: validación, tipos, esquemas, repo, servicio, rutas
│   ├── database/            Pool de conexiones, migraciones y runner
│   ├── errors/              Jerarquía de errores y formato uniforme
│   ├── middleware/          Validación y manejo centralizado de errores
│   ├── test/                Pruebas unitarias y de integración
│   └── docs/                Ejemplos curl y colección Postman
├── workers/                 Ejemplo 2: Event Loop + worker_threads
│   ├── heavy-cpu-worker/    Worker thread + constante de carga compartida
│   └── endpoints/           Router de /api/v1/workers
├── scaling-nodes/           Ejemplo 3: escalamiento horizontal TCP (NO Express)
│   ├── worker-node.ts       Nodo trabajador TCP (net.createServer)
│   ├── balancer.ts          Balanceador Round-Robin (proxy TCP en :8080)
│   └── test.ts              Cliente de prueba que bombardea el proxy
├── app.ts                   App Express compartida (monta credit-cards y workers)
└── server.ts                Arranque del servidor + apagado ordenado
```

`credit-cards` y `workers` comparten `app.ts`/`server.ts`: un solo servidor, dos
routers montados en prefijos distintos. **`scaling-nodes` es independiente**: no
pasa por `app.ts`, son procesos TCP sueltos que se arrancan a mano.

## Requisitos

- Node.js 20 o superior.
- PostgreSQL 13 o superior (solo necesario para el ejemplo de **credit-cards**).

## Cómo ejecutar

```bash
npm install
cp .env.example .env        # ajusta los valores (ver tabla abajo)
npm run migrate             # aplica migraciones (requiere PostgreSQL)

npm run dev                 # desarrollo con recarga automática
# o en producción:
npm run build && npm start
```

Comprobación rápida del servidor:

```bash
curl http://localhost:4000/health
# -> {"status":"ok"}
```

Variables de entorno principales (ver `.env.example` para la lista completa):

| Variable                  | Descripción                                              |
|---------------------------|----------------------------------------------------------|
| `PORT`                    | Puerto HTTP (por defecto 4000).                          |
| `PGHOST` … `PGDATABASE`   | Conexión a PostgreSQL (ejemplo de credit-cards).         |
| `CORS_ORIGINS`            | Orígenes permitidos, separados por coma. Vacío = CORS off.|
| `CARD_FINGERPRINT_SECRET` | Secreto (>= 16 chars) para la huella HMAC de tarjetas.   |

La aplicación **valida la configuración al arrancar** y no inicia si falta o es
inválida alguna variable.

---

## Ejemplo 1: Credit Cards

API REST para listar, consultar, crear, actualizar y eliminar lógicamente
tarjetas. La marca se detecta a partir de la numeración; el CVV y el PAN nunca
se almacenan.

### Stack

Node.js 20 · TypeScript 5 (strict) · Express 4 · PostgreSQL + `pg` (SQL
parametrizado, sin ORM) · zod (validación) · Jest + supertest (pruebas).

### Base de datos y migraciones

```bash
createdb credit_cards
createdb credit_cards_test
npm run migrate
```

El runner es idempotente y registra lo aplicado en `schema_migrations`. La tabla
`credit_cards` guarda solo `last4` + una **huella HMAC-SHA256**
(`card_fingerprint`), nunca el PAN; usa soft delete (`deleted_at`) y un índice
único parcial `(user_id, card_fingerprint)` para evitar duplicados vigentes.

### Endpoints (`/api/v1/credit-cards`)

Las respuestas exitosas usan el envoltorio `{ "data": ... }`.

| Método | Ruta                | Descripción                        | Éxito |
|--------|---------------------|------------------------------------|-------|
| GET    | `/credit-cards`     | Lista tarjetas activas.            | 200   |
| GET    | `/credit-cards/:id` | Obtiene una tarjeta por id (UUID). | 200   |
| POST   | `/credit-cards`     | Crea una tarjeta.                  | 201   |
| PATCH  | `/credit-cards/:id` | Actualiza `creditLimit`/`status`.  | 200   |
| DELETE | `/credit-cards/:id` | Eliminación lógica.                | 204   |

Códigos de error: `400` (entrada inválida), `404` (no existe/eliminada),
`409` (duplicado), `500` (interno). Formato uniforme:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "La solicitud contiene datos inválidos",
    "details": [
      { "field": "creditLimit", "message": "creditLimit no puede ser negativo" }
    ]
  }
}
```

Más ejemplos: [`src/credit-cards/docs/curl-examples.md`](src/credit-cards/docs/curl-examples.md)
y la colección de Postman en
[`src/credit-cards/docs/postman_collection.json`](src/credit-cards/docs/postman_collection.json).

### Validación

El módulo `src/credit-cards/credit-card/card-validator.ts` cubre: limpieza de
separadores, **Luhn**, detección de **marca** (VISA, Mastercard, American
Express, Discover), longitudes por marca, **vencimiento** (válida hasta el
último día del mes) y **CVV** por marca. Estas validaciones comprueban formato,
numeración, checksum, marca y fecha; **no** verifican que la tarjeta exista,
esté emitida o tenga crédito disponible.

### Seguridad (notas)

- El **PAN nunca se almacena**: solo `last4` y la huella HMAC.
- El **CVV nunca se persiste** ni se devuelve; solo vive en memoria durante la
  validación.
- SQL **parametrizado**, límite de cuerpo (10 KB), CORS explícito y soft delete.
- La huella HMAC es una referencia interna, **no** sustituye la tokenización ni
  implica cumplimiento PCI DSS. Los endpoints **no** incluyen autenticación: hay
  que protegerlos antes de un uso real.

### Cómo probar

```bash
npm run test:unit   # unitarias de validación (no requieren base de datos)
NODE_ENV=test PGDATABASE=credit_cards_test npm test   # + integración
```

La suite de integración recorre los cinco endpoints con `supertest`. Si no hay
PostgreSQL accesible, **se omite con un aviso** (no simula resultados).

---

## Ejemplo 2: Workers

Demuestra cómo trabaja el **Event Loop** de Node.js y para qué sirven los
**worker_threads**. La idea: una carga de CPU sincrónica bloquea todo el
servidor, mientras que la misma carga dentro de un worker deja el hilo principal
libre para seguir respondiendo.

El bucle pesado usa una constante compartida `HEAVY_ITERATIONS`
(`src/workers/heavy-cpu-worker/worker-config.ts`): un bucle **deliberadamente
pesado pero finito**, pensado solo para notar el bloqueo sin colgar el proceso.

### Rutas (`/api/v1/workers`)

| Método | Ruta                 | Qué hace                                                       |
|--------|----------------------|----------------------------------------------------------------|
| GET    | `/`                  | Saludo: `{ "message": "Hello World" }`.                        |
| GET    | `/health`            | Salud del ejemplo: `{ "status": "ok", "active": true }`.       |
| GET    | `/fast`              | Respuesta inmediata; "termómetro" del Event Loop.              |
| GET    | `/slow-io`           | I/O no bloqueante (~4 s con `setTimeout`); el Event Loop sigue libre. |
| GET    | `/heavy-cpu-block`   | CPU pesada **en el hilo principal**: bloquea el Event Loop.    |
| GET    | `/heavy-cpu-worker`  | La misma carga en un **worker thread**: el hilo principal sigue libre. |

### Qué observar

Abre dos terminales. Mientras una petición pesada corre, prueba `/fast` en la otra:

- Durante **`/heavy-cpu-block`**, `/fast` queda **congelada** hasta que termina
  el bucle (el Event Loop está secuestrado).
- Durante **`/heavy-cpu-worker`**, `/fast` **responde al instante**: el bucle
  corre en otro hilo y el Event Loop del hilo principal sigue libre.

### Ejemplos curl

```bash
curl http://localhost:4000/api/v1/workers
curl http://localhost:4000/api/v1/workers/health
curl http://localhost:4000/api/v1/workers/fast
curl http://localhost:4000/api/v1/workers/slow-io
curl http://localhost:4000/api/v1/workers/heavy-cpu-block
curl http://localhost:4000/api/v1/workers/heavy-cpu-worker
```

En `npm run dev` el worker se transpila al vuelo con `ts-node`; en producción
(`npm start`) usa el `.js` ya compilado en `dist/`. Funciona en ambos modos sin
pasos extra.

---

## Ejemplo 3: Scaling Nodes

Demuestra el **escalamiento horizontal**: en vez de un servidor más grande, se
levantan varias **instancias independientes** (nodos) y un **balanceador** que
reparte el tráfico entre ellas. A diferencia de los workers (varios hilos dentro
de un proceso), aquí cada nodo es un **proceso aparte** con su propia memoria y
su propio Event Loop; se comunican solo por **sockets TCP**.

Este ejemplo **no usa Express ni HTTP**: es TCP puro con el módulo nativo `net`
(balanceador de Capa 4). Por eso no se monta en `app.ts` ni responde bajo
`/api/v1`; son procesos sueltos que se corren a mano.

### Piezas (`src/scaling-nodes/`)

| Archivo          | Rol                                                                 |
|------------------|---------------------------------------------------------------------|
| `worker-node.ts` | Nodo trabajador TCP. Toma el puerto de la CLI y simula carga (500 ms). |
| `balancer.ts`    | Proxy TCP en `:8080`. Round-Robin (`idx % nodos`) + piping de sockets. |
| `test.ts`        | Cliente que abre 6 conexiones al proxy para ver el reparto.         |

### Cómo ejecutar (varias terminales)

Levanta los 3 nodos y el balanceador, cada uno en su propia terminal:

```bash
# Terminal 1, 2 y 3: nodos trabajadores en puertos distintos
npm run nodes:worker 3001
npm run nodes:worker 3002
npm run nodes:worker 3003

# Terminal 4: balanceador (proxy en el puerto 8080)
npm run nodes:balancer
```

Luego, en una 5.ª terminal, lanza la prueba de estrés:

```bash
npm run nodes:test
```

### Qué observar

Las 6 peticiones se reparten de forma secuencial entre los nodos gracias al
Round-Robin (3001 → 3002 → 3003 → 3001 → 3002 → 3003), demostrando la
distribución de carga entre nodos independientes:

```
Req 1: Respuesta desde Nodo-3001
Req 2: Respuesta desde Nodo-3002
Req 3: Respuesta desde Nodo-3003
Req 4: Respuesta desde Nodo-3001
Req 5: Respuesta desde Nodo-3002
Req 6: Respuesta desde Nodo-3003
```

> El orden exacto de impresión puede variar: las respuestas vuelven en paralelo
> tras los 500 ms, pero el nodo asignado a cada petición sigue el Round-Robin.

**Tolerancia a fallos:** si tumbas un nodo (Ctrl+C en su terminal), el
balanceador captura el evento `error` y no se cae; el resto de nodos sigue
atendiendo.

---

## Limitaciones pendientes para un despliegue real (credit-cards)

- Integrar autenticación y autorización.
- Sustituir la huella HMAC por tokenización de un proveedor de pagos certificado.
- Añadir una tabla `users` real y clave foránea para `user_id`.
- Rate limiting, observabilidad y auditoría.
- Revisión de cumplimiento PCI DSS según el alcance.
