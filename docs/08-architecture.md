# Arquitectura técnica de Kaito (MVP)

## 1) Propósito

Este documento define la arquitectura técnica objetivo del MVP de Kaito para implementación futura, con decisiones defendibles para revisión arquitectónica del TFM.

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
| Núcleo IA | FastAPI (`apps/api`) | El backend controla contexto, reglas, validaciones y ownership de casos de uso de Kaito. |
| Observabilidad IA | Langfuse | Trazabilidad de prompts, respuestas, costes y calidad de ejecución IA. |
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
- Langfuse (pipeline IA)
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
│       │   │   └── ai_coach/        # Adaptadores IA, prompts, generación estructurada y validación
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
- `ai_coach`: adaptadores IA, prompts, generación estructurada y soporte de validación.

### Capas (aplicar donde haya complejidad)

En módulos con lógica crítica se recomienda:

- **Domain**: entidades/reglas/invariantes (p. ej., un solo plan activo, reglas de versionado).
- **Application**: casos de uso (generate plan, apply adjustment, calculate KPIs).
- **Ports**: interfaces para repositorios, proveedores IA, trazas, reloj, etc.
- **Adapters**: FastAPI controllers, SQLAlchemy repositories, cliente Langfuse, cliente Supabase.

En módulos simples/CRUD, se permite simplificación sin imponer todas las capas, manteniendo invariantes y testabilidad.

---

## 7) Arquitectura de datos y persistencia

### Base de datos

- PostgreSQL gestionado por Supabase.
- Modelo de datos alineado con `docs/05-data-model.md`.

### Acceso y evolución de esquema

- SQLAlchemy como capa ORM/repositorio en backend.
- Para onboarding, Supabase CLI es la autoridad de esquema, migraciones y RLS; esta entrega no añade migración ni Alembic.
- Los snapshots de onboarding permanecen como JSONB por propietario: `profile.availability.minutes_by_day` guarda únicamente minutos exactos dispersos y `profile.physical_status` guarda el enum requerido más un detalle opcional normalizado de hasta 500 caracteres. La API protegida valida al guardar y al leer; no existe migración SQL y la prueba local verifica CRUD propio y denegación entre dos usuarios.

### Invariantes de persistencia (MVP)

- Un único `TrainingPlan` activo por usuario.
- Reajuste mediante versionado (`previousPlanId`, `version`, archivo del plan anterior).
- Trazabilidad de ajuste (`PlanAdjustment`) y de edición de logs (`TrainingLogHistory`).

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

### Ubicación del núcleo IA

El motor de planificación IA reside en `apps/api` para controlar:

- contexto permitido,
- reglas de negocio,
- validación estructural,
- guardrails de seguridad,
- persistencia transaccional del resultado.

### Contexto controlado y fuentes

La IA solo usa contexto trazable del dominio MVP y reglas de:

- `docs/06-ai-behavior.md`
- `docs/07-training-knowledge.md`
- entidades del modelo (`RunnerProfile`, `TrainingGoal`, `TrainingPlan`, `TrainingSession`, `TrainingLog`, etc.).

### Structured outputs y guardrails

- Respuesta IA en formato estructurado (schema definido por backend).
- Validación de estructura y coherencia (Pydantic) antes de persistir.
- Validadores programáticos adicionales (p. ej., no catch-up agresivo, consistencia modal, límites de seguridad).
- Si falla validación, la salida se rechaza/regenera; no se publica al usuario.

### Observabilidad IA

- Langfuse para trazas de prompts, respuestas, latencia, coste y calidad operativa.

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

1. `web` recoge onboarding y valida formato con Zod.
2. `api` revalida contrato e invariantes con Pydantic.
3. Caso de uso de `planning` (subflujo `plan-eligibility`) calcula `PlanApproachEligibility`.
4. `api` devuelve opciones elegibles/bloqueadas + motivo.

### 10.3 Generación de plan

1. `api` toma contexto validado (`RunnerProfile`, `TrainingGoal`, elegibilidad, enfoque elegido).
2. Construye prompt/control de contexto según `06` + `07`.
3. Ejecuta llamada IA con salida estructurada.
4. Ejecuta validadores de seguridad y coherencia modal.
5. Persiste `TrainingPlan` + `TrainingSession` como plan activo.

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
- **Langfuse**: observabilidad específica de IA (prompts, outputs, latencia, coste, calidad).
- Métricas técnicas mínimas: disponibilidad API, tiempos de respuesta, ratio de error, ratio de validación fallida IA.

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

## 15) Evolución futura (fuera de implementación MVP inmediata)

Ejes previstos de crecimiento, sin adoptar ahora en runtime MVP:

1. **RAG** para ampliar conocimiento especializado con fuentes curadas.
2. **Integración Strava** para ingestión automática de actividad.
3. **Workers/colas** para tareas asíncronas (ajustes pesados, re-procesados, jobs periódicos).
4. **Métricas avanzadas** (más allá de sRPE y KPIs básicos MVP).

Estas extensiones deben respetar las invariantes actuales y no romper la trazabilidad del plan/versionado.

---

## 16) No-objetivos explícitos de la fase actual

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
- [`openspec/changes/architecture-foundation/proposal.md`](../openspec/changes/architecture-foundation/proposal.md)
- [`openspec/changes/architecture-foundation/exploration.md`](../openspec/changes/architecture-foundation/exploration.md)
