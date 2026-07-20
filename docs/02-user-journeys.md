# User Journeys

> **Lectura de estado:** los journeys 1–4 están entregados dentro de los límites indicados. Los journeys 5–7 conservan la experiencia objetivo y no forman parte del MVP implementado. El estado operativo canónico está en [`../README.md`](../README.md).

## Propósito

Este documento describe los recorridos principales que debe poder completar un corredor dentro de Kaito.

El objetivo es transformar la visión de producto en situaciones concretas de uso antes de definir requisitos funcionales, pantallas o implementación técnica.

## Usuario principal

El usuario principal es un corredor amateur o intermedio que prepara una prueba de larga distancia y necesita un plan de entrenamiento personalizado, comprensible y adaptable.

Este usuario no busca únicamente una lista de entrenamientos. Necesita entender qué hacer, por qué hacerlo y cómo reajustar el plan cuando la realidad diaria no encaja con lo previsto.

## Resumen de recorridos

| Recorrido | Objetivo del usuario | Resultado esperado |
| --- | --- | --- |
| Primer acceso | Acceder con una cuenta existente o iniciar el registro | El usuario autenticado puede continuar hacia el onboarding |
| Onboarding | Compartir contexto deportivo y elegir enfoque del plan | Kaito recopila la información necesaria y permite elegir explícitamente entre opciones elegibles |
| Generación del plan | Obtener una planificación personalizada | El usuario recibe un plan inicial asociado a su objetivo |
| Consulta del dashboard | Entender el estado actual de su preparación | El usuario ve KPIs, calendario semanal y próximos entrenamientos |
| Detalle del entrenamiento | Comprender qué debe hacer y por qué | El usuario revisa la sesión y su propósito dentro del plan |
| Registro de cumplimiento | Indicar cómo fue un entrenamiento y registrar métricas simples | Kaito actualiza el estado del plan según la ejecución real |
| Reajuste del plan | Recuperar claridad después de una desviación | Kaito propone una adaptación básica del plan a partir de métricas objetivas y sensaciones del corredor |

## Journey 1: Primer acceso

### Situación

El corredor llega por primera vez a Kaito porque quiere preparar una carrera de larga distancia y no quiere depender de un plan genérico.

### Necesidad

El usuario necesita entender rápidamente qué problema resuelve Kaito y qué se espera de él para empezar.

### Recorrido principal

1. El usuario accede a `/` y la aplicación lo redirige a `/login`.
2. Si ya tiene una cuenta, introduce email y contraseña e inicia sesión mediante Supabase.
3. Si es nuevo, selecciona `Crear cuenta` y accede a `/register`.
4. En el registro introduce email, contraseña y repetición de contraseña.
5. La interfaz valida localmente el formato del email, que la contraseña tenga al menos 8 caracteres e incluya mayúscula, minúscula, número y símbolo, y que ambas contraseñas coincidan.
6. Al enviar datos válidos, una capa modal accesible y no nativa bloquea envíos duplicados solo mientras Supabase procesa la solicitud.
7. Si Supabase devuelve una sesión inmediata, el usuario continúa automáticamente hacia `/onboarding`.
8. Si Supabase no devuelve sesión, la aplicación redirige a `/login` y muestra una sola vez el aviso neutral: `Si los datos son correctos, recibirás un correo para confirmar tu cuenta. Si ya tienes una cuenta, inicia sesión.` El aviso no asegura que el correo se haya enviado, ya que el proveedor puede ocultar con el mismo resultado que la cuenta ya exista.
9. Si Supabase identifica explícitamente una cuenta duplicada o un error inesperado, el feedback permanece en `/register` y permite corregir o reintentar. No existe todavía recuperación de contraseña.
10. Ante un límite de frecuencia, el formulario bloquea todos los reintentos durante el plazo indicado por metadatos fiables del proveedor o, si no existen, durante 60 segundos; después se habilita automáticamente.

### Estado actual

El registro real mediante Supabase, sus resultados de sesión inmediata o confirmación pendiente, el handoff a login/onboarding, el cooldown y el feedback accesible ya están implementados. La comprobación real del camino con sesión inmediata y la compatibilidad manual con gestores de contraseñas siguen pendientes; el camino real con confirmación requerida sí se ha comprobado.

### Resultado esperado

El usuario puede elegir entre iniciar sesión o crear una cuenta. Una sesión confirmada continúa hacia onboarding; un resultado sin sesión entrega el flujo a login con orientación neutral para confirmar la cuenta.

## Journey 2: Onboarding inicial

### Situación

El usuario empieza el proceso de configuración inicial del plan.

### Necesidad

El usuario necesita introducir su información sin sentirse abrumado y entender por qué Kaito le pide esos datos.

### Estado de implementación actual

