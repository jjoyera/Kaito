# Kaito

<p align="center">
  <img src="apps/web/public/assets/brand/Kaito_logo.png" alt="Kaito" width="160">
</p>

Kaito es una aplicación web para actuar como coach de IA para corredores de
ultradistancia. El repositorio ya contiene el scaffold runnable del monorepo,
validación de CI, límites iniciales de autenticación y documentación de producto
/ marca para guiar las siguientes pantallas.

## Estado actual

El proyecto todavía está en fase temprana: hay base técnica y una primera pantalla
funcional de acceso para usuarios finales.

| Área | Estado |
| --- | --- |
| Web | Next.js App Router con home scaffold y pantalla `/login`. |
| API | FastAPI con health check y verificación JWT Supabase vía JWKS. |
| Auth | Backend protegido con `GET /auth/me`; `/login` auth-aware y `/onboarding` privado con sesión Supabase. |
| Marca | Paleta y assets iniciales bajo `docs/` y `apps/web/public/`. |
| SDD | Cambios guiados por OpenSpec en `openspec/changes/`. |

## Stack tecnológico

| Área | Tecnología |
| --- | --- |
| Frontend | Next.js App Router con TypeScript |
| Backend | FastAPI con Python 3.12 |
| Paquetes JS/TS | pnpm 11 workspaces |
| Entorno Python | uv |
| Autenticación | Supabase Auth tokens verificados en backend por JWKS |
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

## Ejecución local

Ejecuta la web desde la raíz:

```bash
pnpm dev:web
```

La app web queda disponible en `http://localhost:3000`.

Ejecuta la API desde `apps/api`:

```bash
cd apps/api
uv run uvicorn app.main:app --reload
```

La API queda disponible en `http://localhost:8000`. Comprueba el endpoint de
salud con:

```bash
curl http://localhost:8000/health
# → {"status":"ok"}
```

También puedes levantar ambos servicios con Docker Compose para desarrollo local:

```bash
docker compose up --build
```

Compose solo define `web` y `api`; no es configuración de despliegue ni CD.

## Autenticación

El backend tiene un límite de autenticación independiente del proveedor. El código
de dominio consume `UserContext` y `AuthVerifier`; los detalles de Supabase quedan
aislados en el adaptador de infraestructura.

La web requiere `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
para el inicio de sesión y las rutas privadas. Son configuración pública de Supabase,
no secretos: no añadas `SUPABASE_SERVICE_ROLE_KEY`, tokens ni secretos JWT a la web.
En producción, despliega detrás de HTTPS: el proxy de sesión fuerza cookies `Secure`.

La verificación JWT usa las Signing Keys/JWKS de Supabase mediante una URL
explícita:

| Variable | Uso |
| --- | --- |
| `SUPABASE_JWKS_URL` | Requerida para activar rutas protegidas. |
| `SUPABASE_URL` | Opcional/informativa; no se usa para derivar JWKS. |
| `SUPABASE_JWT_AUDIENCE` | Audiencia esperada; por defecto `authenticated`. |
| `SUPABASE_JWT_ISSUER` | Emisor esperado; vacío desactiva esta verificación. |
| `SUPABASE_JWKS_CACHE_TTL_SECONDS` | TTL de caché JWKS; por defecto `600`. |

Si `SUPABASE_JWKS_URL` no está configurada, el backend arranca normalmente,
`GET /health` sigue funcionando y las rutas protegidas devuelven `503` con
`{"detail":"Authentication is not configured"}`.

Verifica el usuario autenticado con:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/auth/me
# → 200 {"user_id":"...","email":"..."}
```

Más detalle en `apps/api/README.md`.

## Validación

Instala una vez Chromium para los tests de navegador:

```bash
pnpm --filter web exec playwright install chromium
```

Comandos principales desde la raíz:

```bash
pnpm lint:web
pnpm build:web
pnpm test:web-e2e
pnpm test:web-auth
# Si el puerto 3000 está ocupado:
KAITO_PLAYWRIGHT_PORT=3001 pnpm test:web-e2e
```

Comandos principales de API desde `apps/api`:

```bash
uv run ruff check .
uv run python -c "from app.main import app"
uv run pytest
```

`pnpm test:web-auth` cubre los contratos frontend de login: validación local,
normalización de resultados de auth y handoff autenticado centralizado. No requiere
cuentas reales de Supabase.

## Arquitectura frontend

La web sigue Screaming Architecture: `app/` solo orquesta Next.js y cada capacidad real vive en `features/`. El código solo pasa a `shared/` cuando lo consumen dos features reales distintas. Consulta las reglas y el árbol vigente en [`docs/08-architecture.md`](docs/08-architecture.md) y la guía de contribución en [`apps/web/README.md`](apps/web/README.md).

## Estructura del proyecto

```text
apps/
  web/                  App Next.js, assets de marca y features frontend.
  api/                  API FastAPI con /health y auth protegida por JWKS.
packages/
  api-client/           Paquete reservado; todavía no exporta un cliente real.
docker/                 Dockerfiles locales para web y API.
.github/workflows/     Validación básica de CI.
docs/                  Documentación de producto, arquitectura y marca.
openspec/              Artefactos SDD/OpenSpec.
```

## Funcionalidades actuales

- Home web scaffold que confirma que el frontend arranca.
- Assets iniciales de marca en `apps/web/public/assets/brand/`.
- Paleta visual inicial en `docs/09-brand-palette.md`.
- API FastAPI con `GET /health`.
- Backend auth con `GET /auth/me`, verificación JWKS, cache de claves y errores
  seguros para configuración ausente.
- Pantalla `/login` auth-aware para usuarios existentes, con validación local,
  estados de carga y errores seguros; el handoff autenticado usa una URL local
  validada o `/onboarding`.
- Placeholder privado `/onboarding`, protegido por proxy y comprobación de servidor;
  no implementa ningún flujo ni persistencia de onboarding.
- Contratos frontend de login para validar email/password, mapear resultados de
  proveedor a estados propios de Kaito y centralizar el handoff autenticado.
- Validación básica: lint/build de web, tests unitarios auth, E2E Playwright de
  login (incluido un chequeo de producción) y lint/smoke/tests de API.
- Paquete `@kaito/api-client` reservado para un futuro cliente generado; hoy no
  exporta código ni contratos de producto.

Todavía no hay signup, password reset, magic links, social auth, demo access,
onboarding, dashboard, Strava, IA/RAG, planes de entrenamiento reales, base de
datos de dominio ni despliegue/CD.

## Flujo SDD/OpenSpec

Los cambios no triviales se planifican en `openspec/changes/<change-name>/` con
proposal, spec, design, tasks, apply, verify y sync. Si un cambio supera el
presupuesto de revisión, se divide en PRs encadenadas para mantener diffs chicos
y revisables.

## Regla de actualización

Cualquier cambio que modifique estructura, comandos, capacidades disponibles,
variables de entorno, arquitectura o flujo de verificación debe actualizar este
`README.md` en español dentro del mismo cambio.
