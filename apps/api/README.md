# Kaito API

API backend de Kaito construida con FastAPI (Python 3.12+).

## Desarrollo local

### Requisitos previos

- [uv](https://docs.astral.sh/uv/) — gestor de dependencias y entorno virtual.

### Instalar dependencias y arrancar

El arranque requiere `DATABASE_URL` y
`DATABASE_EXPECTED_ROLE=kaito_api_login`. Las rutas privadas necesitan además la
configuración de autenticación descrita abajo y `KAITO_WEB_ORIGIN` debe declarar
el origen web autorizado para llamadas desde el navegador.

```bash
cd apps/api
uv sync            # instala deps de runtime y dev
uv run uvicorn app.main:app --reload
```

La API quedará disponible en `http://localhost:8000` cuando pueda conectar con la
base de datos usando el rol esperado. FastAPI publica el contrato OpenAPI en `/docs`,
`/redoc` y `/openapi.json`. Usa siempre credenciales de runtime con mínimo privilegio
y no las guardes en el repositorio. La guía operativa del Session Pooler cloud y del
rol de runtime queda pendiente de documentación específica; no copies referencias,
hosts, contraseñas ni URLs con credenciales en este documento.

### Verificar el health check

```bash
curl http://localhost:8000/health
# → {"status": "ok"}
```

---

## Observabilidad (Sentry)

La integración con Sentry es **completamente opcional** y se activa únicamente
cuando se define la variable de entorno `SENTRY_DSN`.  
Si la variable no está configurada (por ejemplo, en desarrollo local o CI),
el backend arranca normalmente sin ningún intento de conexión a Sentry.

### Variables de entorno

| Variable                       | Tipo    | Valor por defecto | Descripción                                                                   |
| ------------------------------ | ------- | ----------------- | ----------------------------------------------------------------------------- |
| `SENTRY_DSN`                   | string  | (vacío)           | DSN del proyecto en Sentry. Vacío/no definido = Sentry desactivado.           |
| `SENTRY_ENVIRONMENT`           | string  | `development`     | Etiqueta de entorno visible en la UI de Sentry.                               |
| `SENTRY_TRACES_SAMPLE_RATE`    | float   | `0.0`             | Fracción de solicitudes trazadas (0.0 = desactivado).                         |
| `SENTRY_PROFILES_SAMPLE_RATE`  | float   | `0.0`             | Fracción de solicitudes trazadas que se perfilarán (0.0 = desactivado).       |
| `ENABLE_DEBUG_SENTRY`          | boolean | (ausente)         | Registra el endpoint `/debug-sentry` solo cuando vale `true`. Ver más abajo.  |

> **Nota sobre valores inválidos:** si `SENTRY_TRACES_SAMPLE_RATE` o
> `SENTRY_PROFILES_SAMPLE_RATE` contienen un valor que no puede convertirse a
> número, el backend registra una advertencia y usa `0.0` como valor de
> reserva; el inicio no falla.

> **Nota sobre DSN malformado:** si `SENTRY_DSN` contiene un valor no vacío
> pero inválido (p.ej. una URL incorrecta), el backend registra un error y
> continúa sin Sentry activado; el inicio no falla.

### Configuración rápida

1. Copia el archivo de ejemplo como referencia:

   ```bash
   cp .env.example .env
   ```

2. Edita `.env` y asigna tu DSN real a `SENTRY_DSN`.

3. Carga las variables antes de arrancar el servidor:

   ```bash
   # Opción A — exportar directamente en la shell
   export SENTRY_DSN=https://...@o0.ingest.sentry.io/...
   uv run uvicorn app.main:app --reload

   # Opción B — pasar el fichero a uvicorn (requiere uvicorn ≥ 0.19, incluido en este proyecto)
   uv run uvicorn app.main:app --reload --env-file .env
   ```

   > **Importante:** el servidor lee variables de entorno del proceso; el
   > fichero `.env` **no se carga automáticamente** a menos que uses
   > `--env-file` o una librería como `python-dotenv`. Copia el ejemplo
   > únicamente como guía de las variables disponibles.

4. Reinicia el servidor para que tome las nuevas variables.

### Verificar la captura de errores (`/debug-sentry`)

El endpoint `GET /debug-sentry` es un **mecanismo de verificación** que
lanza intencionadamente una excepción no controlada (`ZeroDivisionError`).
Este endpoint **solo se registra** cuando `ENABLE_DEBUG_SENTRY=true` está
definido en el entorno al arrancar el servidor. Si la variable no está
definida o tiene cualquier otro valor, la ruta no existe y devuelve 404.

```bash
# Arrancar con el endpoint habilitado
ENABLE_DEBUG_SENTRY=true uv run uvicorn app.main:app --reload
# — o con --env-file si tienes ENABLE_DEBUG_SENTRY=true en tu .env

# Luego verificar
curl http://localhost:8000/debug-sentry
# → HTTP 500 (esperado; revisa el panel de Sentry para ver el evento capturado)
```

> Úsalo únicamente para confirmar que Sentry está recibiendo eventos
> correctamente. **No habilites este endpoint en producción.**

---

## Verificación en CI

Los comandos actuales de validación en CI son:

```bash
uv sync --frozen
uv run ruff check .
uv run python -c "from app.main import app"
uv run pytest
```

Todos deben ejecutarse sin `SENTRY_DSN` ni `ENABLE_DEBUG_SENTRY` definidos
para garantizar que el backend no requiere secretos de producción en el
entorno de integración continua.

---

## Proveedor de IA para bloques de entrenamiento

El adaptador de OpenAI usa Responses API con salida estructurada y el snapshot
fijo `gpt-5.5-2026-04-23`. La configuración se lee al construir el proveedor;
la importación de la aplicación y los flujos que no generan planes no requieren
una API key.

| Variable | Valor por defecto | Descripción |
| -------- | ----------------- | ----------- |
| `OPENAI_API_KEY` | ninguno | Requerida al construir el cliente. Se recortan espacios exteriores. |
| `OPENAI_MODEL` | `gpt-5.5-2026-04-23` | Solo se acepta este snapshot exacto; cualquier otro valor falla de forma cerrada. |
| `OPENAI_TIMEOUT_SECONDS` | `60` | Timeout positivo y finito en segundos. |

El cliente desactiva los reintentos automáticos del SDK (`max_retries=0`). El
adaptador usa Responses API y Structured Outputs con el prompt versionado
`training-block-v1`. Su contrato es deliberadamente estrecho:

| Frontera del adaptador OpenAI | Contrato |
| --- | --- |
| Entrada exclusiva | `ProviderGenerationContext`, construido por Kaito y vinculado al propietario. |
| Salida | `GeneratedTrainingBlock`, el contrato Pydantic existente de planificación. |
| Errores | Fallos neutrales que no filtran detalles del proveedor. |

La API expone dos rutas autenticadas:

| Ruta | Comportamiento |
| --- | --- |
| `POST /planning/generate` | Compone el adaptador configurado en el entorno y ejecuta contexto owner-bound → generación → validación determinista con un segundo intento solo tras rechazo de validación → persistencia/activación atómicas → respuesta pública del plan. |
| `GET /planning/active` | Devuelve únicamente el plan activo del propietario autenticado, con semanas y sesiones ordenadas de forma estable y sin IDs ni metadata interna. |

Las respuestas públicas usan las familias seguras `401`, `404`, `409`, `422` y `503`
para autenticación, fuentes ausentes, conflictos de estado, entradas o salidas inválidas
y falta de disponibilidad. No exponen errores internos ni payloads del proveedor.

La configuración de OpenAI permanece exclusivamente en variables de entorno del
backend; no debe trasladarse a la web ni documentarse con valores secretos. Las pruebas
usan dobles deterministas y no llaman a OpenAI. En esta rama todavía no se ha demostrado
un plan generado con el proveedor real: el smoke test autenticado permanece pendiente y
no se afirma preparación para producción. Aún quedan por conectar `/plan/generating`, el
dashboard y el E2E completo. La API síncrona no añadió workers, colas, migraciones ni
reintentos durables.

---

## Autenticación

La autenticación del backend se basa en un **límite de verificación independiente del proveedor**. El código de dominio depende únicamente de `UserContext` (id de usuario y email opcional) y de la abstracción `AuthVerifier`; los detalles de Supabase están aislados en el adaptador de infraestructura.

### Arquitectura del límite de autenticación

- **`app/modules/auth/`** — superficie de dominio (independiente del proveedor): `UserContext`, `AuthVerifier`, `get_current_user`, schemas y router. Ningún módulo de esta carpeta importa Supabase, PyJWT ni nombres de claims.
- **`app/core/auth/`** — adaptador de infraestructura: `SupabaseJwtVerifier` (único lugar que conoce el endpoint JWKS, los claims `sub`/`email`/`aud`, y la verificación asimétrica), fábrica `get_auth_verifier`, y `AuthConfigError`.
- **Supabase es el primer adaptador**, no el contrato. Sustituirlo o añadir otro proveedor solo requiere un nuevo adaptador en `app/core/auth/` y actualizarlo en `provider.py`; el límite, `UserContext`, la dependencia y los handlers de ruta no cambian.

### Verificación mediante JWT Signing Keys (JWKS)

La verificación usa las **claves de firma asimétricas** del proyecto Supabase. La URL del
endpoint JWKS se configura **explícitamente** mediante `SUPABASE_JWKS_URL` (disponible en el
onboarding de Supabase Server) y **no se deriva** de `SUPABASE_URL`.

- Las claves se obtienen y cachean en proceso mediante `PyJWKClient` (PyJWT); el verificador se reutiliza por proceso para que las peticiones repetidas con la misma configuración no consulten JWKS en cada request.
- `PyJWKClient` cachea claves por `kid` y puede refrescar ante rotación/miss; `SUPABASE_JWKS_CACHE_TTL_SECONDS` define el `lifespan` de esa caché. Valores inválidos, cero o negativos vuelven al valor seguro por defecto.
- La clave se selecciona por el campo `kid` del token; si no hay coincidencia, la solicitud se rechaza con `401`.
- Solo se aceptan algoritmos asimétricos (`ES256`, `RS256`, `EdDSA`). Los tokens `alg: none` y `HS*` son rechazados explícitamente para prevenir ataques de confusión de algoritmo.
- No se usa ningún secreto compartido. `SUPABASE_JWT_SECRET` ha sido eliminado.
- `SUPABASE_SECRET_KEY` (clave de API server-side de Supabase) **no se usa** para verificación JWT.

### Variables de entorno

| Variable | Tipo | Valor por defecto | Descripción |
| -------- | ---- | ----------------- | ----------- |
| `SUPABASE_JWKS_URL` | string | (vacío) | URL explícita del endpoint JWKS (del onboarding de Supabase). **Requerida** para activar la autenticación. Vacío = rutas protegidas devuelven 503. |
| `SUPABASE_URL` | string | (vacío) | URL base del proyecto Supabase. **Opcional/informativa.** No se usa para derivar la URL JWKS. |
| `SUPABASE_JWT_AUDIENCE` | string | `authenticated` | Audiencia esperada del token. Vacío = sin verificación de audiencia. |
| `SUPABASE_JWT_ISSUER` | string | (vacío) | Emisor esperado (típicamente `{SUPABASE_URL}/auth/v1`). Vacío = sin verificación de emisor. |
| `SUPABASE_JWKS_CACHE_TTL_SECONDS` | int | `600` | Tiempo de vida de la caché en proceso de claves JWKS (segundos). Debe ser `> 0`; valores inválidos/cero/negativos usan `600`. |

### Comportamiento sin SUPABASE_JWKS_URL configurado

Cuando `SUPABASE_JWKS_URL` está vacío o no definido (independientemente de si `SUPABASE_URL` está definido):

- Con la base de datos configurada, el backend **arranca normalmente** — no hay ningún error de autenticación durante el arranque.
- `GET /health` sigue respondiendo `200 {"status": "ok"}`.
- `GET /auth/me` y cualquier ruta protegida devuelven `503 {"detail": "Authentication is not configured"}`.
- No se filtra material secreto ni información del proveedor en las respuestas.

### Verificar `GET /auth/me`

```bash
# Con un token válido (obtenido desde el cliente Supabase)
curl -H "Authorization: Bearer <token>" http://localhost:8000/auth/me
# → 200 {"user_id": "...", "email": "..."}

# Sin token
curl http://localhost:8000/auth/me
# → 401 {"detail": "Not authenticated"}

# Sin SUPABASE_JWKS_URL configurado
curl http://localhost:8000/auth/me
# → 503 {"detail": "Authentication is not configured"}
```

### Patrón de ruta protegida

Las rutas de onboarding ya usan este límite. Para proteger cualquier otra ruta de
dominio, usa `Depends(get_current_user)` como **dependencia estándar requerida**:

```python
from fastapi import APIRouter, Depends
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.context import UserContext

router = APIRouter()

@router.get("/mi-ruta-protegida")
def mi_handler(user: UserContext = Depends(get_current_user)) -> dict:
    return {"user_id": user.user_id}
```

El handler recibe un `UserContext` verificado sin conocer los detalles del proveedor de autenticación.

### Propiedad de planes y sesiones

Las tablas canónicas `training_plans` y `training_sessions` aplican RLS además de los
filtros owner-bound del repositorio:

- `authenticated` puede leer sus propias filas de plan, con independencia del estado, y solo las sesiones que pertenecen a su plan activo;
- las filas de otros propietarios y las escrituras directas de `authenticated` están denegadas;
- `kaito_api_login` mantiene lecturas y escrituras acotadas al propietario derivado de los claims verificados instalados por el backend;
- `anon` y `PUBLIC` no tienen acceso.

Las migraciones de esquema y políticas son aditivas y se despliegan mediante el historial
de migraciones de Supabase. No se reescriben migraciones ya aplicadas ni se corrigen
entornos con ediciones SQL manuales; cualquier evolución requiere una migración nueva.
Las credenciales, identificadores de producción y valores de configuración sensibles no
se incluyen en la documentación.