> `/onboarding` entrega una introducción de valor y un recorrido persistente de siete pasos. Los Pasos 1–6 recogen objetivo, base, historial, disponibilidad, preferencias y estado físico. El Paso 7 consulta la elegibilidad determinista, exige seleccionar un enfoque permitido y guarda el borrador antes de navegar a generación. La UI operativa admite Trail y Ultra Trail; OCR y Backyard quedan fuera de este recorrido entregado.

### Recorrido principal

1. Kaito pregunta por el objetivo deportivo del usuario.
2. El usuario indica el tipo de prueba o modalidad objetivo (trail, ultra-trail, backyard ultra u OCR).
3. Kaito solicita los campos del objetivo según modalidad:
   - Trail, ultra-trail u OCR: distancia y fecha objetivo.
   - Backyard Ultra: fecha objetivo del evento, vueltas/horas objetivo, ritmo o duración esperada por vuelta, margen de descanso estimado y estrategia básica de box/transición. En Backyard, la distancia fija no es el objetivo principal.
4. Kaito pregunta por la experiencia previa del corredor.
5. El usuario informa sobre su nivel, volumen actual y antecedentes relevantes.
6. En el Paso 4, Kaito pregunta por la disponibilidad semanal: el usuario selecciona días, puede aplicar 45, 60 o 120 minutos y ajustar cada día entre 15 y 300 minutos exactos.
7. El usuario necesita al menos tres días y 150 minutos semanales. Atrás conserva las respuestas locales; Continuar guarda el mapa exacto antes de pasar al siguiente paso. Si falla el guardado, puede reintentar sin perderlas.
8. En el Paso 5, el usuario indica sus accesos y preferencia de planificación.
9. En el Paso 6, el usuario elige su estado físico y puede describir dolor o limitaciones en un campo siempre visible y opcional. Continuar completa el onboarding; el detalle se recorta en sus extremos y se omite si está vacío.
10. Kaito evalúa elegibilidad de enfoques y muestra tarjetas visuales de Camino Kaio, Modo Z y Kaioken.
11. El usuario elige explícitamente entre los enfoques elegibles, sin preselección ni decoración de recomendación; los bloqueados permanecen visibles con todos sus motivos.
12. Kaito guarda un único borrador de plan asociado al corredor con el enfoque elegido.
13. Kaito confirma que tiene suficiente información para iniciar el siguiente paso de generación del plan.

### Resultado esperado

Kaito dispone de una base mínima para crear un plan inicial coherente con el objetivo y la realidad del usuario, con enfoque explícito seleccionado.

### Reglas visibles de elegibilidad

- `kaioken` solo aparece elegible cuando el corredor demuestra preparación alta (p. ej., historial sólido y base actual fuerte).
- Si el usuario viene de un parón, casi sin kilometraje o con base insuficiente para su objetivo, solo queda disponible Camino Kaio.
- Los enfoques bloqueados no se ocultan: se muestran con explicación y pueden desbloquearse más adelante si el corredor progresa y cumple bien.

### Riesgos a evitar

- Pedir demasiada información al inicio.
- Usar lenguaje deportivo excesivamente técnico sin explicación.
- Generar la sensación de que el plan será clínicamente perfecto o sustituirá a un entrenador profesional.

## Journey 3: Generación del plan inicial

### Situación

El usuario ha completado el onboarding y espera recibir su planificación.

### Necesidad

El usuario necesita confianza durante la espera y una transición clara hacia el plan generado.

### Estado actual

El recorrido web está conectado: `/plan/generating` ejecuta `POST /planning/generate`, muestra progreso o error, permite reintentar y redirige a `/plan` tras activar el bloque. El dashboard consume `GET /planning/active`. Las pruebas automatizadas usan dobles deterministas; no se ha documentado un smoke test autenticado con OpenAI real ni preparación para producción.

### Recorrido principal

1. Kaito muestra un estado de generación del plan.
2. La aplicación comunica que está combinando objetivo, disponibilidad, nivel actual y enfoque elegido.
3. Kaito genera el plan inicial.
4. El usuario accede al dashboard con el plan activo.

### Resultado esperado

El usuario recibe un plan inicial y entiende que ese plan será la referencia para su seguimiento.

## Journey 4: Consulta del dashboard

### Situación

El usuario entra en Kaito para saber qué tiene que hacer y cómo va su preparación.

### Necesidad

El usuario necesita una visión rápida del estado actual del plan sin interpretar datos complejos.

### Estado actual

El dashboard protegido está entregado. Presenta métricas del bloque planificado, la próxima sesión, calendario semanal y calendario completo de sesiones. No existen logs de cumplimiento: no muestra entrenamientos completados ni telemetría real.

### Recorrido principal entregado

1. El usuario accede al dashboard del plan activo.
2. Kaito muestra kilómetros y sesiones planificadas de la semana, días restantes y progreso temporal del bloque.
3. El usuario consulta el calendario semanal o el calendario completo.
4. El usuario identifica su próxima sesión y revisa propósito, instrucciones, duración, distancia, desnivel e intensidad planificados.

