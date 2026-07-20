# Arquitectura técnica de Kaito (MVP)

## 1) Propósito

Este documento define la arquitectura técnica actual y objetivo del MVP de Kaito, con decisiones defendibles para revisión arquitectónica del TFM.

Se centra en **cómo se organiza el sistema** (fronteras, responsabilidades, flujos, seguridad, datos, IA y operación), distinguiendo el estado implementado de la arquitectura objetivo.

---

## 2) Resumen de decisiones arquitectónicas

| Decisión | Se adopta | Motivo |
| --- | --- | --- |
| Forma del repositorio | Monorepo modular | Mantener cohesión del producto y separar responsabilidades por aplicación/módulo sin sobrecoste de microservicios. |
| Aplicaciones | `apps/web` (Next.js) + `apps/api` (FastAPI) | Separar UX/web de casos de uso de negocio y motor de planificación IA. |
| Estilo backend | Monolito modular por dominios + Clean/Hexagonal pragmático por módulo | Aplicar puertos/adaptadores donde la complejidad lo justifique, evitando sobreingeniería homogénea. |
| Estilo frontend | Modular por features | Escalar UX y estado por capacidades de producto sin forzar Clean Architecture literal en UI. |
| Microservicios | No (MVP) | Reducir complejidad operativa y de despliegue en etapa inicial. |
| Base de datos | PostgreSQL gestionado por Supabase | Robustez relacional para planes/versionado y operación simplificada para TFM. |
| Auth | Supabase Auth | Registro/login/sesión resueltos con proveedor gestionado y JWT estándar. |
| Contrato de validación | Zod en frontend + Pydantic en backend | Validación temprana de UX y validación autoritativa en frontera API. |
| Persistencia de onboarding | API protegida + SQLAlchemy runtime + JSONB/RLS de Supabase | El propietario se deriva del JWT; Supabase CLI es la única autoridad de esquema y RLS. |
| Elegibilidad de enfoque | Política pura determinista en `planning` | Mantiene umbrales, precedencia de seguridad y códigos estables fuera del endpoint, la UI, persistencia y prompts. |
| Base de generación | Contratos y políticas puras en `planning` | Separa contexto, proyección, demanda, calendario, capacidad y validación del bloque respecto del proveedor IA. |
| Generación autenticada de planes | Puerto neutral + adaptador OpenAI + aplicación/repositorio + API owner-bound | Limita la entrada a `ProviderGenerationContext`, valida de forma determinista, persiste/activa atómicamente y expone respuestas públicas sin acoplar el dominio al SDK. |
| Error monitoring | Sentry | Detección temprana y diagnóstico en frontend/backend. |

---

## 3) Forma del sistema (diagrama de alto nivel en texto)

```text
Usuario
  │
  ▼
apps/web (Next.js)
  - UI/UX, onboarding, dashboard, calendario, logs
  - Validación de formularios con Zod
  - Gestión de sesión con Supabase Auth (SDK cliente)
  │
  │ HTTPS + JWT (Supabase)
  ▼
apps/api (FastAPI)
  - Validación JWT / identidad de usuario
  - Casos de uso de Kaito (onboarding, elegibilidad, generación, reajuste, KPIs)
  - Motor IA con contexto controlado y guardrails
  - Persistencia con SQLAlchemy
  │
  ├──────────────► Supabase Auth (verificación de identidad)
  │
  └──────────────► Supabase PostgreSQL (datos de dominio)

Observabilidad transversal:
- Sentry (web + api)
```

---

## 4) Layout del monorepo

La regla de organización es **Screaming Architecture**: la estructura comunica capacidades reales del producto. Primero se separa por aplicación (`web`/`api`) y, dentro de la web, por capacidad; no se crean carpetas para futuros hipotéticos.

### Estructura frontend actual

