# flutter_course_backend_js

Backend mínimo en Node.js + Express.

## Setup

```bash
cd flutter_course_backend_js
npm install
```

## Correr el servidor

```bash
npm start
# o en modo watch (recarga al guardar):
npm run dev
```

El servidor queda en http://localhost:3000

## Endpoints

| Método | Ruta      | Respuesta                          |
|--------|-----------|------------------------------------|
| GET    | `/`       | `{ "message": "Hello World" }`     |
| GET    | `/health` | `{ "status": "ok", "active": true }` |

## Probar

```bash
curl http://localhost:3000/
curl http://localhost:3000/health
```
