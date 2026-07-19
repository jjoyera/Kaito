# Base de conocimiento de entrenamiento (MVP)

Esta base resume el conocimiento operativo que Kaito usa para **generar, explicar y reajustar** planes de entrenamiento en trail, ultra-trail, backyard ultra y OCR. Prioriza decisiones accionables para producto MVP, con trazabilidad de fuentes y niveles de confianza.

## 1) Propósito

- Proveer una referencia de dominio para la IA de Kaito.
- Estandarizar principios mínimos de planificación y seguridad.
- Dar criterios de validación antes de mostrar planes al usuario.

Límites:
- No es un manual deportivo definitivo.
- No sustituye a entrenador/a ni a profesionales sanitarios.
- No habilita diagnóstico ni tratamiento médico.

Nota de trazabilidad: este documento se derivó de síntesis interna de trabajo y de fuentes externas citadas. Los archivos de `.context/` se usan como material interno de síntesis y **no** constituyen fuente formal para el TFM.

## 2) Cómo usa Kaito esta base

Kaito usa este documento como:

1. **Constraints**: límites de seguridad y prudencia (sin “catch-up” agresivo, sin invención de datos).
2. **Contexto**: principios comunes y diferencias por modalidad.
3. **Templates**: tipos de sesiones y progresiones que sirven como esqueletos de plan.
4. **Guardrails**: reglas para generación y validación previa a la entrega al usuario.

Objetivo práctico: evitar el patrón “prompt genérico al LLM” y forzar generación guiada por reglas de dominio.

## 3) Modelo de confianza de fuentes

| Nivel | Qué incluye | Cómo se usa en Kaito |
|---|---|---|
| **Alta** | Estudios revisados por pares, metaanálisis, consensos de expertos, reglamentos oficiales | Base normativa para reglas globales y límites de seguridad |
| **Media** | Coaches/libros/metodologías reconocidas (p. ej., Koop/CTS, Roche/SWAP, Uphill Athlete, Friel) | Plantillas de planificación y heurísticas de diseño de sesión |
| **Emergente** | Planes comerciales de marcas, fuentes de practicantes/comunidad, áreas con evidencia escasa (especialmente BYU/OCR) | Uso ilustrativo y contextual, siempre con disclaimer de menor robustez |

Regla de uso: cuando haya conflicto, priorizar **Alta > Media > Emergente**.

## 4) Principios comunes entre disciplinas

1. **Periodización**: base → específico → simulación → taper → carrera. [1][2][3]
2. **Predominio de baja intensidad**: la mayoría del volumen debe ser fácil/controlado (patrones cercanos a 80/20). [1][4]
3. **Control de carga**: combinar carga externa e interna (incluyendo sRPE = RPE × minutos). [5][6]
4. **Fuerza**: componente obligatorio, con bloque suficiente para adaptación (especialmente resistencia, economía y prevención). [7][8]
5. **Tapering**: reducción de volumen manteniendo señal de intensidad, típicamente en torno a 2 semanas (ajustable por contexto). [3][9]
6. **Recuperación y seguridad**: dolor/fatiga/sueño condicionan ajustes conservadores. [10][11]

## 5) Guía específica por modalidad

### 5.1 Trail running

Foco: economía en terreno, desnivel, técnica de subida/bajada, fuerza excéntrica y estabilidad.

Aplicación en Kaito:
- incluir sesiones de cuestas y técnica de bajada de forma progresiva;
- no sobrecargar intensidad cuando el terreno ya aporta estrés alto;
- priorizar continuidad por encima de “picos” aislados. [12][13][14]

### 5.2 Ultra-trail

Foco: tiempo en pies, nutrición entrenada, fatiga acumulada y especificidad de carrera.

Aplicación en Kaito:
- usar tiradas largas y back-to-back de forma selectiva;
- integrar entrenamiento nutricional en sesiones largas;
- gestionar volumen con progresión prudente y taper específico. [13][15][16]

### 5.3 Backyard Ultra

**Corrección de dominio**: en Kaito, “Backyard” significa **Backyard Ultra**.

Regla formal:
- bucle fijo de **6,7056 km** por hora (4 millas + 880 pies), salida cada hora;
- no hay distancia final objetivo fija;
- el objetivo se modela por **vueltas/horas/ritmo por vuelta/margen de descanso/estrategia de box**. [17]

Aplicación en Kaito:
- no pedir solo distancia objetivo;
- planificar simulaciones horarias (run + transición);
- incluir estrategia nocturna y gestión de sueño para objetivos largos. [18][19]

Estos datos se reflejan en `TrainingGoal` según el modelo definido en [`05-data-model.md`](./05-data-model.md).

### 5.4 OCR

Foco: combinación de carrera + obstáculos + fuerza funcional/agarre + transiciones.

