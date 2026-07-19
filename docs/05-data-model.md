# Modelo de datos MVP

## 1) Propósito

Este documento define el **modelo de datos conceptual/lógico** del MVP de Kaito.

Su objetivo es alinear producto, journeys y requisitos funcionales sobre **qué información existe, cómo se relaciona y qué reglas debe respetar**, sin fijar todavía detalles de implementación (ORM, SQL concreto, índices, particiones o estructura física final).

## 2) Alcance

### Incluye

- Datos de identidad (vinculada a Auth) y propiedad del usuario.
- Perfil del corredor y contexto de onboarding.
- Objetivo principal de entrenamiento.
- Plan activo y sus sesiones planificadas.
- Registro de ejecución real de cada sesión (cumplimiento + métricas simples).
- Eventos de reajuste básico del plan.

## 3) Entidades núcleo

| Entidad | Propósito | Cardinalidad clave |
| --- | --- | --- |
| `User` | Registro interno de usuario/perfil dueño de los datos (vinculado a Auth) | 1 usuario → 1 perfil, N planes |
| `RunnerProfile` | Contexto base del corredor (onboarding) | 1:1 con `User` |
| `TrainingGoal` | Objetivo deportivo principal para un plan | 1 plan activo → 1 objetivo principal |
| `TrainingPlan` | Planificación generada/reajustada | N planes por usuario, solo 1 activo |
| `TrainingSession` | Unidad planificada de entrenamiento | 1 plan → N sesiones |
| `TrainingLog` | Ejecución real reportada de una sesión | 1 sesión → 0..1 log editable |
| `TrainingLogHistory` | Histórico de cambios de un registro manual | 1 log → N cambios |
| `PlanApproachEligibility` | Evaluación de enfoques disponibles/bloqueados | 1 usuario → N evaluaciones |
| `PlanAdjustment` | Registro de reajuste aplicado al plan | 1 plan → N reajustes |


## 4) Detalle de entidades

### `User`

- **Propósito**: registro interno de propiedad de datos del usuario en Kaito, vinculado a la identidad autenticada.
- **Campos clave**: `id`, `supabaseUserId` (o `authProviderUserId`, único), `email`, `createdAt`, `updatedAt`.
- **Relaciones**:
  - 1:1 con `RunnerProfile`.
  - 1:N con `TrainingPlan`.
  - 1:N con `TrainingLog` (ownership explícito para auditoría simple).
- **Notas**: las credenciales (password/sesión) las gestiona Supabase Auth, no las tablas de dominio de Kaito. El estado inicial (onboarding pendiente / generar plan / dashboard) se deriva de perfil + plan activo.

### `RunnerProfile`

- **Propósito**: persistir la base del onboarding del corredor.
- **Campos clave**: `id`, `userId`, `experienceLevel`, `baseline4Weeks`, `weeklyAvailability`, `preferences`, `physicalStatus`, `constraints`, `onboardingCompletedAt`.
- **Relaciones**: pertenece a un único `User`.
- **Notas**: `baseline4Weeks` conserva los totales de sesiones, distancia, desnivel positivo y minutos de carrera de las cuatro semanas anteriores; también la distancia, duración y D+ de la salida más larga, además de la constancia reciente (`irregular|fairly_consistent|very_consistent`). `total_running_minutes`, `longest_outing_duration_minutes` y `longest_outing_positive_elevation_m` son enteros estrictos no negativos; la salida más larga no puede superar el total de minutos ni de D+ del periodo. La disponibilidad canónica es solo `profile.availability.minutes_by_day`: un objeto JSONB disperso de días a minutos enteros exactos (15–300), con mínimo de tres días y 150 minutos semanales. `profile.physical_status` guarda un `status` obligatorio (`feeling_good|carrying_fatigue|recovering`) y puede guardar `pain_or_limitation_detail` normalizado hasta 500 caracteres; el detalle vacío se omite. No guarda duración base ni categoría; los campos retirados, incluido `profile.restrictions`, no tienen compatibilidad ni migración. Kaito está en pre-lanzamiento y sin usuarios de producción, por lo que esta ampliación coordinada del contrato no requiere migración ni versionado de datos de producción. El snapshot pertenece al usuario autenticado y RLS impide el acceso entre usuarios.

