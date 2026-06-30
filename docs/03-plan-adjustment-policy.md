# Política de reajuste del plan

## Propósito

Este documento define las reglas simples que activarán un reajuste básico del plan de entrenamiento en Kaito.

El objetivo no es validar decisiones deportivas avanzadas ni sustituir el criterio de un entrenador profesional. El objetivo del MVP es detectar desviaciones relevantes y mantener una planificación clara, segura y realista para que el corredor pueda continuar entrenando.

## Decisión general

Kaito no reajustará el plan por cualquier pequeña diferencia entre lo planificado y lo realizado.

El reajuste se activará únicamente cuando el entrenamiento real indique que el plan actual ya no representa bien la realidad del corredor.

Una desviación se considerará relevante cuando afecte al cumplimiento de sesiones clave, reduzca o aumente de forma significativa la carga prevista, o cuando el usuario reporte sensaciones muy malas, molestias o dolor.

## Métricas utilizadas para detectar desviaciones

Las reglas de reajuste se apoyan en las métricas mínimas registradas por el usuario después de cada entrenamiento:

- Cumplimiento del entrenamiento.
- Tiempo de entrenamiento.
- Desnivel acumulado.
- Sensaciones del corredor.
- Molestias o dolor reportado.

## Reglas que activan reajuste

### 1. Entrenamiento fallido

Kaito activará un reajuste cuando el usuario marque como fallido un entrenamiento relevante para la progresión del plan.

#### Activa reajuste si

- El usuario falla un entrenamiento clave.
- El usuario falla dos entrenamientos en una misma semana.
- El usuario falla dos entrenamientos consecutivos.
- El usuario falla el entrenamiento largo semanal.

#### No activa reajuste si

- El usuario falla un rodaje suave aislado.
- El usuario falla una sesión secundaria y el resto de la semana sigue siendo viable.

#### Ejemplo

El usuario tenía una tirada larga de 3 horas y la marca como fallida.

Kaito propone adaptar la semana siguiente para no intentar recuperar toda la carga de golpe.

---

### 2. Entrenamiento mal realizado

Kaito activará un reajuste cuando el usuario complete una parte claramente insuficiente de una sesión relevante.

#### Activa reajuste si

- El usuario completa menos del 70% del tiempo previsto.
- El usuario completa menos del 70% del desnivel previsto.
- El entrenamiento tenía un propósito clave y no se cumple.

Se consideran entrenamientos especialmente relevantes:

- Tirada larga.
- Entrenamiento de desnivel.
- Series o subidas.
- Entrenamiento específico de carrera.
- Back-to-back de fin de semana.

#### No activa reajuste si

- El usuario completa entre el 80% y el 90% del entrenamiento previsto.
- La desviación es pequeña y las sensaciones son buenas.

#### Ejemplo

Planificado:

- 2h30 de entrenamiento.
- 900m de desnivel positivo.

Realizado:

- 1h20 de entrenamiento.
- 300m de desnivel positivo.

Kaito detecta que la carga real fue muy inferior y propone ajustar los próximos entrenamientos.

---

### 3. Carga semanal demasiado baja

Kaito activará un reajuste al cerrar la semana si la carga realizada queda claramente por debajo de la carga prevista.

#### Activa reajuste si

- El usuario completa menos del 75-80% de la carga semanal prevista.

La carga semanal puede calcularse de forma simple combinando:

- Tiempo total previsto frente a tiempo total realizado.
- Desnivel previsto frente a desnivel realizado.
- Entrenamientos completados frente a entrenamientos planificados.

#### Ejemplo

Semana prevista:

- 7 horas de entrenamiento.

Semana real:

- 4 horas y 30 minutos de entrenamiento.

Kaito reajusta la semana siguiente para continuar desde la carga real, no desde la carga ideal.

---

### 4. Carga semanal demasiado alta

Kaito también debe reajustar cuando el usuario realiza mucha más carga de la prevista.

El sistema no debe actuar únicamente como corrector de entrenamientos fallidos. También debe ayudar a evitar acumulaciones excesivas de fatiga.

#### Activa reajuste si

- El usuario supera el 130% del tiempo semanal previsto.
- El usuario supera el 130% del desnivel semanal previsto.
- El usuario añade demasiada carga extra y además reporta malas sensaciones.

#### Ejemplo

Semana prevista:

- 6 horas de entrenamiento.

Semana real:

- 9 horas de entrenamiento.

Kaito reduce o suaviza alguna sesión próxima para evitar una acumulación excesiva de carga.

---

### 5. Sensaciones malas

Kaito no debe reajustar automáticamente por una mala sensación aislada, porque un día malo puede entrar dentro de la normalidad.