### Resultado esperado

El usuario sabe cuál es su situación actual y cuál es el siguiente paso de entrenamiento.

## Journey 5: Detalle del entrenamiento (objetivo futuro)

### Situación

El usuario quiere preparar una sesión concreta antes de realizarla.

### Necesidad

El usuario necesita saber qué debe hacer, con qué intensidad y qué propósito tiene esa sesión dentro del plan.

### Recorrido principal

1. El usuario selecciona un entrenamiento desde el dashboard o el calendario.
2. Kaito muestra el detalle de la sesión.
3. El usuario revisa duración, distancia o carga estimada.
4. Kaito explica el propósito del entrenamiento.
5. El usuario entiende cómo esa sesión contribuye a su objetivo.

### Resultado esperado

El entrenamiento deja de ser una tarea aislada y se entiende como parte de una progresión.

## Journey 6: Registro de cumplimiento (no entregado)

### Situación

El usuario termina una sesión o decide registrar que no pudo realizarla.

### Necesidad

El usuario necesita informar el resultado real de forma rápida y sin fricción, pero con suficiente contexto para que Kaito pueda acompañar mejor la evolución del plan.

### Recorrido principal

1. El usuario abre el entrenamiento correspondiente.
2. Kaito permite marcar la sesión como completada, fallida o mal realizada.
3. El usuario registra métricas simples del entrenamiento.
4. Kaito actualiza los KPIs y el progreso del plan.
5. Si la desviación es relevante, Kaito prepara un reajuste básico.

### Métricas iniciales

El registro del entrenamiento debería recoger, de forma simple:

- Cumplimiento del entrenamiento.
- Tiempo de entrenamiento.
- Desnivel acumulado.
- Sensaciones del corredor.
- Molestias o dolor reportado.

### Resultado esperado

El plan refleja la ejecución real del usuario y no únicamente la planificación ideal. Esto permite que los reajustes posteriores tengan más contexto que una simple marca de completado o fallido.

## Journey 7: Reajuste básico del plan (no entregado)

### Situación

El usuario ha fallado una sesión, ha realizado mal un entrenamiento, ha acumulado más o menos carga de la esperada o ha reportado sensaciones y molestias relevantes.

### Necesidad

El usuario necesita recuperar claridad sin tener que decidir por su cuenta cómo modificar la planificación.

### Recorrido principal

1. Kaito detecta una desviación relevante a partir del cumplimiento, tiempo, desnivel, sensaciones o molestias registradas.
2. La aplicación informa al usuario de que el plan puede necesitar un ajuste.
3. Kaito propone una adaptación básica del plan.
4. El usuario revisa el cambio sugerido.
5. El plan actualizado queda disponible en el dashboard.

Las reglas que definen cuándo una desviación se considera relevante están documentadas en [`03-plan-adjustment-policy.md`](03-plan-adjustment-policy.md).

### Resultado esperado

El usuario mantiene una referencia clara para continuar entrenando, incluso cuando no cumple exactamente lo planificado.

### Límites del MVP

El reajuste del plan en el MVP será básico. No pretende validar decisiones deportivas avanzadas ni sustituir el criterio de un entrenador profesional.

La interacción conversacional con Kaito para resolver dudas concretas sobre un entrenamiento queda como mejora futura. En el MVP, la IA debe centrarse principalmente en generar y reajustar bien el plan según las métricas establecidas.

## Criterios de aceptación de la visión

Esta lista conserva la cobertura objetivo. En la entrega actual se cumplen el acceso, onboarding, selección, generación y consulta planificada; el detalle navegable independiente, los logs y el reajuste permanecen pendientes:

- El usuario que accede a `/` llega a `/login` y puede elegir entre iniciar sesión o ir a `/register`.
- El registro solicita email, contraseña y repetición, muestra feedback local para datos inválidos y procesa un único intento mediante Supabase.
- Una sesión inmediata continúa a onboarding; un resultado sin sesión continúa a login con orientación neutral, sin afirmar que el correo se envió definitivamente.
- Los límites de frecuencia bloquean reintentos durante el cooldown y no se presenta recuperación de contraseña mientras esa capacidad no exista.
- El usuario puede completar un onboarding inicial sin fricción excesiva una vez autenticado.
- Kaito muestra Camino Kaio, Modo Z y Kaioken en ese orden, exige una elección explícita entre los elegibles y muestra los bloqueados con todos sus motivos.
- Kaito puede generar un plan inicial a partir del contexto del usuario.
- El usuario puede consultar el estado del plan desde un dashboard.
- El usuario puede entender el propósito de cada entrenamiento.
- El usuario puede registrar entrenamientos completados, fallidos o mal realizados.
- El usuario puede registrar métricas simples de entrenamiento, sensaciones y molestias.
- Kaito puede adaptar de forma básica el plan ante desviaciones simples basadas en cumplimiento, tiempo, desnivel, sensaciones o molestias.
