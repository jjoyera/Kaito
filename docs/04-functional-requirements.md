# Requisitos funcionales

## Propósito

Este documento define los requisitos funcionales del MVP de Kaito.

El objetivo es traducir la visión de producto y los user journeys en capacidades concretas que debe ofrecer el sistema, sin entrar todavía en arquitectura técnica, modelo de datos, diseño visual o implementación.

## Alcance del MVP

El MVP de Kaito debe permitir que un corredor pueda registrarse, completar un onboarding inicial, obtener un plan de entrenamiento personalizado, consultar su progreso, entender sus entrenamientos, registrar su cumplimiento y recibir reajustes básicos cuando existan desviaciones relevantes.

El MVP incluye:

- Registro y login con email y contraseña.
- Usuario demo para evaluación del TFM.
- Onboarding inicial del corredor.
- Evaluación y selección del enfoque del plan (Camino Kaio, Modo Z, Kaioken).
- Generación del plan inicial.
- Dashboard del plan activo.
- Consulta del detalle de entrenamiento.
- Registro de cumplimiento y métricas simples.
- Reajuste básico del plan ante desviaciones relevantes.
- Gestión básica de errores y estados vacíos.

Quedan fuera del MVP:

- Login con Google o Apple.
- Integración completa con Strava u otras plataformas externas.
- App móvil nativa.
- Notificaciones push.
- Pagos o suscripciones.
- Sistema social entre corredores.
- Varios objetivos principales simultáneos.
- Gestión avanzada de temporadas.
- Panel de administración.
- Recomendaciones médicas o diagnóstico de lesiones.
- Interacción conversacional avanzada para dudas concretas sobre entrenamientos.

## Principios funcionales

- Kaito debe asociar cada plan a un usuario identificado.
- El usuario debe entender qué está haciendo el sistema y por qué le pide determinados datos.
- El plan debe ser comprensible, no solo una lista de entrenamientos.
- Los enfoques bloqueados deben mostrarse con motivo; no deben ocultarse.
- Los reajustes deben ser conservadores y estar limitados al alcance del MVP.
- Kaito no debe presentarse como sustituto de un entrenador profesional ni como herramienta médica.

## RF-01 Registro de usuario

### Descripción

El sistema debe permitir que una persona cree una cuenta en Kaito mediante email y contraseña.

### Requisitos

- El usuario debe poder introducir un email, una contraseña y la repetición de la contraseña.
- La interfaz debe validar localmente que el email tenga un formato válido.
- La contraseña debe tener al menos 8 caracteres e incluir mayúscula, minúscula, número y símbolo.
- La repetición de contraseña debe coincidir con la contraseña.
- La interfaz debe mostrar feedback local, claro y específico para corregir los campos inválidos antes de enviar el registro.
- Supabase Auth es responsable de crear la cuenta y determinar si el alta devuelve una sesión inmediata o requiere confirmación posterior.
- Si Supabase devuelve una sesión inmediata, el sistema debe continuar automáticamente hacia `/onboarding`.
- Si Supabase no devuelve sesión, el sistema debe continuar hacia `/login` y mostrar una sola vez el texto neutral `Si los datos son correctos, recibirás un correo para confirmar tu cuenta. Si ya tienes una cuenta, inicia sesión.` sin exponer el email ni afirmar que el correo se envió definitivamente.
- El sistema debe admitir que Supabase oculte una cuenta duplicada mediante el mismo resultado sin sesión. Solo debe mostrar feedback explícito de duplicado cuando el proveedor lo identifique como tal.
- Ante un límite de frecuencia, el sistema debe bloquear todos los reintentos durante el plazo fiable indicado por el proveedor o durante 60 segundos como fallback, y reactivarlos automáticamente al vencer.
- Los errores explícitos de cuenta duplicada, límite de frecuencia o sistema deben permanecer accesibles en `/register` y permitir una recuperación coherente.
- Esta capacidad no incluye recuperación de contraseña ni debe mostrar enlaces o acciones de recuperación inexistentes.

### Estado de implementación