Aplicación en Kaito:
- entrenar agarre/carries y técnica de obstáculos;
- usar sesiones “brick” (correr + estación/obstáculo);
- tratar planes de marca como referencia útil pero no evidencia definitiva. [20][21]

## 6) Taxonomía de sesiones de entrenamiento

| Tipo de sesión | Objetivo principal | Modalidades típicas |
|---|---|---|
| Easy run / rodaje fácil | Base aeróbica y recuperación activa | Todas |
| Long run / tirada larga | Durabilidad y tiempo en pies | Trail, Ultra, Backyard |
| Elevation / hills | Fuerza específica de subida y economía | Trail, Ultra |
| Downhill / excéntrico | Tolerancia muscular en bajada | Trail, Ultra |
| Back-to-back | Fatiga acumulada controlada | Ultra, Backyard |
| Intervals / tempo | Potencia aeróbica y umbral | Todas (dosificar en Ultra/Backyard) |
| Strength | Resiliencia musculoesquelética y prevención | Todas |
| Recovery session | Asimilación de carga | Todas |
| Backyard loop simulation | Ritmo por bucle + transición + descanso | Backyard |
| OCR brick / obstáculos / grip / carries | Transferencia específica de carrera OCR | OCR |

### 6.1 Base determinista entregada para generación (#82)

La base implementada prepara y valida el contexto de una futura generación, pero **no** invoca IA ni persiste planes/sesiones generados. El issue #24 permanece abierto para proveedor, prompt, orquestación, reintentos y entrega completa.

#### Contrato neutral de bloque

| Regla | Contrato |
|---|---|
| Horizonte | Entre 1 y 4 semanas, limitado por la ventana autorizada y la fecha objetivo. |
| Categorías | `run`, `strength`, `recovery`, `cross_training`. |
| Intensidad | Las sesiones `run` exigen segmentos temporizados `low`, `threshold` o `high`; su suma coincide con la duración. Las demás categorías no incluyen segmentos. |
| Esfuerzo | Rango RPE objetivo entero 1–10, con mínimo menor o igual que máximo. |
| Autoridad | El enfoque se contrasta con el autorizado por backend. Readiness, elegibilidad y proyección no son valores generados por IA. |
| Distancia | La suma exacta de kilómetros de las sesiones `run` coincide con la proyección de cada semana. |
| Fechas | Cada sesión cae en la ventana de siete días de su semana y nunca después del objetivo. |

#### Demanda del objetivo

Para Trail y Ultra, Kaito normaliza la demanda con la convención de estilo ITRA:

```text
km-effort = distancia_km + (D+_m / 100)
```

El resultado se redondea a centésimas. La conversión de km-effort a mínimos de minutos semanales pico y semanas pico es una **política explícita**, no una garantía científica universal:

| Km-effort | Minutos semanales pico | Semanas pico | Base declarada |
|---:|---:|---:|---|
| Hasta 25 | 240 | 2 | Suelo de producto |
| 50 | 360 | 3 | Ancla experta |
| 100 o más | 540 | 6 | Ancla experta |
| Entre hitos | Interpolación lineal, redondeada hacia arriba | Interpolación lineal, redondeada hacia arriba | Política de producto |

Las semanas pico contabilizadas son semanas de carga que alcanzan ese mínimo; recuperación y taper se preservan fuera de ese recuento.

#### Calendario y capacidad inicial

- El calendario previo al taper sigue una secuencia 3+1: tres huecos de carga y uno de recuperación.
- Las dos últimas semanas se reservan para taper; si el horizonte es menor, se preserva el taper disponible.
- Las semanas pico ocupan los últimos huecos de carga aptos. Recuperación y taper nunca se convierten para forzar el objetivo.
- Si faltan huecos pico, se informa el déficit temporal exacto (`missing_peak_loading_weeks`).

La evaluación inicial compara promedio semanal reciente, disponibilidad, demanda y calendario. Devuelve estados y motivos estables:

| Estado | Significado |
|---|---|
| `on_track` | No detecta brecha ni restricción entre las señales consideradas. |
| `constrained` | Hay brecha de carga, constancia irregular o restricciones actuales que limitan carga/intensidad. |
| `not_feasible` | Faltan semanas pico, disponibilidad mínima, semanas de construcción, o existe un bloqueo de aumento para todo el horizonte. |

Los motivos se exponen con códigos estables y acumulables:

- `not_feasible`: `calendar_missing_required_peak_loading_weeks`, `weekly_availability_below_minimum_peak_minutes`, `current_load_below_target_with_no_build_weeks`, `load_increase_blocked_for_horizon`.
- `constrained`: `current_load_below_target`, `irregular_recent_consistency`, `current_safety_restrictions_limit_load_or_intensity`.
- `on_track`: sin códigos de motivo.

