# Comportamiento de la IA (MVP)

## 1) Propósito

Este documento define cómo debe comportarse la IA de Kaito en el MVP para **generar, explicar y reajustar** planes de entrenamiento de corredores de larga distancia.

La IA debe ayudar al usuario a mantener claridad y continuidad, dentro de límites de seguridad y alcance funcional del producto.

### Estado implementado

El backend implementa la generación autenticada de planes: `POST /planning/generate`
construye contexto vinculado al propietario, compone el adaptador OpenAI configurado en el
entorno, aplica validación determinista, permite como máximo un segundo intento solo si
falla esa validación y persiste/activa el resultado de forma atómica. `GET
/planning/active` devuelve el plan activo propio con orden estable y sin IDs ni metadata
interna.

Ambas rutas requieren autenticación y exponen outcomes seguros de las familias `401`,
`404`, `409`, `422` y `503`. El dashboard autenticado `/plan` ya consume el plan activo y
muestra únicamente datos planificados; la UI de generación y el E2E completo permanecen
pendientes. Las pruebas usan dobles deterministas: no se ha realizado una llamada real a
OpenAI ni demostrado un plan real generado en esta rama.

## 2) Responsabilidades de la IA

La IA en Kaito MVP debe:

1. Generar el plan inicial a partir del onboarding validado.
2. Explicar el propósito de cada `TrainingSession` en lenguaje claro.
3. Producir texto útil para dashboard/progreso cuando aplique (estado del plan, próximos pasos, resumen de ajuste).
4. Detectar desvíos relevantes y proponer reajustes básicos según política.
5. Comunicar límites y recomendaciones prudentes cuando existan señales de riesgo.

## 3) Inputs que la IA puede usar

En el MVP objetivo, Kaito puede construir contexto a partir de información disponible
y trazable del dominio, incluidas las entidades y políticas siguientes:

- `RunnerProfile`
- `TrainingGoal`
- `TrainingPlan`
- `TrainingSession`
- `TrainingLog`
- `TrainingLogHistory`
- `PlanAdjustment`
- Reglas de `03-plan-adjustment-policy.md`
- Base de conocimiento de dominio en `07-training-knowledge.md`

Si falta información crítica, la IA debe indicarlo explícitamente y pedir completar datos. **No puede inventar datos faltantes.**

En el contrato implementado, el proveedor recibe exclusivamente
`ProviderGenerationContext`, ya construido y autorizado por Kaito; no recibe las
entidades anteriores de forma independiente ni decide qué datos añadir. La política
numérica canónica de generación y validación está en
[`07-training-knowledge.md`](07-training-knowledge.md) y no se redefine aquí.

## 4) Plan approach (`TrainingPlan.planApproach`)

El plan debe respetar el enfoque seleccionado por el usuario en `TrainingPlan.planApproach`.

| Opción visible | Valor técnico | Intento deportivo | Comportamiento esperado | Límite de seguridad |
| --- | --- | --- | --- | --- |
| Camino Kaio | `kaio_path` | Conservador | Priorización de continuidad, carga progresiva y menor exposición a sesiones límite | No escalar carga agresivamente; priorizar recuperación ante señales negativas |
| Modo Z | `mode_z` | Equilibrado | Mix normal de sesiones base + algunas sesiones exigentes para mejorar rendimiento | Puede acercarse al límite de forma puntual, sin romper reglas de reajuste prudente |
| Kaioken | `kaioken` | Exigente | Mayor densidad de estímulos demandantes y cercanía más frecuente a límites de esfuerzo | **Nunca** puede anular reglas de seguridad, molestias/dolor o necesidad de recuperación |

Regla clave: `kaioken` aumenta exigencia planificada, pero no autoriza comportamiento temerario. Si aparecen dolor, malas sensaciones persistentes, sobrecarga o triggers de política, la IA debe aplicar ajuste conservador.

### Elegibilidad antes de la IA

La IA **no decide** qué enfoque está permitido ni cuál se recomienda. Antes de generar un plan, la política determinista del módulo `planning` evalúa el onboarding completado y una fecha local explícita. Devuelve los tres enfoques en orden de intensidad, sus códigos estables de bloqueo, la recomendación (`mode_z` si está disponible; en caso contrario `kaio_path`) y las restricciones de seguridad aplicables.

La generación debe tratar esos resultados como límites autoritativos:

- nunca seleccionar ni ofrecer un enfoque bloqueado;
- nunca recomendar `kaioken` por defecto, aunque esté disponible;
- aplicar los códigos de restricción a la carga y a las sesiones;
- no reinterpretar mediante el prompt el dolor, la recuperación o la fatiga.

El contrato completo y sus umbrales se definen en [`openspec/specs/training-approach-eligibility/spec.md`](../openspec/specs/training-approach-eligibility/spec.md).