El registro mediante Supabase, la separación entre sesión inmediata y resultado sin sesión, el handoff a `/onboarding` o `/login`, el cooldown y el feedback accesible están implementados. El flujo real con confirmación requerida se ha comprobado; la sesión inmediata real y la compatibilidad manual con gestores de contraseñas permanecen sin verificar.

### Resultado esperado

El resultado comunicado por Supabase determina el siguiente paso: una sesión inmediata continúa hacia onboarding y un resultado sin sesión entrega el flujo a login con orientación neutral para confirmar la cuenta.

## RF-02 Login de usuario

### Descripción

El sistema debe permitir que un usuario registrado acceda a Kaito con su email y contraseña.

### Requisitos

- El usuario debe poder introducir su email y contraseña.
- El sistema debe validar las credenciales introducidas.
- Si las credenciales son correctas, el usuario debe acceder a su cuenta.
- Si las credenciales son incorrectas, el sistema debe mostrar un error comprensible.
- El sistema debe mantener al usuario autenticado durante la sesión.

### Resultado esperado

El usuario puede acceder a Kaito y continuar desde el estado asociado a su cuenta.

## RF-03 Usuario demo

### Descripción

El sistema debe permitir el acceso a un usuario demo para facilitar la evaluación del TFM.

### Requisitos

- El usuario demo debe permitir probar el flujo principal de Kaito sin crear datos desde cero.
- El usuario demo debe tener datos suficientes para mostrar el producto en un estado representativo.
- El usuario demo no debe sustituir al flujo real de registro y login.
- El usuario demo debe estar claramente orientado a evaluación y demostración.

### Resultado esperado

Los profesores pueden probar Kaito con rapidez y entender el comportamiento principal del MVP.

## RF-04 Estado inicial del usuario

### Descripción

El sistema debe identificar si el usuario autenticado ya tiene un plan activo o si necesita completar el onboarding inicial.

### Requisitos

- Si el usuario no tiene onboarding completado, el sistema debe dirigirlo al onboarding.
- Si el usuario completó el onboarding pero no tiene plan activo, el sistema debe permitir generar el plan inicial.
- Si el usuario ya tiene un plan activo, el sistema debe dirigirlo al dashboard.

### Resultado esperado

Kaito decide correctamente cuál es el siguiente paso funcional para el usuario autenticado.

## RF-05 Onboarding inicial

### Descripción

El sistema debe guiar al usuario mediante un onboarding inicial para recopilar la información mínima necesaria para generar un plan de entrenamiento personalizado.

### Requisitos

- El sistema debe preguntar por el objetivo deportivo del usuario.
- El sistema debe recoger la modalidad o tipo de prueba objetivo.
- El sistema debe recoger campos de objetivo según modalidad:
  - Trail, ultra-trail y OCR: `targetDistanceKm` y `targetDate`.
  - Backyard Ultra: `targetDate`, `targetLoops` o `targetHours`, `targetLoopDurationMin` (o ritmo equivalente), `expectedRestMarginMin` y notas básicas de estrategia de box/transición. La distancia fija no se usa como objetivo principal.
- El sistema debe preguntar por la experiencia previa del corredor.
- El sistema debe recoger, de forma explícita para las cuatro semanas anteriores, las sesiones, la distancia total, el desnivel positivo acumulado, la salida más larga y la constancia reciente (`irregular`, `fairly_consistent` o `very_consistent`). Las horas totales de entrenamiento no forman parte de este paso.
- El contrato activo usa un estado limpio: no acepta ni conserva `training_years`, `completed_race_count_range`, `practiced_modalities`, `practiced_terrain` ni `goal.technicality`; no incluye migración ni compatibilidad para esas respuestas retiradas.
- El sistema debe preguntar por la disponibilidad semanal en el Paso 4 de siete: días compactos, atajos de 45/60/120 minutos y ajustes exactos de 15 a 300 minutos por día. Solo se guarda el mapa disperso de minutos; `Varía por día` es una ayuda visual.
- El sistema debe bloquear Continuar si hay menos de tres días o menos de 150 minutos semanales; Atrás conserva el estado local y Continuar guarda antes de avanzar. Un fallo permite reintentar sin perder las respuestas.
- El sistema debe permitir indicar restricciones o preferencias básicas.
- El sistema debe explicar de forma breve por qué solicita esa información.
- El sistema debe evitar preguntas excesivas que bloqueen el inicio del producto.

