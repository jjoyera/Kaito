# Kaito

Kaito es una aplicación web planificada para actuar como coach de IA para
corredores de ultradistancia. Este repositorio ya incluye el primer scaffold
runnable del monorepo, pero todavía no implementa funcionalidades de producto.

## Visión general

El objetivo actual es ofrecer límites técnicos claros para futuras iteraciones:
una app web mínima, una API mínima y un paquete compartido reservado. La lógica
de entrenamiento, datos reales, integraciones e IA llegará en cambios posteriores.

## Stack tecnológico

| Área | Tecnología |
| --- | --- |
| Frontend | Next.js App Router con TypeScript |
| Backend | FastAPI con Python 3.12 |
| Paquetes JS/TS | pnpm 11 workspaces |
| Entorno Python | uv |
| Contenedores locales | Docker Compose solo para desarrollo local |

## Instalación

Requisitos recomendados:

- Node.js 24.18.
- pnpm 11.
- Python 3.12.
- uv.

Instala las dependencias JavaScript/TypeScript desde la raíz:

```bash
pnpm install
```

Instala las dependencias de la API desde `apps/api`:

```bash
cd apps/api
uv sync
```

## Ejecución

Ejecuta la web desde la raíz:

```bash
pnpm dev:web
```

La app web queda disponible en `http://localhost:3000`.

Valida de forma determinista que la home web arranca y muestra el texto esperado:

```bash
pnpm smoke:web
```

Ejecuta la API desde `apps/api`:

```bash
cd apps/api
uv run uvicorn app.main:app --reload
```

La API queda disponible en `http://localhost:8000`. Comprueba el endpoint de
salud con:

```bash
curl http://localhost:8000/health
```

La respuesta esperada es:

```json
{"status":"ok"}
```

También puedes levantar ambos servicios con Docker Compose para desarrollo local:

```bash
docker compose up --build
```

Compose solo define `web` y `api`; no es configuración de despliegue ni CD.

## Estructura del proyecto

```text
apps/
  web/                  App Next.js mínima.
  api/                  API FastAPI mínima con /health.
packages/
  api-client/           Paquete reservado; todavía no exporta un cliente real.
docker/                 Dockerfiles locales para web y API.
.github/workflows/     Validación básica de CI.
docs/                  Documentación de producto y arquitectura.
openspec/              Artefactos SDD/OpenSpec.
```

## Funcionalidades actuales

- Página web mínima que confirma que el scaffold frontend está funcionando.
- API FastAPI con `GET /health` que devuelve `{"status":"ok"}`.
- Validación básica: lint/build/smoke test de web y lint/smoke-load de API.
- Paquete `@kaito/api-client` reservado para un futuro cliente generado; hoy no
  exporta código ni contratos de producto.

No hay Supabase, base de datos/PostgreSQL, SQLAlchemy/Alembic, autenticación,
Strava, IA/RAG, onboarding, planes de entrenamiento ni despliegue/CD.

## Regla de actualización

Cualquier cambio futuro que modifique la estructura scaffolded, los comandos de
ejecución o las funcionalidades disponibles debe actualizar este `README.md` en
español dentro del mismo cambio.
