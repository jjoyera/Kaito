# Kaito API

API backend de Kaito construida con FastAPI (Python 3.12+).

## Desarrollo local

### Requisitos previos

- [uv](https://docs.astral.sh/uv/) — gestor de dependencias y entorno virtual.

### Instalar dependencias y arrancar

```bash
cd apps/api
uv sync            # instala deps de runtime y dev
uv run uvicorn app.main:app --reload
```

La API quedará disponible en `http://localhost:8000`.

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