```text
apps/web/
├── app/                             # Solo rutas y orquestación Next.js
│   ├── page.tsx                     # Redirige `/` a `/login`
│   ├── (auth)/                      # Login y registro
│   └── (private)/onboarding/        # Ruta privada y composición
└── features/
    ├── auth/                        # Componentes, dominio, adaptadores e infraestructura
    └── onboarding/
        ├── _components/             # Intro, wizard y pasos
        ├── _domain/                 # Validación y reglas puras
        ├── _adapters/               # Contrato con el API
        └── _use-cases/              # Carga, guardado y finalización
```

Auth y onboarding son capacidades reales. En onboarding, los Pasos 1–6 usan el diseño visual del recorrido lineal de siete pasos. El Paso 4 mantiene el estado de interacción local y proyecta solo el mapa disperso de minutos exactos; el Paso 6 completa el onboarding con el estado físico requerido y un detalle opcional normalizado. No hay progreso clicable ni autosave.

### Forma ilustrativa cuando existan consumidores reales

```text
apps/web/
├── app/                             # routes, layouts, loading/error, metadata, route policy
├── features/
│   ├── auth/
│   │   ├── _components/
│   │   ├── _adapters/               # incluye authenticated fetch actual
│   │   ├── _use-cases/
│   │   ├── _domain/                 # solo reglas/tipos puros, si se justifica
│   │   └── _infrastructure/
│   │       └── supabase/            # construcción de clientes actual
│   └── onboarding/                  # segunda capacidad real actual
└── shared/                          # solo tras dos features reales consumidoras
```

No se crean árboles vacíos a partir de este ejemplo.

```text
/
├── apps/
│   ├── web/                         # Next.js (detalle anterior)
│   └── api/                         # FastAPI
│       ├── app/
│       │   ├── main.py
│       │   ├── core/                # Configuración, seguridad, logging, DB
│       │   ├── modules/
│       │   │   ├── auth/            # Identidad y autenticación
│       │   │   ├── runner_profile/  # Perfil deportivo del corredor
│       │   │   ├── planning/        # Elegibilidad, generación, sesiones y reajuste/versionado
│       │   │   ├── training_log/    # Registro real de entrenamientos
│       │   │   ├── insights/        # KPIs, cumplimiento y cálculos de progreso
│       │   └── shared/              # Código común muy controlado
│       ├── tests/
│       └── alembic/
├── packages/
│   └── api-client/                  # Cliente generado desde OpenAPI
├── docs/                            # Documentación del TFM
├── openspec/                        # Artefactos SDD / especificaciones de cambios
├── docker/                          # Infraestructura local
└── .github/                         # CI/CD y automatización
```

Principio: separar por **frontera de aplicación** primero (`web` vs `api`) y por **módulo funcional** dentro de cada app.

---

## 5) Arquitectura frontend (`apps/web`)

### Responsabilidad

`apps/web` resuelve experiencia de usuario: registro/login, onboarding, dashboard, detalle de sesión, carga de logs y visualización de KPIs.

### Decisión y reglas de ownership

- `apps/web/app/` contiene exclusivamente routing y orquestación de Next.js: rutas, layouts, `loading`/`error`, metadata y cableado de políticas de ruta. No contiene lógica de producto.
- `apps/web/features/<capability>/` posee cada capacidad real. Auth y onboarding usan `_components/`, `_adapters/`, `_use-cases/` y, cuando hay reglas/tipos puros, `_domain/`.
- `<feature>.container.tsx` es opcional y solo existe para orquestación genuina de múltiples concerns; nunca se añade mecánicamente.
- `_infrastructure/` identifica plumbing de proveedores. En el alcance actual, los clientes Supabase pertenecen a `features/auth/_infrastructure/supabase/` y el fetch autenticado a `features/auth/_adapters/`.
- `apps/web/shared/` solo recibe código consumido por **al menos dos features reales distintas**; auth y onboarding ya comparten únicamente las fronteras justificadas.
- Se prohíben abstracciones compartidas especulativas, carpetas vacías de features futuras y cajones genéricos `utils`/`helpers`.
- `app/(auth)/login/page.tsx`, `app/(auth)/register/page.tsx` y `app/(private)/onboarding/page.tsx` permanecen como orquestación de ruta e importan sus features.
- `features/auth/_components/` contiene los formularios de acceso; `features/onboarding/` contiene componentes, dominio, adaptador API y casos de uso del flujo privado.

