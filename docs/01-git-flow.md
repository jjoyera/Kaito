# Git Flow y convenciones del repositorio

## Propósito

Este documento define el flujo de trabajo del repositorio de Kaito: cómo nombrar ramas, cómo escribir commits y cómo organizar los cambios de documentación.

El objetivo es mantener un historial del proyecto legible, predecible y fácil de revisar durante el desarrollo del TFM.

## Orden de los documentos

Los documentos utilizan un prefijo numérico para definir un orden claro de lectura.

Ejemplo:

- `00-product-vision.md`: visión del producto y alcance del MVP.
- `01-git-flow.md`: flujo de trabajo del repositorio y convenciones de contribución.
- `02-user-journeys.md`: recorridos principales del usuario dentro del producto.

Esta numeración no representa prioridad de implementación. Representa el orden recomendado para entender el proyecto.

## Rama principal

La rama estable principal es:

```text
main
```

La rama `main` debe contener trabajo revisado y estable.

Se deben evitar commits directos sobre `main`. Los cambios deberían desarrollarse en ramas específicas y fusionarse mediante pull requests siempre que sea posible.

## Naming de ramas

Las ramas deben usar palabras en inglés, en minúsculas y separadas por guiones.

Formato recomendado:

```text
<type>/<short-description>
```

### Tipos de ramas

| Tipo | Uso | Ejemplo |
| --- | --- | --- |
| `docs` | Cambios de documentación | `docs/product-vision` |
| `feature` | Nueva funcionalidad de producto | `feature/onboarding-flow` |
| `fix` | Corrección de errores | `fix/training-status-calculation` |
| `refactor` | Mejoras internas sin cambiar comportamiento | `refactor/training-plan-service` |
| `test` | Cambios únicamente de tests | `test/onboarding-validation` |
| `chore` | Tareas de mantenimiento | `chore/update-dependencies` |

### Reglas para nombrar ramas

- Usar nombres en inglés.
- Usar letras minúsculas.
- Usar guiones en lugar de espacios.
- Mantener nombres cortos pero descriptivos.
- Priorizar la intención de producto o técnica antes que nombres vagos.

Buenos ejemplos:

```text
docs/product-vision
docs/user-journeys
feature/onboarding-flow
feature/training-dashboard
fix/plan-recalculation
```

Evitar:

```text
changes
new-stuff
test1
my-branch
final-version
```

## Mensajes de commit

Los mensajes de commit deben seguir la convención Conventional Commits.

Formato recomendado:

```text
<type>: <short summary>
```

### Tipos de commit

| Tipo | Uso | Ejemplo |
| --- | --- | --- |
| `docs` | Cambios de documentación | `docs: add product vision` |
| `feat` | Nueva funcionalidad | `feat: add onboarding flow` |
| `fix` | Corrección de errores | `fix: correct plan recalculation` |
| `refactor` | Reestructuración de código sin cambiar comportamiento | `refactor: simplify training plan builder` |
| `test` | Tests | `test: add onboarding validation tests` |
| `chore` | Mantenimiento | `chore: update project dependencies` |

### Reglas para mensajes de commit

- Escribir los mensajes de commit en inglés.
- Usar modo imperativo cuando sea posible.
- Mantener el resumen corto y específico.
- No terminar el resumen con punto.
- Cada commit debe representar un cambio coherente.

Buenos ejemplos:

```text
docs: add product vision
docs: add git flow conventions
feat: add onboarding flow
fix: handle failed training sessions
refactor: extract training plan generator
```

Evitar:

```text
update
changes
fix stuff
final commit
more docs
```

## Flujo de documentación

Los cambios de documentación deben usar ramas `docs/<topic>`.

Ejemplos:

```text
docs/product-vision
docs/git-flow
docs/user-journeys
```

Cada documento debe tener un propósito claro y evitar mezclar temas no relacionados.

Por ejemplo:

- La visión del producto pertenece a `00-product-vision.md`.
- El flujo de Git pertenece a `01-git-flow.md`.
- Los user journeys deberían documentarse en un fichero separado.

## Guía para pull requests

Al crear un pull request, la descripción debería explicar:

- Qué cambió.
- Por qué cambió.
- Qué archivos son los más relevantes para revisar.
- Qué queda intencionalmente fuera del alcance.

Para cambios únicamente de documentación, el pull request debería ser pequeño y centrado en un documento o tema concreto.

## Resumen de convenciones actuales

| Área | Convención |
| --- | --- |
| Rama principal | `main` |
| Formato de ramas | `<type>/<short-description>` |
| Idioma de ramas | Inglés |
| Formato de commits | Conventional Commits |
| Idioma de commits | Inglés |
| Orden de documentación | Prefijos numéricos como `00`, `01`, `02` |
