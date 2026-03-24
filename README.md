# Luces LED MVP

Proyecto MVP con backend en Spring Boot y frontend en React para recomendacion de productos LED por compatibilidad vehicular.

## Stack
- Backend principal: TypeScript (Node.js + Express + PostgreSQL)
- Chatbot comercial: Python 3.12+ + FastAPI + OpenAI Responses API
- Backend legado: Java 21+, Spring Boot 3.3.x, Spring Data JPA, Flyway
- Base de datos: PostgreSQL 16
- Frontend: React + Vite
- Infra local: Docker Compose

## Estructura
```text
.
|-- backend/
|   |-- endpoints.http
|   |-- pom.xml
|   `-- src/main/java/com/example/mvp/...
|-- backend-ts/
|   |-- package.json
|   `-- src/...
|-- chatbot-python/
|   |-- app/
|   |-- tests/
|   `-- CODE_GUIDE.md
|-- database/
|   |-- V1__init.sql
|   |-- V2__seed.sql
|   |-- V3__catalogos_extendidos.sql
|   |-- V4__seed_catalogos_extendidos.sql
|   |-- V5__recomendaciones_resolver.sql
|   `-- V6__retencion_consultas_metricas.sql
|-- frontend/
|-- docker-compose.yml
|-- .env.example
`-- README.md
```

## Requisitos
- Node.js 20 o superior
- Python 3.12 o superior
- Docker Desktop (con Compose)
- (Opcional, solo backend legado) Java 21+ y Maven 3.9+

## Instalacion y configuracion
1. Copia variables de entorno:
```bash
Copy-Item .env.example .env
```
2. Ajusta valores en `.env` segun tu entorno.

## Ejecucion local

### 1) Levantar PostgreSQL
```bash
docker compose up -d
```

### 2) Levantar backend
Backend TypeScript (recomendado), desde `backend-ts`:
```bash
npm install
npm run dev
```

Backend Java legado, desde [backend/pom.xml](c:\Users\Sebastian\OneDrive\Desktop\programacion empirica\UDEMY\Matrices\backend\pom.xml):
```bash
mvn spring-boot:run
```

### 3) Levantar chatbot Python
Desde [chatbot-python/pyproject.toml](C:\Users\USER\Desktop\proyecto luces\chatbot-python\pyproject.toml):
```bash
cd chatbot-python
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -e .[dev]
uvicorn app.main:app --reload --port 8001
```

Variables necesarias en `.env`:
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `CHATBOT_PORT`
- `BACKEND_API_BASE_URL`
- `CHAT_SESSION_TTL_MINUTES`

### 4) Levantar frontend
Desde [frontend/package.json](c:\Users\Sebastian\OneDrive\Desktop\programacion empirica\UDEMY\Matrices\frontend\package.json):
```bash
npm install
npm run dev
```

## Uso rapido
- Dashboard frontend:
  - `/encuesta`
  - `/resultado`
  - `/productos`
  - `/compatibilidades`
- Chatbot web:
  - Widget flotante visible en rutas publicas
  - `GET /api/chat/health`
  - `POST /api/chat/message`
- Login administrador:
  - `POST /api/auth/login`
  - Usuario inicial seed: `admin`
  - Password inicial seed: `admin123`
- Endpoints HTTP listos para ejecutar:
  - [backend/endpoints.http](c:\Users\Sebastian\OneDrive\Desktop\programacion empirica\UDEMY\Matrices\backend\endpoints.http)

### Endpoint clave de recomendacion
`POST /api/recomendaciones/resolver`

Ejemplo de request:
```json
{
  "marcaId": 1,
  "modeloId": 1,
  "anioVehiculo": 2018,
  "perfilUsoId": 3,
  "tipoPolarizadoId": 1,
  "tipoSistemaOpticoId": 2
}
```

## Migraciones y seed

Flyway se ejecuta automaticamente al iniciar backend.

Migraciones actuales:
- `V1`: esquema inicial
- `V2`: seed inicial
- `V3` y `V4`: catalogos extendidos + seed
- `V5`: soporte de resolver de recomendaciones
- `V6`: retencion de consultas y metricas diarias

Verifica estado de migraciones:
```sql
SELECT installed_rank, version, description, success
FROM flyway_schema_history
ORDER BY installed_rank;
```

Si necesitas reiniciar base y aplicar migraciones/seed desde cero:
```bash
docker compose down -v
docker compose up -d
```
y luego vuelve a iniciar el backend.

## Politica de retencion de datos

Tarea programada (`@Scheduled`) configurable por propiedades:
1. Anonimiza `nombre_cliente` y `telefono_cliente` en consultas > 90 dias.
2. Consolida metricas en `metricas_recomendacion_diaria`.
3. Elimina `consulta_recomendaciones` > 365 dias.
4. Elimina `consultas` > 540 dias.

Variables relevantes (ver [.env.example](c:\Users\Sebastian\OneDrive\Desktop\programacion empirica\UDEMY\Matrices\.env.example)):
- `RETENCION_ENABLED`
- `RETENCION_CRON`
- `RETENCION_DIAS_ANONIMIZAR`
- `RETENCION_DIAS_ELIMINAR_RECOMENDACIONES`
- `RETENCION_DIAS_ELIMINAR_CONSULTAS`
- `RETENCION_NOMBRE_ANONIMO`
- `RETENCION_TELEFONO_ANONIMO`

## Pruebas

Desde [backend/pom.xml](c:\Users\Sebastian\OneDrive\Desktop\programacion empirica\UDEMY\Matrices\backend\pom.xml):
```bash
mvn test
```

Frontend React:
```bash
cd frontend
npm test
```

Chatbot Python:
```bash
cd chatbot-python
.venv\Scripts\Activate.ps1
pytest
```

Pruebas agregadas para recomendacion:
- Unitarias de servicio:
  - [RecomendacionResolverServiceTest.java](c:\Users\Sebastian\OneDrive\Desktop\programacion empirica\UDEMY\Matrices\backend\src\test\java\com\example\mvp\recomendacion\RecomendacionResolverServiceTest.java)
- Integracion web del endpoint:
  - [RecomendacionResolverControllerIntegrationTest.java](c:\Users\Sebastian\OneDrive\Desktop\programacion empirica\UDEMY\Matrices\backend\src\test\java\com\example\mvp\recomendacion\RecomendacionResolverControllerIntegrationTest.java)

## Troubleshooting

1. `mvn` no reconocido
- Instala Maven o agrega Maven al `PATH`.
- Verifica con `mvn -v`.

2. `docker` no reconocido o daemon apagado
- Instala/abre Docker Desktop.
- Verifica con `docker --version` y `docker compose version`.

3. Error de conexion a PostgreSQL
- Revisa `DB_HOST`, `DB_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` en `.env`.
- Confirma que el contenedor este arriba: `docker compose ps`.

4. Flyway validation/migration failed
- Revisa orden y nombres de scripts en [database](c:\Users\Sebastian\OneDrive\Desktop\programacion empirica\UDEMY\Matrices\database).
- Si es ambiente local descartable, reinicia volumen de DB (`docker compose down -v`) y vuelve a levantar.

5. `POST /api/recomendaciones/resolver` retorna sin resultados
- Verifica que existan:
  - compatibilidades activas para modelo/anio
  - productos disponibles para casquillo/posicion/sistema optico
  - reglas de recomendacion para perfiles y productos

6. El chatbot responde `503`
- Verifica que `OPENAI_API_KEY` exista en `.env`.
- Confirma que el servicio Python este arriba en `http://localhost:8001/api/chat/health`.
- Revisa la guia tecnica en [chatbot-python/CODE_GUIDE.md](C:\Users\USER\Desktop\proyecto luces\chatbot-python\CODE_GUIDE.md).

## Detener servicios
- Backend/Chatbot/Frontend: `Ctrl + C`
- PostgreSQL:
```bash
docker compose down
```