### Reglas funcionales

- El frontend **no decide reglas de negocio críticas** (elegibilidad final, reajustes, versionado, invariantes).
- El frontend consume contratos API versionados y muestra estados de carga/error claros.
- La sesión se apoya en Supabase Auth; el frontend transmite el JWT al backend para operaciones de dominio.

---

## 6) Arquitectura backend (`apps/api`): módulos y capas Clean/Hexagonal pragmáticas

### Responsabilidad

`apps/api` es dueño de los casos de uso de Kaito y de las reglas de dominio del MVP.

### Modularidad por dominios (conceptual)

- `auth`: validación de identidad y contexto de usuario.
- `runner_profile`: onboarding y estado inicial del corredor.
- `planning`: casos de uso de elegibilidad, generación inicial, sesiones y reajuste/versionado.
- `training_log`: registro de cumplimiento y métricas simples.
- `insights`: cálculo de KPIs, cumplimiento y progreso para dashboard.

La frontera IA implementada reparte el puerto neutral en `modules/planning` y el
adaptador OpenAI y su prompt versionado en `core/ai`; no introduce un módulo de
dominio hipotético.

### Capas (aplicar donde haya complejidad)

En módulos con lógica crítica se recomienda:

- **Domain**: entidades/reglas/invariantes (p. ej., un solo plan activo, reglas de versionado).
- **Application**: casos de uso (generate plan, apply adjustment, calculate KPIs).
- **Ports**: interfaces para repositorios, proveedores IA, trazas, reloj, etc.
- **Adapters**: FastAPI controllers, SQLAlchemy repositories y clientes de proveedores externos.

En módulos simples/CRUD, se permite simplificación sin imponer todas las capas, manteniendo invariantes y testabilidad.

---

## 7) Arquitectura de datos y persistencia

### Base de datos

- PostgreSQL gestionado por Supabase.
- Modelo de datos alineado con `docs/05-data-model.md`.

### Acceso y evolución de esquema

- SQLAlchemy como capa ORM/repositorio en backend.
- Supabase CLI y su historial de migraciones son la autoridad de esquema y RLS. Las migraciones son aditivas: no se reescriben las ya aplicadas ni se corrigen entornos mediante SQL manual.
- Los snapshots de onboarding permanecen como JSONB por propietario: `profile.availability.minutes_by_day` guarda únicamente minutos exactos dispersos; `profile.prior_history` conserva sus tres enums canónicos; `profile.baseline_4_weeks` añade minutos totales de carrera, duración de la salida más larga y D+ de esa salida como enteros estrictos no negativos; y `profile.physical_status` guarda el estado, presencia de dolor/limitación, impacto condicional al correr y detalle opcional normalizado. La salida más larga no puede superar los totales de minutos ni D+ del periodo. La API protegida valida al guardar y al leer. Kaito está en pre-lanzamiento y sin usuarios de producción, por lo que no existe migración SQL ni versionado de datos para este cambio limpio; la prueba local verifica CRUD propio y denegación entre dos usuarios.

### Invariantes de persistencia (MVP)

- `training_plans` persiste propietario, enfoque, estado, fechas de bloque y foco; el rango cubre entre 1 y 4 semanas.
- `training_sessions` persiste semana, fecha, categoría/tipo, duración, distancia, desnivel, intensidad, RPE 1–10, instrucciones, propósito y orden único por plan/semana.
- Las fechas de sesión deben pertenecer al rango y semana del plan; duración es positiva, distancia/desnivel no negativos y el rango RPE está ordenado.
- Cada sesión referencia su plan mediante FK con `ON DELETE CASCADE`; existe un único plan activo por propietario.
- Inserción del candidato y sesiones, archivado del activo anterior y activación nueva forman una sola transacción: cualquier fallo revierte la sustitución completa.
- `authenticated` puede leer sus propias filas de plan, con independencia del estado, y solo las sesiones de su plan activo; las filas ajenas y las escrituras directas quedan denegadas. `kaito_api_login` mantiene lecturas y escrituras owner-bound bajo claims verificados; `anon` y `PUBLIC` quedan denegados.
- Reajuste y versionado de planes, así como trazabilidad de logs, permanecen fuera de esta fase.

