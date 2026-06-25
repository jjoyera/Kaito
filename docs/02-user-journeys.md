# User Journeys

## Propósito

Este documento describe los recorridos principales que debe poder completar un corredor dentro de Kaito.

El objetivo es transformar la visión de producto en situaciones concretas de uso antes de definir requisitos funcionales, pantallas o implementación técnica.

## Usuario principal

El usuario principal es un corredor amateur o intermedio que prepara una prueba de larga distancia y necesita un plan de entrenamiento personalizado, comprensible y adaptable.

Este usuario no busca únicamente una lista de entrenamientos. Necesita entender qué hacer, por qué hacerlo y cómo reajustar el plan cuando la realidad diaria no encaja con lo previsto.

## Resumen de recorridos

| Recorrido | Objetivo del usuario | Resultado esperado |
| --- | --- | --- |
| Primer acceso | Empezar a usar Kaito desde cero | El usuario entiende qué hace la aplicación e inicia el onboarding |
| Onboarding | Compartir contexto deportivo y disponibilidad | Kaito recopila la información necesaria para generar un plan inicial |
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

1. El usuario accede a la aplicación.
2. Kaito presenta su propuesta de valor de forma breve.
3. El usuario identifica que la aplicación puede ayudarle a preparar su objetivo deportivo.
4. El usuario inicia el onboarding.

### Resultado esperado

El usuario entiende que Kaito generará un plan de entrenamiento personalizado a partir de su contexto, experiencia, disponibilidad y objetivo.

## Journey 2: Onboarding inicial

### Situación

El usuario empieza el proceso de configuración inicial del plan.

### Necesidad

El usuario necesita introducir su información sin sentirse abrumado y entender por qué Kaito le pide esos datos.

### Recorrido principal

1. Kaito pregunta por el objetivo deportivo del usuario.
2. El usuario indica el tipo de prueba, distancia aproximada y fecha objetivo.
3. Kaito pregunta por la experiencia previa del corredor.
4. El usuario informa sobre su nivel, volumen actual y antecedentes relevantes.
5. Kaito pregunta por la disponibilidad semanal.
6. El usuario define días disponibles, restricciones y preferencias básicas.
7. Kaito confirma que tiene suficiente información para generar el plan inicial.

### Resultado esperado

Kaito dispone de una base mínima para crear un plan inicial coherente con el objetivo y la realidad del usuario.

### Riesgos a evitar

- Pedir demasiada información al inicio.
- Usar lenguaje deportivo excesivamente técnico sin explicación.
- Generar la sensación de que el plan será clínicamente perfecto o sustituirá a un entrenador profesional.

## Journey 3: Generación del plan inicial

### Situación

El usuario ha completado el onboarding y espera recibir su planificación.

### Necesidad

El usuario necesita confianza durante la espera y una transición clara hacia el plan generado.

### Recorrido principal

1. Kaito muestra un estado de generación del plan.
2. La aplicación comunica que está combinando objetivo, disponibilidad y nivel actual.
3. Kaito genera el plan inicial.
4. El usuario accede al dashboard con el plan activo.

### Resultado esperado

El usuario recibe un plan inicial y entiende que ese plan será la referencia para su seguimiento.

## Journey 4: Consulta del dashboard

### Situación

El usuario entra en Kaito para saber qué tiene que hacer y cómo va su preparación.

### Necesidad

El usuario necesita una visión rápida del estado actual del plan sin interpretar datos complejos.

### Recorrido principal

1. El usuario accede al dashboard.
2. Kaito muestra KPIs básicos del plan.
3. El usuario revisa los días hasta el objetivo, entrenamientos completados y entrenamientos pendientes.
4. El usuario consulta el calendario semanal.
5. El usuario identifica su próximo entrenamiento.

### Resultado esperado

El usuario sabe cuál es su situación actual y cuál es el siguiente paso de entrenamiento.

## Journey 5: Detalle del entrenamiento

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

## Journey 6: Registro de cumplimiento

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

## Journey 7: Reajuste básico del plan

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

### Resultado esperado

El usuario mantiene una referencia clara para continuar entrenando, incluso cuando no cumple exactamente lo planificado.

### Límites del MVP

El reajuste del plan en el MVP será básico. No pretende validar decisiones deportivas avanzadas ni sustituir el criterio de un entrenador profesional.

La interacción conversacional con Kaito para resolver dudas concretas sobre un entrenamiento queda como mejora futura. En el MVP, la IA debe centrarse principalmente en generar y reajustar bien el plan según las métricas establecidas.

## Criterios de aceptación de los journeys

Los journeys estarán correctamente cubiertos si el MVP permite demostrar que:

- El usuario puede iniciar Kaito y comprender su propuesta de valor.
- El usuario puede completar un onboarding inicial sin fricción excesiva.
- Kaito puede generar un plan inicial a partir del contexto del usuario.
- El usuario puede consultar el estado del plan desde un dashboard.
- El usuario puede entender el propósito de cada entrenamiento.
- El usuario puede registrar entrenamientos completados, fallidos o mal realizados.
- El usuario puede registrar métricas simples de entrenamiento, sensaciones y molestias.
- Kaito puede adaptar de forma básica el plan ante desviaciones simples basadas en cumplimiento, tiempo, desnivel, sensaciones o molestias.

## Decisiones abiertas

Antes de pasar a requisitos funcionales conviene resolver:

- Qué preguntas exactas tendrá el onboarding inicial.
- Qué campos mínimos tendrá cada entrenamiento.
- Qué reglas simples activarán un reajuste del plan a partir de cumplimiento, tiempo, desnivel, sensaciones y molestias.
- Qué nivel de explicación debe ofrecer Kaito para que el usuario entienda una sesión sin sobrecargar la interfaz.
- Cómo debería evolucionar en el futuro la interacción conversacional con Kaito para dudas concretas sobre entrenamientos.
