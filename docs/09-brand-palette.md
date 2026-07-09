# Kaito - Brand palette

## Propósito del documento

Este documento define la paleta visual inicial de Kaito para que cualquier herramienta de IA, diseñador o generador de interfaces mantenga una identidad coherente al crear logos, pantallas, componentes, landing pages o material visual del producto.

Kaito es una aplicación web con un coach de IA especializado en planes de entrenamiento para corredores de larga distancia, trail, ultra, backyard y OCR. Su identidad visual debe transmitir montaña, claridad, acompañamiento, adaptación y energía contenida.

La estética debe evitar parecer una app fitness genérica, una aplicación médica o un SaaS corporativo azul. Kaito debe sentirse como un entrenador digital cercano, serio y motivador, con una referencia sutil a la aventura/anime, pero sin copiar símbolos, personajes ni estilos protegidos por copyright.

---

## Dirección visual general

La identidad de Kaito se apoya en cuatro ideas principales:

1. **Montaña y naturaleza**  
   La aplicación está orientada a corredores de trail, ultra distancia y pruebas exigentes. La paleta debe recordar a bosque, tierra, senderos, roca y exterior.

2. **Claridad y confianza**  
   Kaito ayuda al corredor a saber qué hacer, por qué hacerlo y cómo adaptar su plan. La interfaz debe ser limpia, legible y calmada.

3. **Energía y progreso**  
   El usuario debe sentir avance, motivación y acompañamiento. Los acentos cálidos sirven para destacar acciones, logros y momentos de progreso.

4. **Anime sutil / aventura**  
   El nombre Kaito nace como referencia personal al universo de entrenamiento y superación de Dragon Ball, pero la marca no debe usar elementos evidentes ni reconocibles de esa franquicia. La referencia debe ser abstracta: energía, camino, órbita, maestro, montaña o progreso.

---

## Paleta principal

| Uso | Nombre | Hex | Sensación |
| --- | --- | --- | --- |
| Fondo principal | Arena cálida | `#F5F0E6` | Natural, limpio, montaña, calma |
| Superficie / cards | Blanco roto | `#FFFDF8` | Claridad, lectura cómoda, ligereza |
| Texto principal | Negro verdoso | `#17211B` | Seriedad, contraste, lectura sin negro puro |
| Texto secundario | Piedra cálida | `#8A8175` | Información secundaria, neutralidad |
| Color primario | Verde bosque | `#2F5D50` | Naturaleza, trail, confianza, guía |
| Primario oscuro | Verde profundo | `#1F3D35` | Profundidad, navegación, hover, énfasis |
| Acento principal | Naranja energía | `#E8893A` | Motivación, acción, energía, progreso |
| Acento suave | Dorado cálido | `#F2C36B` | Recompensa, logro, highlight, calidez |
| Éxito | Verde vivo controlado | `#4F8A5B` | Entrenamiento completado, avance correcto |
| Error / alerta | Rojo tierra | `#B84A3A` | Fallo, molestia, advertencia, desviación |

---

## Tokens CSS recomendados

```css
:root {
  --color-background: #F5F0E6;
  --color-surface: #FFFDF8;

  --color-text-primary: #17211B;
  --color-text-secondary: #8A8175;

  --color-primary: #2F5D50;
  --color-primary-dark: #1F3D35;

  --color-accent: #E8893A;
  --color-accent-soft: #F2C36B;

  --color-success: #4F8A5B;
  --color-warning: #E8893A;
  --color-error: #B84A3A;
}
```

---

## Uso recomendado de cada color

### Fondo principal

Usar `#F5F0E6` como fondo base de la aplicación, especialmente en landing, onboarding y pantallas generales.

Debe transmitir calma y naturaleza. Evita que la interfaz parezca fría o corporativa.

### Superficies y tarjetas

Usar `#FFFDF8` para cards, paneles, formularios, bloques de información, calendario y contenedores del dashboard.

Debe aportar claridad y separación respecto al fondo principal sin recurrir a blanco puro.

### Texto principal

Usar `#17211B` para títulos, textos importantes y contenido principal.

No utilizar negro puro salvo necesidad puntual. Este negro verdoso mantiene un tono más orgánico y coherente con la identidad outdoor.

### Texto secundario

Usar `#8A8175` para subtítulos, metadatos, información auxiliar, placeholders y descripciones breves.

Debe usarse con cuidado para no perder accesibilidad en textos pequeños.

### Color primario

Usar `#2F5D50` para botones principales, elementos activos, navegación principal, iconos clave y estados seleccionados.

Este color representa a Kaito como guía, entrenador y producto conectado con la montaña.

### Primario oscuro

Usar `#1F3D35` para hover de botones, headers, sidebar, estados activos intensos o zonas de mayor peso visual.

Debe aportar profundidad sin oscurecer demasiado la interfaz.

### Acento principal

Usar `#E8893A` para llamadas a la acción secundarias, progreso, elementos motivacionales, marcas visuales, iconos de energía y estados de advertencia leve.

Debe usarse con moderación. No debe dominar la interfaz.

### Acento suave

Usar `#F2C36B` para highlights, logros, badges, pequeños detalles visuales, elementos de gamificación ligera o indicadores positivos.

Funciona como toque cálido y aspiracional.

### Éxito

Usar `#4F8A5B` para entrenamientos completados, validaciones correctas, progreso positivo y estados saludables.

### Error / alerta