---

## 8) Arquitectura de autenticación/sesión (Supabase + FastAPI)

### Estado actual

- `/` redirige a `/login`.
- `/login` inicia sesión mediante Supabase Auth y enlaza a `/register` con `Crear cuenta`.
- `/register` solicita email, contraseña y repetición, valida localmente formato, fortaleza y coincidencia, y ejecuta signup mediante Supabase Auth.
- `features/auth` posee la normalización de resultados, la máquina de estados del registro, el cooldown persistido por pestaña, la capa modal accesible no nativa y el bridge de confirmación hacia login; `app/(auth)/` se limita a routing y composición.
- Una sesión inmediata entrega el flujo a `/onboarding`. Un resultado sin sesión crea un nonce efímero y no sensible, redirige a `/login` y permite mostrar una sola vez orientación neutral. El proveedor puede ocultar duplicados con ese mismo resultado, por lo que la interfaz no afirma que el correo se haya enviado definitivamente.
- El resultado de confirmación requerida se ha comprobado contra Supabase real. La sesión inmediata real y la compatibilidad manual con gestores de contraseñas permanecen sin verificar.
- No existe todavía una capacidad de recuperación de contraseña.

### Flujo actual de autenticación

1. El usuario inicia sesión o solicita el registro desde `apps/web`.
2. Supabase Auth es propietario de la validación de credenciales, creación de cuenta y emisión de sesión; la web solo normaliza sus resultados a estados propios de Kaito.
3. Durante signup, la web evita envíos duplicados. Si Supabase limita la frecuencia, aplica el plazo fiable del proveedor o un fallback de 60 segundos y bloquea todos los reintentos hasta que venza.
4. Una sesión inmediata continúa a `/onboarding`. Sin sesión, un nonce de 30 segundos vincula el handoff a `/login`; el aviso se consume una vez, elimina el parámetro de la URL y no contiene email, credenciales ni payload del proveedor.
5. `apps/web` envía el JWT al backend en cada request de negocio.
6. `apps/api` valida firma/claims del JWT y construye contexto de identidad.
7. Solo tras validar identidad se ejecutan casos de uso de Kaito.

### Principios de seguridad de identidad

- `apps/api` nunca confía en `userId` enviado por el cliente sin JWT válido.
- Aislamiento de datos por usuario en cada consulta/comando.
- Frontend gestiona UX de sesión; backend conserva autoridad sobre acceso a recursos de dominio.

---

## 9) Arquitectura de IA: generación, validación, conocimiento y trazabilidad

### Estado implementado: generación autenticada y persistencia atómica

La generación está dividida en fronteras explícitas dentro de `apps/api`:

