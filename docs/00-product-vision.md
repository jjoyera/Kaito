# Kaito - Product Vision

## Visión del producto

Kaito quiere ayudar a corredores de ultradistancia a entrenar con más claridad, continuidad y adaptación, reduciendo la dependencia de planes genéricos que no responden a la realidad diaria del atleta.

El producto propone una aplicación web con un coach de IA especializado en carreras de larga distancia como trail, ultra, backyard y OCR. A partir de un onboarding inicial, Kaito evalúa el estado actual del corredor, su experiencia, su disponibilidad y su objetivo de carrera para generar un plan de entrenamiento personalizado y comprensible.

Durante el seguimiento del plan, el corredor puede consultar sus próximos entrenamientos, entender el propósito de cada sesión y registrar su cumplimiento. Si aparecen desviaciones, como sesiones fallidas o mal realizadas, Kaito adapta el plan de forma básica para mantener al usuario orientado hacia su objetivo.

## Usuario objetivo

Kaito está dirigido a corredores amateurs o intermedios que preparan pruebas de larga distancia y necesitan una planificación más personalizada que un plan genérico, pero que no necesariamente cuentan con un entrenador humano de forma continua.

El usuario principal es una persona que:

- Tiene un objetivo deportivo concreto, como una carrera de trail, ultra, backyard u OCR.
- Necesita organizar sus entrenamientos según su disponibilidad real.
- Quiere entender por qué debe realizar cada sesión.
- Puede fallar entrenamientos por fatiga, trabajo, lesiones leves, cambios de agenda u otros imprevistos.
- Necesita una herramienta que le ayude a reajustar el camino sin perder la referencia del objetivo.

## Problema que resuelve Kaito

Muchos corredores de larga distancia entrenan sin una planificación clara, copian planes genéricos o no saben cómo adaptar sus entrenamientos cuando fallan sesiones, acumulan fatiga, cambian su disponibilidad o aparecen imprevistos.

Esta falta de adaptación provoca que el corredor pierda contexto, no entienda el propósito de sus entrenamientos y tome decisiones improvisadas sobre su preparación.

Kaito ayuda al corredor a construir un plan personalizado, entender el propósito de cada entrenamiento y adaptar el camino hacia su objetivo según su cumplimiento real.

## Propuesta de valor

Kaito crea, explica y adapta tu plan de entrenamiento para carreras de ultradistancia según tu objetivo, tu disponibilidad y tu cumplimiento real.

La propuesta de valor se apoya en tres ideas principales:

- **Personalización**: el plan inicial se genera a partir del estado actual, experiencia, disponibilidad y objetivo del corredor.
- **Comprensión**: cada sesión incluye una explicación de su propósito dentro del plan.
- **Adaptación**: el plan puede reajustarse de forma básica cuando el usuario no cumple lo planificado.

## Experiencia principal del producto

La primera experiencia de uso de Kaito se centrará en validar el flujo principal del producto:

1. El usuario entra por primera vez en la aplicación.
2. Kaito inicia un onboarding pregunta a pregunta.
3. El usuario define su estado actual, experiencia, disponibilidad y objetivo.
4. Kaito muestra un estado de generación del plan.
5. Se genera el plan inicial.
6. El usuario accede al dashboard.
7. El dashboard muestra KPIs, calendario semanal y próximos entrenamientos.
8. Cada entrenamiento explica su propósito.
9. El usuario puede marcar entrenamientos como completados, fallidos o mal realizados.
10. Kaito recalcula el plan si detecta desviaciones relevantes.

## Alcance del MVP

El MVP se centra en validar si un corredor puede crear, seguir y reajustar un plan de entrenamiento de forma comprensible dentro de una aplicación web.

El alcance inicial incluye:

- Onboarding pregunta a pregunta.
- Generación de un plan inicial con IA.
- Dashboard inicial.
- KPIs básicos del plan.
- Calendario semanal.
- Detalle de cada entrenamiento.
- Explicación del propósito de cada sesión.
- Registro de entrenamiento completado.
- Registro de entrenamiento fallido.
- Registro de entrenamiento mal realizado.
- Recalculo básico del plan ante desviaciones.
- Ajuste del plan mediante Kaito.

### KPIs del dashboard

El dashboard del MVP mostrará métricas simples para que el usuario entienda el estado actual de su preparación:

- Días hasta el objetivo.
- Entrenamientos totales del plan.
- Entrenamientos completados.
- Entrenamientos pendientes.
- Kilómetros planificados.
- Kilómetros completados.
- Porcentaje de cumplimiento.
- Carga semanal actual.
- Próximo entrenamiento.

## Fuera del MVP

Las siguientes funcionalidades quedan fuera del alcance inicial para mantener el proyecto acotado y validar primero el flujo principal:

- Gestión avanzada de múltiples temporadas.
- Varios objetivos principales simultáneos.
- Integración completa con Strava mediante webhooks.
- Sistema social entre corredores.
- Pagos o suscripciones.
- App móvil.
- Notificaciones push.
- RAG avanzado con documentos de entrenadores.
- Panel de administración.
- Roles de usuario avanzados.

## Criterios de éxito del MVP

El MVP será exitoso si permite demostrar que:

- Un usuario puede completar el onboarding y obtener un plan inicial.
- El plan generado es comprensible para el corredor.
- Cada sesión muestra un propósito claro dentro de la planificación.
- El usuario puede registrar el cumplimiento de sus entrenamientos.
- El sistema puede adaptar el plan ante desviaciones simples.
- El dashboard permite entender el estado actual del progreso.

## Decisión de alcance inicial

La primera versión de Kaito trabajará con un único usuario demo, un objetivo principal y un plan activo.

El objetivo de esta decisión es validar el flujo principal del producto: onboarding, generación del plan, visualización en dashboard, seguimiento de entrenamientos y recálculo básico ante desviaciones.

En el MVP, la adaptación del plan será básica y estará orientada a demostrar el comportamiento del sistema ante cambios simples de cumplimiento. No se plantea como una validación deportiva completa ni como sustituto profesional de un entrenador humano.