La brecha y los minutos adicionales por semana de construcción son información de capacidad inicial. **No prueban que esa progresión sea segura**: la trayectoria sesión a sesión, ACWR y el control conjunto de distancia/desnivel quedan fuera de esta base.

### 6.2 Frontera de evidencia y política

| Tipo de decisión | Ejemplos | Cómo debe presentarse |
|---|---|---|
| Señal o restricción respaldada por ciencia | Predominio de baja intensidad, taper, sRPE, prudencia ante dolor/fatiga | Como principio o límite, con fuente y sin extrapolar más allá de la evidencia. |
| Guía experta | Anclas de 50/100 km-effort, plantillas de modalidad, semanas pico | Como heurística experta explícitamente etiquetada. |
| Política de producto | Suelo hasta 25 km-effort, interpolación, categorías y validación exacta del contrato | Como decisión determinista de Kaito, revisable y sin garantía científica universal. |

Esta separación evita presentar una decisión de producto como evidencia científica o una señal científica como garantía individual de seguridad.

## 7) Guardrails para generación de planes

Kaito **debe**:
- respetar disponibilidad real y contexto del corredor;
- respetar elegibilidad y límites de `TrainingPlan.planApproach`;
- aplicar ajustes conservadores ante dolor, fatiga alta o mal sueño;
- generar outputs estructurados y trazables.

Kaito **no debe**:
- aceptar readiness, elegibilidad o proyecciones calculadas por un proveedor IA;
- presentar la evaluación inicial de capacidad como prueba de progresión segura;
- hacer catch-up agresivo de carga perdida;
- inventar datos faltantes;
- tratar Backyard como ultra de distancia fija;
- igualar semanas entre modalidades sin especificidad. [17][18]

## 8) Guardrails para validación antes de mostrar el plan

Checklist mínimo de validación:

1. **Consistencia modal**: sesiones acordes a la modalidad elegida.
2. **Seguridad básica**: sin incrementos bruscos ni compensaciones agresivas.
3. **Alineación con planApproach**: exigencia compatible con `kaio_path`, `mode_z` o `kaioken`.
4. **Datos trazables**: no hay campos inventados ni supuestos ocultos.
5. **Estructura MVP**: sesiones con propósito, intensidad e instrucciones accionables.
6. **Backyard/OCR específicos**: Backyard por vueltas/horas; OCR con componente de obstáculos/agarre.
7. **Carga semanal actual (MVP)**: usar sRPE con `sessionLoad = actualDurationMin × rpe` y `weeklyLoad` como suma semanal de `sessionLoad`; mantener `feeling` como señal cualitativa complementaria.
8. **Envolvente y fechas del bloque**: igualdad exacta de kilómetros de carrera por semana, sesiones dentro de su ventana y ninguna posterior al objetivo.
9. **Autoridad de readiness**: la salida generada no contiene valores de readiness calculados por el proveedor.

Si falla cualquier punto, el bloque debe rechazarse. La regeneración automática forma parte de la futura integración IA del issue #24 y no está implementada en esta base.

## 9) Fuentes consultadas (resumen para uso en Kaito)