### Resultado esperado

Kaito obtiene suficiente contexto para generar un primer plan coherente con el objetivo, experiencia y disponibilidad del usuario.

## RF-06 Validación del onboarding

### Descripción

El sistema debe validar que el onboarding contiene la información mínima necesaria antes de generar el plan inicial.

### Requisitos

- El sistema debe comprobar que el usuario ha indicado un objetivo deportivo.
- El sistema debe comprobar que el objetivo incluye los campos mínimos para la modalidad elegida.
- El sistema debe comprobar que existe `targetDate` (fecha objetivo del evento) para cualquier modalidad antes de construir el plan.
- El sistema debe comprobar que existe información mínima sobre experiencia y disponibilidad.
- Si falta información necesaria, el sistema debe pedirla antes de continuar.
- El sistema no debe generar un plan inicial con datos insuficientes.

### Resultado esperado

El plan inicial se genera a partir de información suficiente y no desde un formulario incompleto.

## RF-07 Selección del enfoque y generación del plan inicial

### Descripción

El sistema debe evaluar la elegibilidad de enfoques de plan, permitir la selección del usuario y generar el plan inicial con el enfoque elegido.

### Requisitos

- El sistema debe iniciar la generación del plan cuando el onboarding esté completo.
- El sistema debe evaluar y mostrar las tres opciones visibles: Camino Kaio (`kaio_path`), Modo Z (`z_mode`) y Kaioken (`kaioken`).
- El sistema debe recomendar una opción según el perfil y contexto del corredor.
- El usuario debe poder elegir entre los enfoques elegibles.
- Si un enfoque está bloqueado, el sistema debe mostrarlo bloqueado con explicación comprensible.
- `kaioken` debe quedar bloqueado salvo preparación alta demostrable (p. ej., historial sólido y base actual fuerte).
- Si el corredor viene de un parón, casi sin kilometraje o con base insuficiente para su objetivo/tiempo, solo debe quedar disponible Camino Kaio.
- El sistema debe persistir la evaluación de disponibilidad y bloqueos usando el concepto `PlanApproachEligibility`.
- El sistema debe persistir el enfoque elegido en `TrainingPlan.planApproach`.
- El sistema debe mostrar un estado de generación mientras se procesa el plan.
- El sistema debe comunicar que está usando objetivo, disponibilidad, experiencia y enfoque elegido.
- El sistema debe usar explícitamente los datos de objetivo específicos de la modalidad al generar la planificación.
- El sistema debe generar una planificación inicial asociada al usuario.
- El sistema debe generar la planificación respetando `TrainingPlan.planApproach`.
- El sistema debe guardar el plan generado como plan activo del usuario.
- El sistema debe permitir reevaluar elegibilidad en el futuro para desbloquear enfoques si el usuario progresa, cumple y rinde bien.
- El sistema debe informar al usuario cuando el plan esté disponible.

### Resultado esperado

El usuario recibe un plan inicial vinculado a su cuenta, con enfoque explícito y trazabilidad de opciones elegibles/bloqueadas.

## RF-08 Dashboard del plan activo

### Descripción

El sistema debe mostrar al usuario una visión resumida del estado actual de su preparación.

### Requisitos

- El sistema debe mostrar el plan activo del usuario.
- El sistema debe mostrar los días restantes hasta el objetivo.
- El sistema debe mostrar entrenamientos totales, completados y pendientes.
- El sistema debe mostrar una vista semanal o calendario básico.
- El sistema debe destacar el próximo entrenamiento.
- El sistema debe mostrar KPIs simples que ayuden a entender el progreso.
- En MVP, el KPI `carga semanal actual` debe poder calcularse como suma semanal de carga por sesión basada en sRPE (`actualDurationMin × RPE`).

### Resultado esperado

