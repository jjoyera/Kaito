# Kaito

<p align="center">
  <img src="apps/web/public/assets/brand/Kaito_logo.png" alt="Kaito" width="160">
</p>

Kaito es una aplicación web para actuar como coach de IA para corredores de
ultradistancia. El producto ya permite crear una cuenta, iniciar sesión y comenzar
un onboarding privado conectado al API; el resto de la experiencia se incorpora de
forma incremental.

## Estado actual

El estado implementado entrega autenticación, onboarding completo, selección explícita de enfoque y, en backend, generación validada con persistencia/activación atómica y lectura owner-bound del plan activo. Esta capacidad existe en las capas de aplicación y repositorio, pero todavía no está expuesta por HTTP ni conectada a la web.

| Área | Estado |
| --- | --- |
| Web | Next.js App Router con signup/login/sesión, onboarding privado, elección accesible de enfoque y destino estático `/plan/generating`. |
| API | FastAPI con verificación JWT, onboarding, elegibilidad determinista y flujo interno de generación, validación, persistencia/activación y lectura owner-bound. Los endpoints de generación y plan activo siguen pendientes. |
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

`pnpm test:web-onboarding` cubre el wizard, sus validaciones, la carga y guardado,
y el contrato puro de elección de enfoque y borrador. No requiere cuentas reales
de Supabase ni el API corriendo.

La verificación de esta capacidad cubre `pnpm test:web-onboarding`, lint, build y el E2E enfocado de onboarding; Ruff y 241 pruebas API no integradas. La migración incluye RLS owner-bound y se valida con Supabase local cuando ese entorno está disponible.

## Arquitectura frontend

La web sigue Screaming Architecture: `app/` solo orquesta Next.js y cada capacidad real vive en `features/`. El código solo pasa a `shared/` cuando lo consumen dos features reales distintas. Consulta las reglas y el árbol vigente en [`docs/08-architecture.md`](docs/08-architecture.md) y la guía de contribución en [`apps/web/README.md`](apps/web/README.md).

## Estructura del proyecto

```text
apps/
  web/                  App Next.js, assets de marca y features frontend.
  api/                  API FastAPI con auth, planificación determinista y adaptador IA M1.
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
- Los Pasos 1–6 usan el diseño visual lineal de siete pasos. El Paso 4 recoge disponibilidad con días compactos, atajos 45/60/120 y ajustes exactos de 15–300 minutos; requiere tres días y 150 minutos semanales. `Varía por día` es solo estado de UI.
- Continuar guarda el mapa disperso `profile.availability.minutes_by_day` antes de avanzar; Atrás conserva el estado local, y los fallos permiten reintentar sin perder respuestas. No hay autosave ni duración base persistida.
- El Paso 5 recoge las tres preferencias obligatorias y el Paso 6 exige estado físico y presencia de dolor o limitación. Si existe, pregunta de forma accesible si afecta al correr y admite un detalle opcional de hasta 500 caracteres; al responder que no existe dolor, impacto y detalle se eliminan de forma determinista.
- Persistencia de onboarding por usuario mediante API protegida, JSONB con ownership y RLS de Supabase; el backend valida los enums del historial previo y el estado físico estructurado sin confiar en la web.
- Elegibilidad protegida en `GET /planning/training-approach-eligibility`: una política pura devuelve Camino Kaio, Modo Z y Kaioken con disponibilidad, códigos estables de bloqueo, recomendación y restricciones de seguridad para Trail y Ultra Trail. OCR y Backyard permanecen disponibles en onboarding, pero todavía no son modalidades elegibles.
- El Paso 7 presenta los enfoques elegibles, conserva la selección al reintentar fallos de conexión y guarda un único borrador owner-bound antes de navegar a `/plan/generating`; los bloqueos o datos desactualizados vuelven a comprobar la elegibilidad y los estados incompletos regresan al onboarding.
- La planificación determinista construye contexto vinculado al propietario en `Europe/Madrid`, empieza estrictamente el lunes siguiente, calcula el horizonte completo antes de recortar las primeras 1–4 semanas y trunca las fechas en el objetivo.
- La política deportiva valida distribución de intensidad, fuerza y separación determinista de sesiones demandantes; los valores canónicos están en [`docs/07-training-knowledge.md`](docs/07-training-knowledge.md).
- El flujo interno de generación ya cubre contexto owner-bound, salida estructurada de OpenAI, validación con una única repetición condicionada y sustitución atómica del plan activo; T3.4 todavía debe exponerlo por HTTP.
- Planes y sesiones aplican restricciones canónicas y RLS owner-scoped. La configuración IA permanece en el backend y el esquema evoluciona mediante migraciones aditivas de Supabase; consulta los documentos canónicos enlazados abajo.
- La validación incluye lint, build, unitarios y E2E web, Ruff y pruebas API, además de prueba RLS local de dos usuarios.
- Paquete `@kaito/api-client` reservado para un futuro cliente generado; hoy no
  exporta código ni contratos de producto.

Todavía no hay password reset, magic links, social auth, demo access, dashboard,
Strava/RAG ni generación de planes de extremo a extremo accesible al usuario. El flujo
interno ya cubre orquestación, una repetición solo por fallo de validación,
persistencia/activación y lectura owner-bound; quedan pendientes `POST
/planning/generate`, `GET /planning/active` y la UI/E2E. Tras el Paso 7, la selección
crea o actualiza el borrador y `/plan/generating` muestra por ahora un destino estático.
Los detalles canónicos están en [`docs/05-data-model.md`](docs/05-data-model.md),
[`docs/06-ai-behavior.md`](docs/06-ai-behavior.md) y
[`docs/08-architecture.md`](docs/08-architecture.md).

## Flujo SDD/OpenSpec

Los cambios no triviales se planifican en `openspec/changes/<change-name>/` con
proposal, spec, design, tasks, apply, verify y sync. Si un cambio supera el
presupuesto de revisión, se divide en PRs encadenadas para mantener diffs chicos
y revisables.

## Regla de actualización

Cualquier cambio que modifique estructura, comandos, capacidades disponibles,
variables de entorno, arquitectura o flujo de verificación debe actualizar este
`README.md` en español dentro del mismo cambio.
