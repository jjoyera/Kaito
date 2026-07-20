# Kaito

<p align="center">
  <img src="apps/web/public/assets/brand/Kaito_logo.png" alt="Kaito" width="160">
</p>

Kaito es una aplicación web de planificación para corredores de Trail y Ultra Trail. El MVP entregado permite registrar e iniciar sesión con Supabase, completar un onboarding persistente de siete pasos, elegir un enfoque elegible, generar de forma síncrona un bloque de entrenamiento con OpenAI y consultar el plan activo en un dashboard y dos vistas de calendario.

> **Estado del proyecto:** MVP funcional para desarrollo y evaluación técnica. No está preparado para producción y no sustituye el criterio de profesionales del entrenamiento o de la salud.

## Inicio rápido

### Requisitos previos

- Node.js `>=24.18 <25` (consulta `.nvmrc`).
- pnpm `11.0.0`.
- Python `>=3.12` y [uv](https://docs.astral.sh/uv/).
- Un proyecto Supabase y una base de datos compatible con las migraciones de `supabase/migrations/`.
- Una clave de OpenAI para ejecutar la generación real.

### 1. Instalar dependencias

```bash
pnpm install
cd apps/api && uv sync && cd ../..
```

### 2. Configurar el entorno

Usa únicamente los archivos de ejemplo como inventario de variables; no copies valores sensibles a la documentación ni los confirmes en Git:

- Web: [`apps/web/.env.example`](apps/web/.env.example) → archivo local `apps/web/.env.local`.
- API: [`apps/api/.env.example`](apps/api/.env.example) → variables del proceso o archivo local cargado explícitamente con `--env-file`.

Configuración mínima por responsabilidad:

| Componente | Variables principales | Finalidad |
| --- | --- | --- |
| Web | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Registro, login y sesión Supabase. |
| Web | `NEXT_PUBLIC_KAITO_API_URL` | URL pública de la API, por ejemplo `http://localhost:8000`. |
| API | `DATABASE_URL`, `DATABASE_EXPECTED_ROLE` | Conexión runtime; el rol esperado es `kaito_api_login`. |
| API | `KAITO_WEB_ORIGIN` | Origen autorizado para CORS, por ejemplo `http://localhost:3000`. |
| API | `SUPABASE_JWKS_URL` y variables JWT relacionadas | Verificación de tokens emitidos por Supabase. |
| API | `OPENAI_API_KEY` | Generación real del bloque de entrenamiento. |
| Opcional | Variables Sentry de cada aplicación | Observabilidad; si no se configuran, Sentry permanece desactivado. |

No expongas `SUPABASE_SERVICE_ROLE_KEY`, secretos JWT, tokens ni claves de OpenAI en la web.

### 3. Arrancar la API y la web

Terminal 1:

```bash
cd apps/api
uv run uvicorn app.main:app --reload --env-file .env
```

Terminal 2, desde la raíz:

```bash
pnpm dev:web
```

- Web: `http://localhost:3000`
- API: `http://localhost:8000`
- OpenAPI: `http://localhost:8000/docs`
- Salud: `curl http://localhost:8000/health`

## Estado funcional entregado

| Área | Entregado | Límites actuales |
| --- | --- | --- |
| Identidad | Registro, login, resolución de sesión y rutas privadas con Supabase. | Sin recuperación de contraseña, magic links como flujo de acceso, login social ni cuenta demo pública. |
| Onboarding | Wizard persistente de siete pasos, validación backend y disponibilidad semanal detallada. | La UI del MVP admite objetivos Trail y Ultra Trail; OCR y Backyard no tienen soporte UI/elegibilidad operativo. |
| Enfoque | Elegibilidad determinista y elección explícita entre Camino Kaio, Modo Z y Kaioken. | Los enfoques bloqueados no se pueden seleccionar y sus reglas siguen siendo políticas revisables del producto. |
| Generación | Borrador owner-bound, generación OpenAI síncrona, validación determinista, un segundo intento solo tras rechazo de validación y activación atómica. | Sin workers, colas, reintentos durables ni smoke test documentado con proveedor real. |
| Plan activo | Dashboard responsive, próxima sesión, métricas planificadas, calendario semanal y calendario completo de sesiones. | Las métricas describen lo **planificado**, no telemetría de entrenamientos completados. |
| Persistencia | `onboarding_snapshots`, `training_plans` y `training_sessions`, con ownership y RLS definidos por migraciones Supabase. | Sin `training_log`, historial de planes/reajustes ni módulos de insights persistentes. |

### Usuario y contraseña de prueba

**No existe una cuenta demo pública funcional ni credenciales públicas de prueba.** Para evaluar el flujo real hay que crear una cuenta en el proyecto Supabase configurado o preparar datos en un entorno controlado por el evaluador.

Cadenas presentes en fixtures automatizados, como `runner@example.com` o `trail-password`, son datos inertes de prueba y **no son credenciales válidas**. No se deben publicar, reutilizar ni interpretar como secretos.

## Flujo principal

1. El usuario se registra o inicia sesión mediante Supabase.
2. El enrutamiento protegido lo dirige según su estado entre onboarding, generación y plan activo.
3. El onboarding guarda un snapshot por usuario durante siete pasos.
4. El backend calcula la elegibilidad y el usuario selecciona un enfoque permitido.
5. La web guarda el borrador y abre `/plan/generating`.
6. La petición síncrona genera, valida y activa el plan; al terminar redirige a `/plan`.
7. El dashboard consume `GET /planning/active` y presenta exclusivamente semanas y sesiones planificadas.

## Stack tecnológico verificado

Versiones tomadas de `package.json`, `apps/web/package.json` y `apps/api/pyproject.toml`:

| Capa | Tecnología |
| --- | --- |
| Monorepo JS/TS | pnpm `11.0.0`, Node.js `>=24.18 <25` |
| Frontend | Next.js `16.2.10`, React/React DOM `19.2.0`, TypeScript `5.9.3` |
| Auth web | `@supabase/ssr` `^0.12.0`, `@supabase/supabase-js` `^2.110.0` |
| E2E web | Playwright `1.55.1` |
| Backend | Python `>=3.12`, FastAPI `0.115.6`, Uvicorn `0.34.0` |
| Datos | SQLAlchemy `>=2.0,<2.1`, psycopg `>=3.2.10,<3.3`, PostgreSQL gestionado por Supabase |
| IA | OpenAI SDK `2.46.0`, Responses API y Structured Outputs |
| Observabilidad | Sentry para Next.js y `sentry-sdk` `2.64.0` para la API |
| Calidad API | pytest `8.3.5`, Ruff `0.8.4` |

No se documentan versiones de Docker o PostgreSQL porque el repositorio no fija una versión verificable para esas herramientas.

## Comandos verificados en los manifiestos

### Web

Desde la raíz:

| Objetivo | Comando |
| --- | --- |
| Desarrollo | `pnpm dev:web` |
| Lint | `pnpm lint:web` |
| Build | `pnpm build:web` |
| Auth rápido | `pnpm test:web-auth` |
| Onboarding/planificación rápida | `pnpm test:web-onboarding` |
| E2E Playwright | `pnpm test:web-e2e` |
| Instalar Chromium | `pnpm --filter web exec playwright install chromium` |

Los tests rápidos de auth y onboarding usan adaptadores/dobles locales. El adaptador de autenticación E2E está limitado al entorno de pruebas; no crea una cuenta Supabase utilizable ni constituye un modo demo de la aplicación.

### API: tests rápidos

Desde `apps/api`:

```bash
uv run ruff check .
uv run python -c "from app.main import app"
uv run pytest --ignore=tests/integration
```

Estos tests usan dobles deterministas para OpenAI y no acreditan una llamada real al proveedor.

### API: tests de integración

Los tests de `tests/integration/` requieren Supabase local en ejecución, Supabase CLI accesible mediante `npx`, Docker para el entorno local y permisos para crear/configurar el rol efímero `kaito_api_login`:

```bash
# Desde la raíz, preparar Supabase local según la CLI del proyecto.
# Después, desde apps/api:
uv run pytest tests/integration
```

No deben ejecutarse contra una base de datos compartida o de producción.

## Docker Compose: limitación actual

`compose.yaml` solo construye y publica `web` y `api`. **No define PostgreSQL/Supabase ni inyecta la configuración runtime requerida**, por lo que `docker compose up --build` por sí solo no constituye un entorno local completo. Es una conveniencia de desarrollo, no una configuración de despliegue, CD o producción.

## Arquitectura resumida

- **Monorepo modular:** separa `apps/web` y `apps/api` y mantiene los contratos de producto dentro de cada capacidad.
- **Frontend por features:** `app/` orquesta rutas de Next.js; `features/auth`, `features/onboarding`, `features/planning` y `features/product-routing` contienen comportamiento de producto.
- **Backend modular:** `auth`, `runner_profile` y `planning` concentran dominio y casos de uso; `core/` contiene adaptadores de infraestructura como base de datos, Supabase JWT y OpenAI.
- **Seguridad de datos:** la API deriva el propietario del JWT y las migraciones Supabase son la autoridad física de esquema y RLS.
- **Generación controlada:** OpenAI propone un bloque estructurado; Kaito conserva la autoridad sobre elegibilidad, contexto, proyección, validación y persistencia.

## Estructura real del proyecto

```text
apps/
  web/
    app/                    Rutas Next.js de auth, onboarding, generación y plan.
    features/               Auth, onboarding, planning y product-routing.
    e2e/                    Pruebas Playwright.
  api/
    app/core/               Configuración y adaptadores de infraestructura.
    app/modules/            auth, runner_profile, planning y shared.
    tests/                  Tests rápidos e integración local Supabase.
packages/
  api-client/               Paquete reservado; todavía sin cliente generado funcional.
supabase/
  migrations/               Autoridad del esquema físico y RLS.
docs/                       Documentación de producto, políticas y arquitectura.
openspec/                   Especificaciones y artefactos de cambios.
docker/                     Dockerfiles de desarrollo local.
compose.yaml                Servicios web/api incompletos sin base de datos/configuración.
```

## Documentación relacionada

El mapa de fuentes está en [`docs/README.md`](docs/README.md). Referencias principales:

- [`docs/02-user-journeys.md`](docs/02-user-journeys.md): recorridos entregados y recorridos objetivo.
- [`docs/04-functional-requirements.md`](docs/04-functional-requirements.md): requisitos y matriz de estado.
- [`docs/05-data-model.md`](docs/05-data-model.md): modelo conceptual y persistencia física actual.
- [`docs/06-ai-behavior.md`](docs/06-ai-behavior.md): límites del proveedor y comportamiento de IA.
- [`docs/07-training-knowledge.md`](docs/07-training-knowledge.md): políticas deportivas y guardrails.
- [`docs/08-architecture.md`](docs/08-architecture.md): fronteras técnicas y estructura real.
- [`apps/web/README.md`](apps/web/README.md) y [`apps/api/README.md`](apps/api/README.md): guías específicas de cada aplicación.

## Regla de actualización

Este README es la fuente canónica del estado operativo entregado. Cualquier cambio que altere capacidades, estructura, comandos, variables de entorno, arquitectura o validación debe actualizarlo en el mismo cambio; los documentos de dominio deben evitar duplicar ese estado salvo cuando sea necesario para explicar su política.