El usuario entiende rápidamente en qué punto está y cuál es su siguiente entrenamiento.

## RF-09 Detalle de entrenamiento

### Descripción

El sistema debe permitir consultar el detalle de cada entrenamiento del plan.

### Requisitos

- El usuario debe poder abrir un entrenamiento desde el dashboard o calendario.
- El sistema debe mostrar duración, distancia o carga estimada cuando aplique.
- El sistema debe mostrar el tipo de entrenamiento.
- El sistema debe explicar el propósito de la sesión dentro del plan.
- El sistema debe usar un lenguaje comprensible para corredores amateurs o intermedios.

### Resultado esperado

El usuario entiende qué debe hacer y por qué esa sesión existe dentro de la planificación.

## RF-10 Registro de cumplimiento

### Descripción

El sistema debe permitir que el usuario registre cómo fue un entrenamiento planificado.

### Requisitos

- El usuario debe poder marcar un entrenamiento como completado.
- El usuario debe poder marcar un entrenamiento como fallido.
- El usuario debe poder marcar un entrenamiento como mal realizado.
- El sistema debe actualizar el progreso del plan tras el registro.
- El sistema debe reflejar el nuevo estado del entrenamiento en el dashboard.

### Resultado esperado

El plan deja de ser una planificación ideal y empieza a reflejar la ejecución real del usuario.

## RF-11 Registro de métricas simples

### Descripción

El sistema debe recoger métricas simples después de cada entrenamiento para permitir seguimiento y reajustes básicos.

### Requisitos

- El sistema debe registrar el cumplimiento del entrenamiento.
- El sistema debe permitir registrar la distancia total realizada en km.
- El sistema debe permitir registrar tiempo de entrenamiento.
- El sistema debe permitir registrar RPE de sesión en escala 1-10.
- El sistema debe permitir registrar desnivel acumulado cuando aplique.
- El sistema debe permitir registrar sensaciones del corredor como señal cualitativa.
- El sistema debe permitir registrar molestias o dolor reportado.
- El sistema debe mantener el registro suficientemente simple para no generar fricción excesiva.
- En MVP, las métricas obligatorias se mantienen simples; métricas adicionales (p. ej., ritmo medio o FC media) podrán incorporarse de forma incremental con futuras integraciones.

### Resultado esperado

Kaito dispone de señales básicas para entender la diferencia entre lo planificado y lo realizado.

## RF-12 Detección de desviaciones relevantes

### Descripción

El sistema debe detectar cuándo una desviación puede requerir un reajuste básico del plan.

### Requisitos

- El sistema debe evaluar el cumplimiento de entrenamientos clave.
- El sistema debe detectar entrenamientos fallidos relevantes.
- El sistema debe detectar cuando el usuario completa mucha menos carga de la prevista.
- El sistema debe detectar cuando el usuario completa mucha más carga de la prevista.
- El sistema debe considerar sensaciones muy malas o repetidamente malas.
- El sistema debe considerar molestias o dolor reportado.
- El sistema debe seguir las reglas definidas en [`03-plan-adjustment-policy.md`](03-plan-adjustment-policy.md).

### Resultado esperado

Kaito identifica desviaciones relevantes sin reajustar por cualquier diferencia menor.

## RF-13 Reajuste básico del plan

### Descripción

El sistema debe proponer un reajuste básico del plan cuando detecte una desviación relevante.

### Requisitos

- El sistema debe informar al usuario de que el plan puede necesitar un ajuste.
- El sistema debe generar una propuesta de ajuste cuando detecte una desviación relevante.
- El sistema debe proponer una adaptación básica y comprensible.
- El sistema debe evitar recuperar carga perdida de forma agresiva.
- El sistema debe poder suavizar próximas sesiones si hay exceso de carga, malas sensaciones o molestias.
- Si el usuario aplica el ajuste, el sistema debe crear una nueva versión de `TrainingPlan` basada en el plan anterior.
- El plan anterior debe quedar preservado/archivado para histórico y comparación.
- El sistema debe registrar `PlanAdjustment` con: disparador (`trigger`), regla de política aplicada (`policyRule`), resumen del cambio, plan previo y plan nuevo.
- Tras aplicar el ajuste, solo debe quedar un plan activo para el usuario.
- El sistema debe permitir que el usuario entienda qué cambió entre el plan previo y el nuevo, sin requerir en MVP el uso simultáneo de ambos planes.
- El sistema debe mantener el reajuste dentro del alcance definido para el MVP.