| Frontera | Estado y responsabilidad |
| --- | --- |
| Contexto determinista | Construye `ProviderGenerationContext` vinculado al propietario, en `Europe/Madrid`, desde el lunes estrictamente siguiente; calcula el horizonte completo antes de recortar 1–4 semanas y trunca en la fecha objetivo. |
| Políticas de `planning` | Calculan proyección, demanda, calendario, capacidad, trayectoria y guardrails deportivos sin delegar autoridad al proveedor. |
| Puerto neutral | Acepta exclusivamente `ProviderGenerationContext` y devuelve `GeneratedTrainingBlock`. |
| Prompt | `training-block-v1`, versionado y separado del adaptador. |
| Adaptador OpenAI | Responses API con Structured Outputs, modelo fijado `gpt-5.5-2026-04-23` y dependencia exacta `openai==2.46.0`. |
| Operación del proveedor | Timeout por defecto de 60 segundos, reintentos del SDK desactivados y errores neutrales sin filtraciones del proveedor. |
| Orquestación | Ensambla el contexto una vez, valida de forma determinista y permite como máximo un segundo intento solo tras fallo de validación. |
| Persistencia y lectura | Sustitución atómica del plan activo y lectura owner-bound ordenada por semana y sesión. |
| API de planes de entrenamiento | `POST /planning/generate` compone el adaptador desde el entorno y devuelve el plan público; `GET /planning/active` devuelve el activo propio, ambos autenticados y sin IDs ni metadata interna. |
| Seguridad de datos | `authenticated` lee sus propias filas de plan y solo las sesiones del activo propio; filas ajenas y escritura directa denegadas, con CRUD backend owner-bound mediante RLS. |

La política semanal parte de 9 km cuando la base es cero; el bootstrap separado de
la salida más larga es 3 km/30 min. Los guardrails numéricos canónicos y su condición
de política de producto revisable se mantienen en
[`07-training-knowledge.md`](07-training-knowledge.md).

El flujo implementado continúa tras la respuesta tipada: aplica validación determinista,
repite como máximo una vez solo por ese tipo de rechazo y persiste/activa el resultado
en una transacción. La API lo expone mediante `POST /planning/generate` y ofrece la
lectura owner-bound ordenada en `GET /planning/active`. Los outcomes públicos se acotan a
`401`, `404`, `409`, `422` y `503`; FastAPI publica `/docs`, `/redoc` y `/openapi.json`.
El dashboard protegido `/plan` ya consume la lectura activa; la pantalla de generación y el E2E completo siguen pendientes.

### Contexto controlado y fuentes

La IA solo usa contexto trazable del dominio MVP y reglas de:

- `docs/06-ai-behavior.md`
- `docs/07-training-knowledge.md`
- entidades del modelo (`RunnerProfile`, `TrainingGoal`, `TrainingPlan`, `TrainingSession`, `TrainingLog`, etc.).

### Structured Outputs y guardrails

- El adaptador parsea Responses API directamente al schema Pydantic neutral `GeneratedTrainingBlock` para un bloque de 1–4 semanas.
- Las sesiones usan categorías tipadas, segmentos temporizados de intensidad para carrera y rango RPE 1–10.
- La suma de distancia de carrera debe igualar exactamente la proyección autorizada de cada semana; las fechas deben pertenecer a su ventana y no superar el objetivo.
- Cada sesión `run` debe respetar simultáneamente los máximos independientes de distancia y duración de su semana; esos máximos no se aplican a categorías no running.
- Elegibilidad, demanda, calendario, capacidad y trayectoria son valores calculados por backend y quedan fuera de la salida del proveedor.
- El rechazo posterior al proveedor, el segundo intento condicionado, la persistencia atómica y la exposición HTTP autenticada ya están implementados; la publicación en UI sigue pendiente.

---

## 10) Flujos principales de arquitectura

### 10.1 Registro / login

1. `/` dirige al usuario a `/login`, desde donde puede iniciar sesión o abrir `/register`.
2. El login ejecuta la autenticación con Supabase y recibe la sesión/JWT.
3. El registro valida localmente email, fortaleza de contraseña y coincidencia; después solicita el alta a Supabase mediante el adaptador de auth.
4. Con sesión inmediata, `web` continúa hacia onboarding. Sin sesión, entrega el flujo a login mediante el bridge efímero y muestra la orientación neutral de confirmación sin asegurar que se haya enviado correo.
5. Los resultados explícitos de duplicado, límite de frecuencia y fallo de sistema permanecen en registro; el límite activa el cooldown y no existe CTA de recuperación de contraseña.
6. Con una sesión válida, `web` consume `apps/api` con JWT.
7. `api` valida el JWT y resuelve el estado funcional inicial (onboarding, generar plan o dashboard).

