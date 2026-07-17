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
- **Campos clave**: `id`, `userId`, `experienceLevel`, `baseline4Weeks`, `weeklyAvailability`, `preferences`, `constraints`, `onboardingCompletedAt`.
- **Relaciones**: pertenece a un único `User`.
- **Notas**: `baseline4Weeks` conserva los totales de sesiones, distancia, desnivel positivo y salida más larga de las cuatro semanas anteriores, además de la constancia reciente (`irregular|fairly_consistent|very_consistent`). La disponibilidad canónica es solo `profile.availability.minutes_by_day`: un objeto JSONB disperso de días a minutos enteros exactos (15–300), con mínimo de tres días y 150 minutos semanales. No guarda duración base ni categoría; los campos retirados no tienen compatibilidad ni migración. El snapshot pertenece al usuario autenticado y RLS impide el acceso entre usuarios.

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
- **Campos clave**: `id`, `userId`, `status` (`draft|active|archived`), `startDate`, `endDate`, `version`, `previousPlanId?`, `planApproach` (`kaio_path|z_mode|kaioken`), `generatedAt`, `activatedAt`.
- **Relaciones**:
  - pertenece a `User`.
  - 1:N con `TrainingSession`.
  - 1:N con `PlanAdjustment`.
  - 1:1 lógico con `TrainingGoal` principal (MVP).
- **Notas**: solo un plan `active` por usuario. Cuando Kaito reajusta, crea una nueva versión de `TrainingPlan` basada en el plan anterior. El plan previo queda archivado como histórico para poder comparar qué cambió. El campo `planApproach` guarda el enfoque elegido para la generación del plan: Camino Kaio (conservador), Modo Z (equilibrado) o Kaioken (exigente).

### `TrainingSession`

- **Propósito**: definir cada entrenamiento planificado visible en dashboard/calendario.
- **Campos clave**: `id`, `planId`, `scheduledDate`, `sessionType`, `plannedDurationMin`, `plannedDistanceKm?`, `plannedElevationM?`, `purpose`, `isKeySession`.
- **Relaciones**: pertenece a `TrainingPlan`.
- **Notas**: representa lo planificado; la ejecución real vive en `TrainingLog`.

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
- **Campos clave**: `id`, `userId`, `evaluatedAt`, `recommendedApproach` (`kaio_path|z_mode|kaioken`), `availableApproaches`, `blockedApproaches`, `blockingReasons`, `inputSummary`.
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

## 6) Reglas de datos / invariantes

1. **Un solo plan activo por usuario**.
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

## 7) Simplificaciones explícitas del MVP

- Sin gestión avanzada multi-temporada.
- Sin múltiples objetivos principales simultáneos.
- Sin sincronización con plataformas externas.
- Sin modelo de diagnóstico médico.
- Sin roles avanzados (admin/coach/athlete multi-tenant).

## 8) Decisiones tomadas

1. **Versionado de reajustes**: cada reajuste crea una nueva versión de `TrainingPlan` basada en el plan anterior. El plan previo queda disponible como histórico y comparación.
2. **Granularidad del dolor/sensaciones**: el MVP usará enums simples para reducir fricción y facilitar reglas de reajuste.
3. **Registro por sesión**: cada sesión tiene un único `TrainingLog` actual, pero editable. Las modificaciones se guardan en `TrainingLogHistory`.
4. **Bloqueo de enfoques de plan**: las opciones no elegibles se muestran bloqueadas con explicación y se registran en `PlanApproachEligibility`. El usuario puede desbloquear enfoques superiores si progresa, cumple el plan y demuestra preparación suficiente.

## 9) Referencias

- [`00-product-vision.md`](00-product-vision.md)
- [`02-user-journeys.md`](02-user-journeys.md)
- [`03-plan-adjustment-policy.md`](03-plan-adjustment-policy.md)
- [`04-functional-requirements.md`](04-functional-requirements.md)