### `TrainingGoal`

- **Propósito**: representar el objetivo deportivo principal sobre el que se construye el plan.
- **Campos clave**: `id`, `userId`, `planId`, `goalType` (`distance_date|backyard`), `raceType`, `targetDistanceKm?`, `targetDate`, `targetLoops?`, `targetHours?`, `targetLoopDurationMin?`, `expectedRestMarginMin?`, `boxStrategyNotes?`, `priority` (MVP: `main`).
- **Relaciones**: pertenece a `User` y `TrainingPlan`.
- **Notas**: en MVP se permite solo **un objetivo principal por plan activo** y se validan campos según modalidad.

#### Mapeo modalidad → campos de `TrainingGoal` (MVP)

| Modalidad (`raceType`) | `goalType` | Campos objetivo mínimos |
| --- | --- | --- |
| Trail / Ultra-trail / OCR | `distance_date` | `targetDistanceKm`, `targetDate` |
| Backyard Ultra | `backyard` | `targetDate`, `targetLoops` o `targetHours`, `targetLoopDurationMin`, `expectedRestMarginMin` |

`boxStrategyNotes` queda opcional para capturar la estrategia de transición/box cuando el usuario quiera detallarla.

### `TrainingPlan`

- **Propósito**: encapsular una versión de planificación (inicial o reajustada) del usuario.
- **Campos canónicos persistentes**: `id`, `owner_id`, `status` (`draft|active|archived`), `plan_approach` (`kaio_path|mode_z|kaioken`), `start_date`, `end_date`, `block_focus`, `created_at` y `updated_at`. Los borradores mantienen `start_date`, `end_date` y `block_focus` nulos; los planes activos o archivados exigen fechas y foco no vacío.
- **Relaciones**:
  - pertenece a `User`.
  - 1:N con `TrainingSession`.
  - 1:N con `PlanAdjustment`.
  - 1:1 lógico con `TrainingGoal` principal (MVP).
- **Notas**: la base de datos impide más de un plan `draft` y más de un plan `active` por propietario. Un plan generado cubre entre 1 y 4 semanas: `end_date >= start_date` y `end_date < start_date + 28 días`. Mientras siga en `draft`, guardar otra opción actualiza el mismo registro de forma idempotente; un plan activo impide mutar ese borrador. La sustitución implementada inserta un candidato, todas sus sesiones, archiva el activo anterior y activa el candidato en una única transacción. Si cualquier paso falla, se revierte todo y el plan anterior conserva su estado.

### `TrainingSession`

- **Propósito**: definir cada entrenamiento planificado visible en dashboard/calendario.
- **Campos canónicos persistentes**: `id`, `plan_id`, `week_number`, `scheduled_date`, `session_type`, `session_category`, `planned_duration_minutes`, `planned_distance_kilometers`, `planned_elevation_meters`, `intensity_description`, `target_rpe_min`, `target_rpe_max`, `instructions`, `purpose`, `session_order` y `created_at`.
- **Relaciones**: pertenece a `TrainingPlan`.
- **Notas**: representa lo planificado; la ejecución real vive en `TrainingLog`. `week_number` está entre 1 y 4, la fecha debe caer dentro del rango del plan y corresponder a su semana, duración es positiva, distancia y desnivel son no negativos, y `1 <= target_rpe_min <= target_rpe_max <= 10`. `session_order` es positivo y único por plan/semana. La FK `plan_id` aplica `ON DELETE CASCADE`, por lo que no quedan sesiones huérfanas. El contrato neutral conserva además los segmentos de intensidad de carrera; estos son obligatorios y suman exactamente la duración antes de persistir.

### `TrainingLog`