### 10.2 Onboarding + elegibilidad de enfoque

1. `web` recoge onboarding y valida formato para una UX inmediata.
2. `api` vuelve a validar tipos, enums, requeridos y limpieza condicional antes de persistir; la validación web no es autoridad.
3. El recurso protegido `GET /planning/training-approach-eligibility` exige `assessment_date` igual a la fecha UTC confiable del servidor y carga el onboarding completado del propietario derivado del JWT.
4. El caso de uso orquesta la lectura y delega todos los umbrales y precedencias a `ApproachEligibilityPolicy`, una política pura del dominio `planning`.
5. La web muestra siempre los tres enfoques y sus bloqueos, pero ignora `recommended_approach` para selección y decoración.
6. `PUT /planning/training-plan-draft` vuelve a cargar el onboarding y reevalúa la elegibilidad con la fecha UTC confiable antes de crear, reutilizar o actualizar el único borrador del propietario.

```text
planning/
├── domain.py       # Política pura y resultados tipados
├── use_cases.py    # Elegibilidad y guardado seguro del borrador
├── repository.py   # Transacción SQL owner-bound e idempotencia
└── router.py       # Auth, outcomes HTTP y serialización
```

OCR y Backyard continúan admitidos por onboarding, pero la frontera de elegibilidad los rechaza explícitamente hasta que existan reglas propias.

### 10.3 Generación y lectura autenticadas

Capacidades entregadas:

1. `api` construye contexto owner-bound, proyecta la envolvente semanal y calcula la trayectoria sobre todo el horizonte antes de recortar las próximas 1–4 semanas.
2. El puerto entrega únicamente `ProviderGenerationContext` al adaptador OpenAI.
3. Responses API aplica `training-block-v1` y Structured Outputs para devolver `GeneratedTrainingBlock`.
4. El backend valida el bloque contra contexto y guardrails; permite un segundo intento solo si el primero falla esa validación.
5. El repositorio inserta candidato y sesiones, archiva el activo anterior y activa el nuevo plan en una transacción; después puede leer el activo propio con orden estable.
6. `POST /planning/generate` compone el adaptador OpenAI configurado en el entorno y ejecuta el flujo completo dentro de la petición síncrona; `GET /planning/active` devuelve semanas y sesiones ordenadas sin IDs ni metadata interna.
7. RLS limita lectura y escritura según propietario y rol, sin acceso para `anon`/`PUBLIC`.
8. La ruta web protegida `/plan` consume el plan activo mediante el transporte autenticado, valida el contrato de forma estricta y presenta bloque, métricas planificadas derivadas, próxima sesión y calendario semanal con estados seguros.

Pendiente:

1. Conectar `/plan/generating` y las pruebas E2E del recorrido completo en la web.
2. Un smoke test autenticado debe demostrar una generación real con OpenAI; las pruebas actuales usan dobles deterministas y no realizan llamadas al proveedor.

La configuración backend requiere `OPENAI_API_KEY`, fija
`OPENAI_MODEL=gpt-5.5-2026-04-23` y usa `OPENAI_TIMEOUT_SECONDS=60` por defecto; acepta
cualquier timeout positivo y finito. La API síncrona no añade workers, colas, migraciones
ni infraestructura durable de reintentos, y su estado actual no acredita preparación
para producción.

### 10.4 Registro de entrenamiento + KPIs

1. Usuario registra `TrainingLog` en `web`.
2. `api` valida y persiste log/histórico.
3. `api` recalcula KPIs del dashboard:
   - `completedKm = SUM(actualDistanceKm)`.
   - `sessionLoad = actualDurationMin × rpe`.
   - `weeklyLoad = SUM(sessionLoad)` por semana.
4. `web` refresca estado de progreso.

### 10.5 Reajuste y versionado de plan

1. `api` detecta desvío relevante según política.
2. Si aplica, genera propuesta de ajuste con IA bajo guardrails.
3. Ejecuta pipeline de versionado copy-on-write:
   - archiva plan actual,
   - crea nueva versión,
   - vincula `previousPlanId`,
   - registra `PlanAdjustment`.
