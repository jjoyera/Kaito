# Kaito

<p align="center">
  <img src="apps/web/public/assets/brand/Kaito_logo.png" alt="Kaito" width="160">
</p>

Kaito es una aplicación web para actuar como coach de IA para corredores de
ultradistancia. El producto ya permite crear una cuenta, iniciar sesión y comenzar
un onboarding privado conectado al API; el resto de la experiencia se incorpora de
forma incremental.

## Estado actual

El estado implementado entrega autenticación y los cuatro primeros pasos del nuevo onboarding.

| Área | Estado |
| --- | --- |
| Web | Next.js App Router con signup/login/sesión y onboarding privado en `/onboarding`. |
| API | FastAPI con health check, verificación JWT Supabase vía JWKS y persistencia de onboarding. |
| Auth | Signup/login con Supabase, handoff de confirmación a login, backend protegido con `GET /auth/me` y `/onboarding` privado. |
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

Esto también instala el hook versionado de pre-commit, que comprueba si el
contenido preparado contiene rutas no portables. Solo para diagnóstico local
excepcional, puede omitirse con `HUSKY=0 git commit`; CI mantiene la misma
comprobación como protección autoritativa.

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

Para arrancar la API necesitas una base de datos accesible y configurar
`DATABASE_URL` y `DATABASE_EXPECTED_ROLE=kaito_api_login`, además de la
configuración de autenticación y CORS aplicable. Consulta valores y comportamiento
en [`apps/api/README.md`](apps/api/README.md); nunca guardes credenciales reales en
el repositorio.

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

El onboarding autenticado (`/onboarding`) llama al API directamente desde el
navegador, así que además necesitás `NEXT_PUBLIC_KAITO_API_URL` en la web
(`http://localhost:8000` en local) y `KAITO_WEB_ORIGIN` en el API
(`http://localhost:3000` en local). `KAITO_WEB_ORIGIN` está vacía por defecto
(fail-closed): sin configurarla, el API no habilita CORS y el navegador no
puede llamarlo entre orígenes distintos.

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
pnpm test:web-onboarding
# Si el puerto 3000 está ocupado:
KAITO_PLAYWRIGHT_PORT=3001 pnpm test:web-e2e
```

Comandos principales de API desde `apps/api`:

```bash
uv run ruff check .
uv run python -c "from app.main import app"
uv run pytest
```

`pnpm test:web-auth` cubre los contratos frontend de login y registro: validación local,
normalización de resultados de auth, cooldown, bridge de confirmación y handoff
autenticado. No requiere cuentas reales de Supabase.

`pnpm test:web-onboarding` cubre el wizard de onboarding: pasos y validación
por paso, limpieza condicional de campos, mapeo de diagnósticos del backend a
pasos, y los casos de uso de carga/guardado/completado. Tampoco requiere
cuentas reales de Supabase ni el API corriendo.

La verificación final superó `pnpm test:web-onboarding`, lint, build y E2E web; Ruff y 199 pruebas API no integradas; y la prueba local de RLS con dos usuarios (24 pruebas).

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

- Acceso, registro y resolución de sesión con Supabase, con entrega autenticada
  hacia una ruta privada.
- Assets iniciales de marca en `apps/web/public/assets/brand/`.
- Paleta visual inicial en `docs/09-brand-palette.md`.
- API FastAPI con `GET /health`.
- Backend auth con `GET /auth/me`, verificación JWKS, cache de claves y errores
  seguros para configuración ausente.
- Pantalla `/login` auth-aware para usuarios existentes, con validación local,
  estados de carga y errores seguros; el handoff autenticado usa una URL local
  validada o `/onboarding`.
- Registro Supabase en `/register` con validación local, procesamiento accesible,
  cooldown ante límites de frecuencia y resultados propios de Kaito. Una sesión
  inmediata continúa a onboarding; un resultado sin sesión continúa a login con
  orientación neutral de confirmación y sin exponer el email.
- `/onboarding` privado presenta primero la propuesta de valor y el CTA
  `Crear mi plan`. Su Paso 1 rediseñado muestra `Paso 1 de 7` y `14%`, permite
  elegir solo Trail o Ultra y solicita distancia, desnivel positivo y fecha
  objetivo; no muestra tecnicidad, altitud máxima ni botón de retroceso.
- Los Pasos 1–4 usan el diseño visual lineal de siete pasos. El Paso 4 recoge disponibilidad con días compactos, atajos 45/60/120 y ajustes exactos de 15–300 minutos; requiere tres días y 150 minutos semanales. `Varía por día` es solo estado de UI.
- Continuar guarda el mapa disperso `profile.availability.minutes_by_day` antes de avanzar; Atrás conserva el estado local, y los fallos permiten reintentar sin perder respuestas. No hay autosave ni duración base persistida.
- Persistencia de onboarding por usuario mediante API protegida, JSONB con ownership y RLS de Supabase; no se añadió migración, compatibilidad para los cinco campos retirados ni almacenamiento de duración base. Consulta los detalles en los documentos de `docs/` y `apps/web/README.md`.
- La validación incluye lint, build, unitarios y E2E web, Ruff y pruebas API, además de prueba RLS local de dos usuarios.
- Paquete `@kaito/api-client` reservado para un futuro cliente generado; hoy no
  exporta código ni contratos de producto.

Todavía no hay password reset, magic links, social auth, demo access, selección de
enfoque de plan, dashboard, Strava, IA/RAG, planes de entrenamiento reales ni
despliegue/CD.

## Flujo SDD/OpenSpec

Los cambios no triviales se planifican en `openspec/changes/<change-name>/` con
proposal, spec, design, tasks, apply, verify y sync. Si un cambio supera el
presupuesto de revisión, se divide en PRs encadenadas para mantener diffs chicos
y revisables.

## Regla de actualización

Cualquier cambio que modifique estructura, comandos, capacidades disponibles,
variables de entorno, arquitectura o flujo de verificación debe actualizar este
`README.md` en español dentro del mismo cambio.