- **Propósito**: capturar cómo salió realmente una sesión.
- **Campos clave**: `id`, `userId`, `sessionId`, `status` (`completed|failed|misperformed`), `actualDistanceKm?`, `actualDurationMin?`, `rpe?` (`1..10`), `actualElevationM?`, `feeling` (`very_good|good|normal|bad|very_bad`), `painLevel` (`none|mild|moderate|high`), `notes`, `loggedAt`, `updatedAt`.
- **Relaciones**: pertenece a `User` y `TrainingSession`.
- **Notas**: base para KPIs y detección de desviaciones relevantes. En MVP existe un único log actual por sesión, pero puede editarse si el usuario corrige datos introducidos manualmente. Para carga interna del MVP, `sessionLoad = actualDurationMin × rpe` (sRPE) y la `weeklyLoad` se calcula como suma de `sessionLoad` de la semana. El campo `feeling` se mantiene como señal cualitativa complementaria. Métricas avanzadas (p. ej., ritmo medio o FC media) quedan fuera del MVP y podrán añadirse de forma incremental.

### `TrainingLogHistory`

- **Propósito**: conservar el histórico de cambios de un `TrainingLog` editable.
- **Campos clave**: `id`, `trainingLogId`, `changedAt`, `previousStatus?`, `newStatus?`, `previousValues`, `newValues`, `changeReason?`.
- **Relaciones**: pertenece a un único `TrainingLog`.
- **Notas**: permite entender si un reajuste se basó en datos que luego fueron corregidos y evita perder trazabilidad cuando el usuario edita un registro manual.

### `PlanApproachEligibility`

- **Propósito**: registrar qué enfoques de plan puede elegir el usuario en un momento concreto y por qué algunos pueden estar bloqueados.
- **Campos clave**: `id`, `userId`, `evaluatedAt`, `recommendedApproach` (`kaio_path|mode_z`), `availableApproaches`, `blockedApproaches`, `blockingReasons`, `inputSummary`.
- **Relaciones**: pertenece a `User`; puede referenciar el `RunnerProfile`, `TrainingGoal`, `TrainingPlan` o métricas recientes usadas para la evaluación.
- **Notas**: las opciones bloqueadas deben poder mostrarse al usuario con explicación. El bloqueo no es permanente: puede cambiar si el usuario mejora su base, cumple el plan y demuestra preparación suficiente.

### `PlanAdjustment`

- **Propósito**: registrar cuándo y por qué se reajustó un plan.
- **Campos clave**: `id`, `previousPlanId`, `newPlanId`, `triggerType`, `triggerSummary`, `policyRuleMatched`, `appliedChangeSummary`, `createdAt`.
- **Relaciones**: conecta el plan anterior con la nueva versión reajustada; opcionalmente referencia logs/sesiones detonantes (`sourceLogIds` o equivalente lógico).
- **Notas**: no busca trazabilidad clínica; sí explicabilidad funcional del reajuste MVP. El usuario puede consultar qué cambió respecto al plan anterior, aunque en MVP no se plantea mantener dos planes activos a la vez.

## 5) Resumen de relaciones

- `User` 1 — 1 `RunnerProfile`
- `User` 1 — N `TrainingPlan`
- `TrainingPlan` 1 — 1 `TrainingGoal` (principal, MVP)
- `TrainingPlan` 1 — N `TrainingSession`
- `TrainingSession` 1 — 0..1 `TrainingLog` (registro actual editable)
- `User` 1 — N `TrainingLog`
- `TrainingLog` 1 — N `TrainingLogHistory`
- `User` 1 — N `PlanApproachEligibility`
- `TrainingPlan` 1 — N `PlanAdjustment` como plan origen o plan generado

## 6) Contratos calculados de la base de generación

Estos resultados tipados alimentan el flujo implementado de generación y persistencia. Las tablas canónicas almacenan el plan y las sesiones validadas, no los cálculos intermedios de readiness:

| Resultado | Contenido y autoridad |
| --- | --- |
| `GeneratedTrainingBlock` | Bloque neutral de 1–4 semanas; contiene enfoque aplicado, sesiones tipadas, intensidad y RPE. No contiene readiness calculado por el proveedor. |
| `GoalDemand` | `km_effort`, minutos semanales mínimos de pico, semanas de pico requeridas y base de decisión (`product_floor`, `expert_anchor` o `product_interpolation`). |
| `ReadinessCalendar` | Semanas ordenadas `build|peak|recovery|taper`, huecos de carga disponibles y déficit temporal de semanas pico. |
| `ReadinessCapacityAssessment` | Estado inicial `on_track|constrained|not_feasible`, brecha en minutos y códigos de motivo estables. No demuestra que una progresión concreta sea segura. |