El reajuste se activará cuando las sensaciones indiquen fatiga relevante o pérdida de tolerancia a la carga.

#### Activa reajuste si

- El usuario reporta sensaciones muy malas en un entrenamiento.
- El usuario reporta sensaciones malas en dos entrenamientos consecutivos.
- El usuario reporta malas sensaciones después de una semana con mucha carga.
- El usuario marca un entrenamiento como completado, pero con sensación de fatiga excesiva.

#### No activa reajuste si

- Un entrenamiento sale regular pero se completa razonablemente.
- Hay malas sensaciones aisladas sin molestias ni caída importante de rendimiento.

#### Ejemplo

El usuario completa la sesión, pero marca sensaciones muy malas.

Kaito puede proponer suavizar el siguiente entrenamiento o convertirlo en rodaje fácil.

---

### 6. Molestias o dolor

Esta regla debe ser conservadora.

Kaito no debe diagnosticar lesiones ni ofrecer conclusiones médicas. Solo debe adaptar la carga de forma prudente y recomendar consultar con un profesional si el dolor persiste o aumenta.

#### Activa reajuste si

- El usuario reporta dolor moderado o alto.
- El usuario reporta molestias en dos sesiones consecutivas.
- El usuario reporta molestias y además reduce mucho el entrenamiento.
- El usuario marca el entrenamiento como mal realizado por dolor.

#### Resultado esperado del reajuste

Kaito debería reducir la exigencia de las próximas sesiones y priorizar continuidad suave, descanso o recuperación.

Mensaje orientativo:

> Has reportado molestias. Voy a reducir la carga de las próximas sesiones y priorizar continuidad suave. Si el dolor persiste o aumenta, consulta con un profesional.

#### Ejemplo

El usuario tenía series en subida, pero reporta dolor en la rodilla.

Kaito cambia la siguiente sesión intensa por rodaje suave o descanso.

---

## Regla resumen para el MVP

Kaito activará un reajuste básico del plan cuando se cumpla al menos una de estas condiciones:
- El usuario falla un entrenamiento clave.
- El usuario falla dos entrenamientos en una misma semana.
- El usuario falla dos entrenamientos consecutivos.
- El usuario realiza menos del 70% del tiempo previsto en una sesión relevante.
- El usuario realiza menos del 70% del desnivel previsto en una sesión relevante.
- El usuario completa menos del 75-80% de la carga semanal prevista.
- El usuario supera el 130% de la carga semanal prevista.
- El usuario reporta sensaciones muy malas en una sesión.
- El usuario reporta malas sensaciones en dos sesiones consecutivas.
- El usuario reporta dolor moderado o alto.
- El usuario reporta molestias en dos sesiones consecutivas.

## Cuándo no reajustar

Kaito no activará un reajuste del plan cuando la desviación sea pequeña y no afecte al objetivo de la semana.

No se reajustará el plan si:

- El usuario completa al menos el 80-90% del entrenamiento previsto.
- El usuario falla una sesión secundaria aislada.
- El usuario reporta sensaciones regulares pero sin molestias.
- La carga semanal sigue dentro de un margen razonable.
- El siguiente entrenamiento puede mantenerse sin aumentar el riesgo ni romper la progresión.

## Tipos de reajuste permitidos en el MVP

Para mantener el alcance del MVP controlado, Kaito solo podrá aplicar reajustes básicos.

| Situación detectada | Reajuste básico |
| --- | --- |
| Falla entrenamiento suave | No reajustar, solo actualizar progreso |
| Falla entrenamiento clave | Reorganizar semana o reducir carga |
| Hace mucha menos carga | Bajar exigencia de próximos entrenamientos |
| Hace mucha más carga | Suavizar la siguiente sesión |
| Malas sensaciones | Reducir intensidad próxima |
| Molestias o dolor | Priorizar descanso o rodaje suave |
| Semana muy incompleta | Recalcular la semana siguiente desde la carga real |

## Decisión final

Para el MVP de Kaito, el reajuste del plan se activará únicamente ante desviaciones relevantes.

Una desviación será relevante cuando afecte al cumplimiento de sesiones clave, reduzca o aumente de forma significativa la carga prevista, o cuando el usuario reporte sensaciones muy malas, molestias o dolor.

El objetivo del reajuste no será optimizar deportivamente el plan de forma avanzada, sino mantener una referencia clara, segura y realista para que el usuario pueda continuar entrenando.

## Límite del MVP

El reajuste del plan en el MVP será básico.

No pretende validar decisiones deportivas avanzadas ni sustituir el criterio de un entrenador profesional.

La interacción conversacional avanzada con Kaito para resolver dudas concretas sobre entrenamientos queda fuera del MVP y podrá abordarse como mejora futura.
