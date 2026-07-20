# Kaito API

API FastAPI del MVP de Kaito. Expone autenticación, onboarding, elegibilidad, borrador, generación y lectura del plan activo. El dashboard web consume actualmente `GET /planning/active`; la generación web consume `POST /planning/generate`.

La guía operativa canónica está en el [`README.md` de la raíz](../../README.md).

## Desarrollo local

### Requisitos

- Python `>=3.12` y [uv](https://docs.astral.sh/uv/).
- Base de datos Supabase/PostgreSQL con las migraciones de `supabase/migrations/` aplicadas.
- Credenciales runtime de mínimo privilegio para el rol esperado `kaito_api_login`.
- Configuración Supabase JWKS para rutas autenticadas.
- Clave OpenAI para generación real.

### Instalación y arranque

Usa [`.env.example`](.env.example) solo como inventario. El proceso no carga `.env` automáticamente salvo que se indique `--env-file`.

```bash
cd apps/api
uv sync
uv run uvicorn app.main:app --reload --env-file .env
```


La API quedará disponible en `http://localhost:8000` cuando pueda conectar con la
base de datos usando el rol esperado. FastAPI publica el contrato OpenAPI en `/docs`,
`/redoc` y `/openapi.json`. Usa siempre credenciales de runtime con mínimo privilegio
y no las guardes en el repositorio. Para producción, sigue la
[guía de Railway y Supabase Cloud](../../docs/deployment-railway.md), incluida la
provisión segura del rol y la comprobación de `session_user`; no copies referencias,
hosts, contraseñas ni URLs con credenciales en este documento.


```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

## Configuración principal

| Grupo | Variables | Nota |
| --- | --- | --- |
| Base de datos | `DATABASE_URL`, `DATABASE_EXPECTED_ROLE` | Requeridas para el runtime; el rol esperado es `kaito_api_login`. |
| CORS | `KAITO_WEB_ORIGIN` | Debe declarar el origen web autorizado. |
| Auth | `SUPABASE_JWKS_URL`, `SUPABASE_JWT_AUDIENCE`, `SUPABASE_JWT_ISSUER`, `SUPABASE_JWKS_CACHE_TTL_SECONDS` | JWKS activa las rutas protegidas. `SUPABASE_URL` es informativa y no sustituye la URL JWKS. |
| IA | `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_TIMEOUT_SECONDS` | Configuración exclusiva del backend. |
| Observabilidad | `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, tasas de muestreo | Opcional; sin DSN Sentry queda desactivado. |

No publiques URLs con credenciales, service-role keys, tokens, secretos JWT ni claves OpenAI.

## API entregada

| Ruta | Comportamiento |
| --- | --- |
| `GET /health` | Salud del proceso. |
| `GET /auth/me` | Identidad derivada de un JWT válido. |
| Rutas `/onboarding` | Lectura/escritura owner-bound del snapshot persistente. |
| `GET /planning/training-approach-eligibility` | Evaluación determinista de enfoques. |
| `PUT /planning/training-plan-draft` | Crea o actualiza el único borrador del propietario. |
| `POST /planning/generate` | Genera con OpenAI, valida, repite una vez solo por rechazo de validación y activa atómicamente. |
| `GET /planning/active` | Devuelve el plan activo propio, ordenado y sin IDs internos; lo consume el dashboard web. |

La API usa respuestas públicas acotadas y no filtra detalles del proveedor. La ejecución de generación es síncrona: no existen workers, colas ni reintentos durables.

## Autenticación

El dominio depende de `UserContext` y `AuthVerifier`; Supabase es un adaptador de infraestructura en `app/core/auth/`. La verificación usa claves JWKS asimétricas y rechaza tokens sin firma o algoritmos simétricos no admitidos.

Sin `SUPABASE_JWKS_URL`, el proceso y `/health` pueden seguir disponibles, pero las rutas protegidas devuelven `503` por autenticación no configurada.

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/auth/me
```

No existe usuario demo público. Los emails, contraseñas y tokens construidos dentro de tests son fixtures inertes, no credenciales.

## Generación y persistencia

El backend construye `ProviderGenerationContext` con datos owner-bound y conserva autoridad sobre enfoque, elegibilidad, calendario, proyección y guardrails. El adaptador OpenAI usa Responses API y Structured Outputs para devolver un bloque tipado. Solo un rechazo de validación permite un segundo intento; fallos de transporte, timeout o parseo finalizan con un error neutral.

La persistencia física entregada se centra en:

- `onboarding_snapshots`;
- `training_plans`;
- `training_sessions`.

Las migraciones Supabase son la autoridad de esquema y RLS. No existen módulos/tablas entregados de `training_log`, `insights`, historial de ajustes o Alembic.

## Tests rápidos

Desde `apps/api`:

```bash
uv run ruff check .
uv run python -c "from app.main import app"
uv run pytest --ignore=tests/integration
```

Cubren dominio, adaptadores, contratos HTTP y generación con dobles deterministas. No requieren Supabase local ni llaman a OpenAI.

## Tests de integración

```bash
uv run pytest tests/integration
```

Estos tests requieren:

- Supabase local ya iniciado para este repositorio;
- Supabase CLI resoluble mediante `npx`;
- Docker disponible para el entorno Supabase local;
- permisos locales para crear y restablecer el rol `kaito_api_login`;
- una base descartable, nunca compartida ni de producción.

Validan esquema, persistencia y aislamiento RLS con usuarios efímeros. La separación es intencional: `uv run pytest` sin exclusiones también intenta ejecutar esta integración y fallará si el entorno local no está preparado.

## Observabilidad

Sentry es opcional. `ENABLE_DEBUG_SENTRY=true` registra un endpoint que provoca intencionadamente un error para comprobar captura; no debe habilitarse en producción. La ausencia o invalidez de Sentry no debe convertirlo en dependencia de arranque.

## Límites operativos

No se ha documentado evidencia de una generación autenticada contra OpenAI real ni un procedimiento completo de producción. Compose no incluye base de datos ni configuración runtime. Faltan una receta de despliegue, gestión operativa de secretos, backups, SLO y procesamiento durable.