## 7) Reglas de datos / invariantes

1. **Un solo plan activo y un solo borrador por usuario**.
2. **Un objetivo principal por plan activo**.
3. **Cada sesión pertenece a un único plan**.
4. **Cada log pertenece a un usuario y a una sesión existente de su plan activo o histórico**.
5. **Un log de entrenamiento puede editarse**, pero cada cambio relevante debe quedar registrado en `TrainingLogHistory`.
6. **La disponibilidad de enfoques de plan debe evaluarse y registrarse**, incluyendo recomendación, opciones bloqueadas y motivos.
7. **Un reajuste crea una nueva versión de plan** y conserva el plan anterior como histórico.
8. **Un reajuste solo existe si hay desviación relevante según política** (`03-plan-adjustment-policy.md`).
9. **El usuario autenticado es dueño de su perfil, planes, sesiones y logs** (aislamiento por `userId`).
10. **El estado funcional post-login se deriva de datos**:
   - Sin onboarding completo → onboarding.
   - Onboarding completo y sin plan activo → generar plan.
   - Con plan activo → dashboard.
11. **`TrainingGoal` debe ser coherente con la modalidad**: toda modalidad exige `targetDate` (fecha del evento). Para Backyard, el objetivo principal no se modela con distancia fija, sino con vueltas/horas (`targetLoops`/`targetHours`) y parámetros de bucle/descanso.
12. **La envolvente semanal generada es exacta**: la suma de `plannedDistanceKm` de las sesiones `run` debe coincidir exactamente con los kilómetros proyectados para esa semana.
13. **Las fechas generadas están acotadas**: cada sesión pertenece a la ventana de siete días de su semana y ninguna sesión puede superar la fecha objetivo.
14. **Readiness pertenece al backend**: el contrato generado no puede declarar elegibilidad, demanda, capacidad ni seguridad de progresión.
15. **La sustitución del activo es atómica**: candidato, sesiones, archivado anterior y activación nueva se confirman o revierten juntos.
16. **La lectura mantiene ownership y orden estable**: el repositorio filtra por `owner_id` y devuelve sesiones por `week_number`, `session_order`.
17. **RLS separa canales**: `authenticated` puede leer sus propias filas de plan, con independencia del estado, y solo las sesiones de su plan activo; las filas ajenas y las escrituras directas quedan denegadas. `kaito_api_login` mantiene lecturas y escrituras owner-bound bajo claims verificados; `anon` y `PUBLIC` quedan denegados.
18. **La evolución de esquema es aditiva**: se aplica mediante el historial de migraciones de Supabase sin reescribir migraciones ya aplicadas ni editar SQL manualmente en un entorno.

## 8) Simplificaciones explícitas del MVP

- Sin gestión avanzada multi-temporada.
- Sin múltiples objetivos principales simultáneos.
- Sin sincronización con plataformas externas.
- Sin modelo de diagnóstico médico.
- Sin roles avanzados (admin/coach/athlete multi-tenant).

## 9) Decisiones tomadas

1. **Versionado de reajustes**: cada reajuste crea una nueva versión de `TrainingPlan` basada en el plan anterior. El plan previo queda disponible como histórico y comparación.
2. **Granularidad del dolor/sensaciones**: el MVP usará enums simples para reducir fricción y facilitar reglas de reajuste.
3. **Registro por sesión**: cada sesión tiene un único `TrainingLog` actual, pero editable. Las modificaciones se guardan en `TrainingLogHistory`.
4. **Bloqueo de enfoques de plan**: las opciones no elegibles se muestran bloqueadas con explicación y se registran en `PlanApproachEligibility`. El usuario puede desbloquear enfoques superiores si progresa, cumple el plan y demuestra preparación suficiente.

## 10) Referencias

- [`00-product-vision.md`](00-product-vision.md)
- [`02-user-journeys.md`](02-user-journeys.md)
- [`03-plan-adjustment-policy.md`](03-plan-adjustment-policy.md)
- [`04-functional-requirements.md`](04-functional-requirements.md)