| Fuente | Tipo | Enlace / DOI / ID | Uso en Kaito | Confianza |
|---|---|---|---|---|
| Seiler & Kjerland (2006), *Scand J Med Sci Sports* | Peer-reviewed | PubMed: [16430681](https://pubmed.ncbi.nlm.nih.gov/16430681/) | Regla de distribución de intensidad (base polarizada) | Alta |
| Stöggl & Sperlich (2014), *Front Physiol* | Peer-reviewed | Fuente nominal (sin URL/DOI explícito en síntesis) | Comparación de modelos de entrenamiento | Alta |
| Bosquet et al. (2007), *Med Sci Sports Exerc* | Meta-análisis | Soporte complementario: [PMC10171681](https://pmc.ncbi.nlm.nih.gov/articles/PMC10171681/) | Diseño de tapering (volumen ↓, intensidad mantenida) | Alta |
| Eihara et al. (2022), *Sports Medicine Open* 8:138 | Meta-análisis | Fuente nominal (sin URL/DOI explícito en síntesis) | Rol de fuerza pesada/pliometría en economía | Alta |
| Foster et al. (2001); Haddad et al. (2017) sRPE | Peer-reviewed | PubMed: [11708692](https://pubmed.ncbi.nlm.nih.gov/11708692/), [29163016](https://pubmed.ncbi.nlm.nih.gov/29163016/) | Monitorización de carga interna (sRPE) | Alta |
| Jason Koop / CTS (*Training Essentials for Ultrarunning*) | Coach/metodología reconocida | Fuente nominal (sin URL formal específica en síntesis) | Estructura de ultra-trail y periodización inversa | Media |
| David Roche / SWAP (planes 50K y afines) | Coach/metodología reconocida | Fuente nominal (sin URL formal específica en síntesis) | Plantillas de trail y progresiones | Media |
| Uphill Athlete (trail/UTMB/fuerza) | Metodología reconocida | [Trail running](https://uphillathlete.com/trail-running/training-for-trail-running/), [Strength](https://uphillathlete.com/strength-training/strength-training-for-the-mountain-athlete/), [UTMB tips](https://uphillathlete.com/trail-running/utmb-five-training-tips/) | Especificidad montaña, fuerza y bloques | Media |
| Big’s Backyard Ultra Rules | Reglamento oficial | [bigsbackyardultra.com/backyard-ultra-rules](https://bigsbackyardultra.com/backyard-ultra-rules/) | Definición formal BYU (6,7056 km/hora y formato) | Alta |
| De Pauw et al. (2024), *Eur J Sport Sci* | Peer-reviewed (N pequeño) | DOI: [10.1002/ejsc.12190](https://doi.org/10.1002/ejsc.12190) | Evidencia fisiológica específica BYU | Alta (emergente por tamaño de evidencia) |
| Benchetrit et al. (2024), *PLOS One* | Peer-reviewed (N pequeño) | DOI: [10.1371/journal.pone.0299475](https://doi.org/10.1371/journal.pone.0299475) | Cognición/sueño en BYU | Alta (emergente por tamaño de evidencia) |
| Baghurst et al. (2019), *IJERPH* case study | Peer-reviewed (n=1) | Fuente nominal (sin URL/DOI explícito en síntesis) | Referencia fisiológica OCR (limitada) | Emergente |
| Planes Spartan / Hyrox / TrainingPeaks / Vert.run | Comercial/practicantes | Fuente nominal (sin URL formal consolidada en síntesis) | Ejemplos de estructura y sesiones específicas | Emergente |

## 10) Referencias a documentación existente

- [`06-ai-behavior.md`](./06-ai-behavior.md): define comportamiento IA; este documento aporta base de dominio y validación.
- [`03-plan-adjustment-policy.md`](./03-plan-adjustment-policy.md): política normativa de reajuste.
- [`05-data-model.md`](./05-data-model.md): entidades y límites de datos trazables.

---

## Referencias (identificadores de trazabilidad)

[1] Seiler & Kjerland (2006), *Scand J Med Sci Sports*. PubMed: https://pubmed.ncbi.nlm.nih.gov/16430681/  
[2] Friel, *The Cyclist's Training Bible* / *The Triathlete's Training Bible*.  
[3] Bosquet et al. (2007), *Med Sci Sports Exerc*. Soporte complementario de tapering: https://pmc.ncbi.nlm.nih.gov/articles/PMC10171681/  
[4] Stöggl & Sperlich (2014), *Front Physiol*.  
[5] Foster et al. (2001), PubMed 11708692: https://pubmed.ncbi.nlm.nih.gov/11708692/  
[6] Haddad et al. (2017), PubMed 29163016: https://pubmed.ncbi.nlm.nih.gov/29163016/  
[7] Eihara et al. (2022), *Sports Med Open* 8:138.  
[8] Uphill Athlete (fuerza para atleta de montaña): https://uphillathlete.com/strength-training/strength-training-for-the-mountain-athlete/  
[9] Revisión 2023 de tapering (PMC10171681): https://pmc.ncbi.nlm.nih.gov/articles/PMC10171681/  
[10] Walsh et al. (2021), consenso sueño y atleta (BJSM): https://www.sportgeneeskunde.com/wp-content/uploads/Br-J-Sports-Med-2021-Walsh-consensus-statement-sleep-and-the-athlete.pdf  
[11] Benchetrit et al. (2024), *PLOS One* BYU sueño/cognición. DOI: https://doi.org/10.1371/journal.pone.0299475  
[12] World Athletics (Trail Running / Mountain and Trail): https://worldathletics.org/disciplines/trail-running/trail-running ; https://worldathletics.org/hosting/other-events/mountain-and-trail  
[13] Koop/CTS + Uphill Athlete (ultra-trail).  
[14] Roche/SWAP (plantillas trail).  
[15] Koop (periodización inversa y doctrina de tirada larga).  
[16] Uphill Athlete UTMB (bloques, desnivel, taper): https://uphillathlete.com/trail-running/utmb-five-training-tips/  
[17] Big’s Backyard Ultra Rules (bucle 6,7056 km cada hora): https://bigsbackyardultra.com/backyard-ultra-rules/  
[18] De Pauw et al. (2024), *European Journal of Sport Science*. DOI: https://doi.org/10.1002/ejsc.12190  
[19] Benchetrit et al. (2024), *PLOS One*. DOI: https://doi.org/10.1371/journal.pone.0299475  
[20] Planes Spartan/Hyrox (fuente comercial).  
[21] Baghurst et al. (2019), *IJERPH* case study OCR.