### Resultado esperado

El usuario recupera claridad para seguir entrenando sin tener que decidir por su cuenta cómo modificar la planificación.

## RF-14 Límites de seguridad y responsabilidad

### Descripción

El sistema debe comunicar los límites de Kaito cuando aparezcan molestias, dolor o decisiones deportivas sensibles.

### Requisitos

- El sistema no debe diagnosticar lesiones.
- El sistema no debe sustituir el criterio de un profesional médico o deportivo.
- Si el usuario reporta dolor persistente o relevante, el sistema debe recomendar prudencia y consulta profesional.
- El sistema debe formular los reajustes como apoyo orientativo dentro del MVP.

### Resultado esperado

Kaito ayuda al usuario sin presentar autoridad médica o deportiva indebida.

## RF-15 Gestión de errores y estados vacíos

### Descripción

El sistema debe manejar errores básicos y estados incompletos sin dejar al usuario bloqueado.

### Requisitos

- Si el registro falla, el sistema debe mostrar un mensaje comprensible.
- Si el login falla, el sistema debe indicar que las credenciales no son válidas.
- Si la generación del plan falla, el sistema debe permitir reintentar.
- Si el usuario no tiene plan activo, el sistema debe guiarlo hacia onboarding o generación.
- El sistema no debe mostrar detalles técnicos internos al usuario final.

### Resultado esperado

El usuario entiende qué ha ocurrido y cuál es la siguiente acción posible.

## Criterios de aceptación del MVP

El MVP estará correctamente cubierto si:

- El usuario puede registrarse con email, contraseña y repetición de contraseña.
- El registro valida formato de email, fortaleza y coincidencia de contraseñas, y muestra feedback local comprensible.
- El resultado de Supabase determina si existe sesión inmediata o si el usuario debe continuar por la confirmación desde login, sin afirmar que se haya enviado un correo cuando el proveedor lo oculta.
- El usuario puede iniciar sesión con email y contraseña.
- Los profesores pueden acceder a un usuario demo para probar el TFM.
- Kaito identifica si el usuario necesita onboarding, generación de plan o dashboard.
- El usuario puede completar un onboarding inicial sin fricción excesiva.
- Kaito valida que tiene información suficiente antes de generar el plan.
- Kaito recoge y valida campos de objetivo específicos por modalidad, incluyendo `targetDate` en todas y Backyard Ultra por vueltas/horas/ritmo-margen/estrategia.
- Kaito recomienda un enfoque de plan, permite elegir entre opciones elegibles y muestra las bloqueadas con motivo.
- Kaito persiste elegibilidad/bloqueos y enfoque elegido para usarlo en la generación del plan.
- Kaito genera un plan inicial asociado al usuario y alineado con el enfoque elegido.
- El usuario puede consultar un dashboard con estado general, KPIs básicos y próximo entrenamiento.
- El usuario puede abrir un entrenamiento y entender su propósito.
- El usuario puede registrar cumplimiento y métricas simples.
- Kaito puede detectar desviaciones relevantes a partir de cumplimiento, tiempo, RPE, desnivel, sensaciones y molestias.
- Kaito puede aplicar un reajuste básico dentro de los límites del MVP creando una nueva versión de `TrainingPlan`, preservando la anterior y manteniendo un único plan activo.
- Kaito comunica sus límites cuando aparecen molestias, dolor o decisiones sensibles.
- Si ocurre un error, el usuario recibe una explicación clara y una acción posible.

## Referencias

- [`00-product-vision.md`](00-product-vision.md)
- [`02-user-journeys.md`](02-user-journeys.md)
- [`03-plan-adjustment-policy.md`](03-plan-adjustment-policy.md)