4. Garantiza invariante: solo un plan activo por usuario.

---

## 11) Estrategia de testing

### Backend (`apps/api`)

- `pytest` para unit e integración.
- Pruebas de dominio/casos de uso: elegibilidad, generación segura, reajuste/versionado, invariantes de plan activo único.
- Pruebas de contrato API y validaciones Pydantic.

### Frontend (`apps/web`)

- Pruebas de UI/flujo y validaciones de formularios (Zod + capa de presentación), incluidas las reglas locales del registro.
- E2E con Playwright sobre login y registro: validación, overlay accesible, resultados Supabase normalizados, handoff a onboarding/login, bridge de confirmación de un solo uso, privacidad y cooldown.

### IA

- Tests de pipeline y validadores (esquema estructurado + guardrails).
- Casos de regresión de prompts/outputs para evitar deriva funcional.

---

## 12) Observabilidad y monitorización

- **Sentry**: errores, excepciones y degradación funcional en frontend y backend.
- Métricas técnicas mínimas del MVP: disponibilidad API, tiempos de respuesta y ratio de error.

---

## 13) CI/CD y controles de seguridad (OWASP)

### Pipeline (GitHub Actions)

En cada cambio relevante:

1. Lint/format/check estático.
2. Tests automatizados (backend, frontend, E2E críticos según rama/entorno).
3. Checks de seguridad (dependencias, secrets, configuración).
4. Validaciones de cabeceras de seguridad equivalentes a Helmet en capa web/API (CSP, HSTS, X-Content-Type-Options, etc. según despliegue).

### Controles esperados

- Enfoque OWASP en CI/CD (SAST/dependency checks, hardening base, validación de configuración).
- Principio de mínimo privilegio para secretos y credenciales.
- Auditoría de accesos y errores sensibles.

---

## 14) Entorno local y despliegue (conceptual con Docker)

- Docker como estrategia de estandarización de entorno para `web`, `api` y servicios necesarios.
- Objetivo: paridad razonable local/CI/entornos de despliegue.
- Los `Dockerfile` locales y `compose.yaml` ya definen los servicios `web` y `api`; no constituyen configuración de despliegue ni CD.
- La entrega hasta el Paso 6 coordina API y web sobre un estado limpio: las cinco respuestas retiradas no se traducen ni se conservan, `profile.restrictions` sigue eliminándose y no se reutiliza para el estado físico. No hay migración ni almacenamiento de duración base.

---

## 15) Evolución fuera del MVP del TFM

RAG, integración Strava y métricas avanzadas quedan fuera del alcance actual. No
forman parte de la arquitectura implementada ni de la generación autenticada de planes.

---

## 16) No-objetivos explícitos de la fase actual

- No conectar todavía `/plan/generating` ni el E2E completo de generación y redirección.
- No introducir workers, colas, ejecución durable ni reintentos persistentes.
- No añadir edición/versionado manual de planes, recálculo por `TrainingLog` ni reajuste automático.
- No ampliar las validaciones deterministas hasta presentarlas como garantías deportivas avanzadas.
- No presentar los topes deterministas de trayectoria como garantía individual de seguridad o prevención de lesiones.
- No crear microservicios.
- No ampliar estructura ni código fuera de capacidades reales del MVP.
- No definir integración completa con Strava en MVP.
- No introducir RAG operativo en MVP.
- No introducir workers en MVP.
- No ampliar alcance a diagnóstico médico ni lógica clínica avanzada.

---

## 17) Referencias

- [`00-product-vision.md`](./00-product-vision.md)
- [`04-functional-requirements.md`](./04-functional-requirements.md)
- [`05-data-model.md`](./05-data-model.md)
- [`06-ai-behavior.md`](./06-ai-behavior.md)
- [`07-training-knowledge.md`](./07-training-knowledge.md)