Usar `#B84A3A` para entrenamientos fallidos, dolor, molestias, advertencias importantes o desviaciones relevantes del plan.

No debe usarse como color dominante. Su función es llamar la atención de forma prudente.

---

## Reglas de aplicación visual

### Regla principal

Kaito debe sentirse como:

> Un entrenador de montaña digital: claro, cercano, serio, motivador y adaptativo.

No debe sentirse como:

- Una app médica.
- Una app de gimnasio agresiva.
- Un SaaS corporativo azul.
- Una app futurista genérica de inteligencia artificial.
- Una copia visual de Dragon Ball o cualquier franquicia existente.

---

## Proporción recomendada de color

Para mantener equilibrio visual:

- **60%** fondos cálidos y superficies claras: `#F5F0E6`, `#FFFDF8`.
- **25%** verdes principales: `#2F5D50`, `#1F3D35`.
- **10%** texto y neutros: `#17211B`, `#8A8175`.
- **5%** acentos cálidos: `#E8893A`, `#F2C36B`.

El acento naranja/dorado debe aparecer en momentos importantes, no en todos los elementos.

---

## Uso en componentes de interfaz

### Botón principal

```css
.button-primary {
  background: #2F5D50;
  color: #FFFDF8;
}

.button-primary:hover {
  background: #1F3D35;
}
```

Uso recomendado:

- Iniciar onboarding.
- Generar plan.
- Guardar entrenamiento.
- Confirmar reajuste.

### Botón de acento

```css
.button-accent {
  background: #E8893A;
  color: #17211B;
}
```

Uso recomendado:

- Acciones motivacionales.
- Estados de progreso.
- Elementos destacados puntuales.

No usar como botón principal por defecto en toda la aplicación.

### Cards del dashboard

```css
.card {
  background: #FFFDF8;
  color: #17211B;
  border: 1px solid rgba(23, 33, 27, 0.08);
}
```

Las cards deben sentirse limpias, suaves y fáciles de leer.

### Estados de entrenamiento

| Estado | Color recomendado |
| --- | --- |
| Completado | `#4F8A5B` |
| Pendiente | `#8A8175` |
| Próximo entrenamiento | `#2F5D50` |
| Entrenamiento clave | `#E8893A` |
| Fallido | `#B84A3A` |
| Reajuste recomendado | `#F2C36B` o `#E8893A` según gravedad |

---

## Uso en logo

El logo de Kaito debería partir de esta combinación:

- Verde bosque como color principal.
- Naranja/dorado como detalle de energía o progreso.
- Fondo arena o blanco roto.
- Formas simples y reconocibles.

Ideas visuales compatibles:

- Una letra `K` integrada con una montaña.
- Un sendero que forma una órbita o curva de progreso.
- Una montaña con un pequeño halo abstracto.
- Una brújula, camino o guía minimalista.
- Un icono que funcione bien como app icon y favicon.

Evitar:

- Personajes anime reconocibles.
- Kanjis copiados de franquicias.
- Aureolas o símbolos demasiado evidentes.
- Rayos, bolas de energía o elementos que parezcan copia directa.
- Logos excesivamente detallados que no funcionen en pequeño.

---

## Prompt base para IA de diseño

```text
Create a visual identity and logo for "Kaito", an AI running coach app for ultra trail, backyard ultra and OCR athletes.

The brand should feel like a digital mountain coach: clear, warm, serious, motivating and adaptive.

Use an outdoor-inspired color palette with warm sand background, off-white surfaces, deep forest green as the primary color, muted dark green for depth, and subtle orange/golden accents for energy and progress.

Suggested colors:
- Warm sand: #F5F0E6
- Off-white: #FFFDF8
- Deep forest green: #2F5D50
- Dark green: #1F3D35
- Warm orange: #E8893A
- Soft golden: #F2C36B
- Dark green-black text: #17211B

The logo may include a stylized letter K, a mountain trail, an abstract orbit/path, or a subtle sense of energy and progression.

The style should be clean, vector-like, app-icon friendly and suitable for a web dashboard.

Avoid generic blue SaaS aesthetics, medical aesthetics, aggressive gym branding, and any copyrighted references or recognizable anime franchise elements.
```

---

## Prompt corto para generar variantes de logo

```text
Logo for "Kaito", an AI ultra trail running coach app. Minimal vector style. Forest green and warm orange accents. Mountain trail path forming a subtle orbit around a stylized K. Warm outdoor feeling, clean app icon, slight anime adventure energy, no copyrighted references.
```

---

## Prompt para interfaz web

```text
Design a modern web dashboard for Kaito, an AI coach for ultra trail runners. Use a warm outdoor palette: sand background #F5F0E6, off-white cards #FFFDF8, forest green primary #2F5D50, dark green #1F3D35, orange accent #E8893A and soft golden highlight #F2C36B. The interface should feel calm, clear, motivational and focused on training progress. Avoid blue SaaS style and avoid futuristic AI clichés.
```

---

## Decisión final

La paleta visual inicial de Kaito será una combinación de tonos naturales de montaña y acentos cálidos de energía.

El verde bosque será el color principal de identidad. El naranja/dorado será el acento emocional y motivacional. Los fondos arena y blanco roto harán que la aplicación se sienta cercana, clara y cómoda para leer.

Esta paleta queda definida como **Paleta V1 de Kaito** y podrá evolucionar cuando se validen las primeras pantallas reales del producto.