## 5) Outputs esperados

El adaptador devuelve únicamente `GeneratedTrainingBlock`, parseado mediante
Structured Outputs al contrato Pydantic existente. No devuelve readiness, decisiones de
persistencia, estado de UI ni mensajes crudos del proveedor.

El MVP completo debe convertir y complementar ese bloque para ofrecer:

1. **Structured plan**: semanas/sesiones con objetivos, carga prevista y enfoque (`planApproach`) explícito.
2. **Session explanation**: propósito de cada sesión y cómo contribuye al objetivo.
3. **Adjustment proposal**: qué cambió, por qué cambió, impacto esperado inmediato.
4. **User-facing messages**: mensajes breves y accionables para dashboard o confirmaciones.

## 6) Flujo implementado de generación

```text
contexto owner-bound
  -> OpenAI: bloque estructurado
  -> validación determinista
  -> como máximo un segundo intento solo por fallo de validación
  -> persistencia y activación atómicas
```

El contexto y las decisiones autorizadas se ensamblan una sola vez. Un timeout, refusal,
fallo de transporte o respuesta no parseable se devuelve como error neutral y no activa
el reintento de validación. Ningún bloque inválido llega al repositorio. Si falla cualquier
inserción o cambio de estado, la transacción revierte también el archivado del plan
anterior.

La configuración de OpenAI es backend-only y se obtiene de variables de entorno:
`OPENAI_API_KEY` es requerida, `OPENAI_MODEL` está fijada a
`gpt-5.5-2026-04-23` y `OPENAI_TIMEOUT_SECONDS` vale `60` por defecto. Nunca se entrega
al dominio ni al frontend. FastAPI publica el contrato en `/docs`, `/redoc` y
`/openapi.json`.

## 7) Reglas de comportamiento

1. Priorizar claridad sobre tecnicismos.
2. Explicar el “por qué” de cada decisión relevante.
3. No inventar datos, métricas ni contexto del corredor.
4. Ser conservadora ante dolor, molestias persistentes o fatiga marcada.
5. No compensar carga perdida de forma agresiva.
6. Mantenerse dentro del alcance MVP (sin razonamiento clínico avanzado).

## 8) Comportamiento de reajuste

La IA debe aplicar la política de `03-plan-adjustment-policy.md` como fuente normativa.

### Qué sí puede cambiar

- Intensidad de próximas sesiones.
- Distribución semanal básica.
- Conversión de sesión exigente a rodaje suave/descanso cuando corresponda.
- Recalcular referencia desde carga real en lugar de carga ideal.

### Qué no puede hacer

- Diagnosticar lesiones.
- Recomendar ignorar dolor o forzar continuidad con señales de riesgo.
- Replanificar con lógica deportiva avanzada fuera del MVP.
- Hacer “sobrecompensación” para recuperar todo de golpe.

## 9) Tono de comunicación

La IA debe comunicarse con un tono:

- Claro y directo.
- Motivador sin exageraciones.
- Prudente (no alarmista).
- Respetuoso (no paternalista).
- Con jerga mínima y explicada cuando sea necesaria.

## 10) Comportamientos prohibidos / límites

La IA de Kaito MVP **no debe**:

- Prometer resultados deportivos.
- Presentarse como sustituto de entrenador o profesional médico.
- Emitir diagnóstico médico.
- Inventar datos faltantes del usuario.
- Ignorar políticas de seguridad por haber elegido `kaioken`.

## 11) Criterios de aceptación

Este comportamiento se considera correctamente definido para MVP si:

- La IA genera plan inicial con `planApproach` respetado.
- Cada sesión incluye una explicación comprensible de propósito.
- Los reajustes se activan por reglas de política y no por ruido menor.
- Ante dolor/molestias/fatiga relevante, el ajuste es conservador.
- Los mensajes comunican límites de responsabilidad sin ambigüedad.
- No se observan invenciones de datos en outputs de IA.
- El flujo interno valida antes de persistir y solo repite por un primer fallo de validación.
- Un fallo de persistencia no deja un plan parcial ni sustituye el activo anterior.
- La API de planes de entrenamiento está implementada, pero no se afirma disponibilidad UI, éxito E2E real con OpenAI ni preparación para producción antes de completar la experiencia web y el smoke test pendiente.

## 12) Referencias

- [`00-product-vision.md`](00-product-vision.md)
- [`02-user-journeys.md`](02-user-journeys.md)
- [`03-plan-adjustment-policy.md`](03-plan-adjustment-policy.md)
- [`04-functional-requirements.md`](04-functional-requirements.md)
- [`05-data-model.md`](05-data-model.md)
- [`07-training-knowledge.md`](07-training-knowledge.md)
