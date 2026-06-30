# Modelo de datos MVP

## 1) Propósito

Este documento define el **modelo de datos conceptual/lógico** del MVP de Kaito.

Su objetivo es alinear producto, journeys y requisitos funcionales sobre **qué información existe, cómo se relaciona y qué reglas debe respetar**, sin fijar todavía detalles de implementación (ORM, SQL concreto, índices, particiones o estructura física final).

## 2) Alcance

### Incluye

- Datos de autenticación y propiedad del usuario.
- Perfil del corredor y contexto de onboarding.
- Objetivo principal de entrenamiento.
- Plan activo y sus sesiones planificadas.
- Registro de ejecución real de cada sesión (cumplimiento + métricas simples).
- Eventos de reajuste básico del plan.

## 3) Entidades núcleo

| Entidad | Propósito | Cardinalidad clave |
| --- | --- | --- |
| `User` | Identidad/autenticación y dueño de los datos | 1 usuario → 1 perfil, N planes |
| `RunnerProfile` | Contexto base del corredor (onboarding) | 1:1 con `User` |
| `TrainingGoal` | Objetivo deportivo principal para un plan | 1 plan activo → 1 objetivo principal |
| `TrainingPlan` | Planificación generada/reajustada | N planes por usuario, solo 1 activo |
| `TrainingSession` | Unidad planificada de entrenamiento | 1 plan → N sesiones |
| `TrainingLog` | Ejecución real reportada de una sesión | 1 sesión → 0..1 log editable |
| `TrainingLogHistory` | Histórico de cambios de un registro manual | 1 log → N cambios |
| `PlanAdjustment` | Registro de reajuste aplicado al plan | 1 plan → N reajustes |


## 4) Detalle de entidades

### `User`

- **Propósito**: autenticación (email/password) y frontera de propiedad de datos.
- **Campos clave**: `id`, `email` (único), `passwordHash`, `createdAt`, `updatedAt`.
- **Relaciones**:
  - 1:1 con `RunnerProfile`.
  - 1:N con `TrainingPlan`.
  - 1:N con `TrainingLog` (ownership explícito para auditoría simple).
- **Notas**: el estado inicial (onboarding pendiente / generar plan / dashboard) se deriva de perfil + plan activo.

### `RunnerProfile`

- **Propósito**: persistir la base del onboarding del corredor.
- **Campos clave**: `id`, `userId`, `experienceLevel`, `currentVolume`, `weeklyAvailability`, `preferences`, `constraints`, `onboardingCompletedAt`.
- **Relaciones**: pertenece a un único `User`.
- **Notas**: suficiente para generar plan inicial, evitando sobre-modelado clínico.

### `TrainingGoal`

- **Propósito**: representar el objetivo deportivo principal sobre el que se construye el plan.
- **Campos clave**: `id`, `userId`, `planId`, `raceType`, `targetDistanceKm`, `targetDate`, `priority` (MVP: `main`).
- **Relaciones**: pertenece a `User` y `TrainingPlan`.
- **Notas**: en MVP se permite solo **un objetivo principal por plan activo**.

### `TrainingPlan`

- **Propósito**: encapsular una versión de planificación (inicial o reajustada) del usuario.
- **Campos clave**: `id`, `userId`, `status` (`draft|active|archived`), `startDate`, `endDate`, `version`, `previousPlanId?`, `generatedAt`, `activatedAt`.
- **Relaciones**:
  - pertenece a `User`.
  - 1:N con `TrainingSession`.
  - 1:N con `PlanAdjustment`.
  - 1:1 lógico con `TrainingGoal` principal (MVP).
- **Notas**: solo un plan `active` por usuario. Cuando Kaito reajusta, crea una nueva versión de `TrainingPlan` basada en el plan anterior. El plan previo queda archivado como histórico para poder comparar qué cambió.

### `TrainingSession`

- **Propósito**: definir cada entrenamiento planificado visible en dashboard/calendario.
- **Campos clave**: `id`, `planId`, `scheduledDate`, `sessionType`, `plannedDurationMin`, `plannedDistanceKm?`, `plannedElevationM?`, `purpose`, `isKeySession`.
- **Relaciones**: pertenece a `TrainingPlan`.
- **Notas**: representa lo planificado; la ejecución real vive en `TrainingLog`.

### `TrainingLog`

- **Propósito**: capturar cómo salió realmente una sesión.
- **Campos clave**: `id`, `userId`, `sessionId`, `status` (`completed|failed|misperformed`), `actualDurationMin?`, `actualElevationM?`, `feeling` (`very_good|good|normal|bad|very_bad`), `painLevel` (`none|mild|moderate|high`), `notes`, `loggedAt`, `updatedAt`.
- **Relaciones**: pertenece a `User` y `TrainingSession`.
- **Notas**: base para KPIs y detección de desviaciones relevantes. En MVP existe un único log actual por sesión, pero puede editarse si el usuario corrige datos introducidos manualmente.

### `TrainingLogHistory`

- **Propósito**: conservar el histórico de cambios de un `TrainingLog` editable.
- **Campos clave**: `id`, `trainingLogId`, `changedAt`, `previousStatus?`, `newStatus?`, `previousValues`, `newValues`, `changeReason?`.
- **Relaciones**: pertenece a un único `TrainingLog`.
- **Notas**: permite entender si un reajuste se basó en datos que luego fueron corregidos y evita perder trazabilidad cuando el usuario edita un registro manual.

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
- `TrainingPlan` 1 — N `PlanAdjustment` como plan origen o plan generado

## 6) Reglas de datos / invariantes

1. **Un solo plan activo por usuario**.
2. **Un objetivo principal por plan activo**.
3. **Cada sesión pertenece a un único plan**.
4. **Cada log pertenece a un usuario y a una sesión existente de su plan activo o histórico**.
5. **Un log de entrenamiento puede editarse**, pero cada cambio relevante debe quedar registrado en `TrainingLogHistory`.
6. **Un reajuste crea una nueva versión de plan** y conserva el plan anterior como histórico.
7. **Un reajuste solo existe si hay desviación relevante según política** (`03-plan-adjustment-policy.md`).
8. **El usuario autenticado es dueño de su perfil, planes, sesiones y logs** (aislamiento por `userId`).
9. **El estado funcional post-login se deriva de datos**:
   - Sin onboarding completo → onboarding.
   - Onboarding completo y sin plan activo → generar plan.
   - Con plan activo → dashboard.

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

## 9) Referencias

- [`00-product-vision.md`](00-product-vision.md)
- [`02-user-journeys.md`](02-user-journeys.md)
- [`03-plan-adjustment-policy.md`](03-plan-adjustment-policy.md)
- [`04-functional-requirements.md`](04-functional-requirements.md)
