# Documentación de Kaito

Este índice separa el estado operativo entregado de la visión, los requisitos objetivo y las políticas de dominio. Para instalar, ejecutar o comprobar qué funciona hoy, consulta primero el [`README.md` de la raíz](../README.md).

## Mapa de fuentes

| Documento | Fuente de verdad para | Tipo |
| --- | --- | --- |
| [`../README.md`](../README.md) | Estado operativo, stack, instalación, comandos, funcionalidades y limitaciones entregadas | Canónico actual |
| [`00-product-vision.md`](00-product-vision.md) | Problema, usuario y dirección futura del producto | Visión objetivo |
| [`02-user-journeys.md`](02-user-journeys.md) | Recorridos del usuario y separación entre entregado/futuro | Producto |
| [`03-plan-adjustment-policy.md`](03-plan-adjustment-policy.md) | Reglas objetivo para futuros reajustes | Política futura |
| [`04-functional-requirements.md`](04-functional-requirements.md) | Requisitos funcionales y estado de cobertura | Requisitos |
| [`05-data-model.md`](05-data-model.md) | Modelo conceptual y correspondencia con persistencia física actual | Datos |
| [`06-ai-behavior.md`](06-ai-behavior.md) | Responsabilidades, límites y contrato de generación con IA | Política IA |
| [`07-training-knowledge.md`](07-training-knowledge.md) | Base deportiva, guardrails y decisiones de producto | Dominio |
| [`08-architecture.md`](08-architecture.md) | Fronteras técnicas y arquitectura actual/objetivo | Arquitectura |
| [`09-brand-palette.md`](09-brand-palette.md) | Paleta y uso de marca | Diseño |
| [`../apps/web/README.md`](../apps/web/README.md) | Onboarding y operación específica de la web | Guía de aplicación |
| [`../apps/api/README.md`](../apps/api/README.md) | Operación, autenticación, IA y tests de la API | Guía de aplicación |

## Cómo leer el estado

- **Entregado/actual** significa respaldado por el código y las migraciones presentes.
- **Objetivo/futuro** conserva decisiones de producto que todavía no forman parte del MVP entregado.
- Si un documento de visión o política parece contradecir una capacidad operativa, prevalece el [`README.md` raíz](../README.md) para el estado actual.
- Las migraciones de [`supabase/migrations/`](../supabase/migrations/) son la autoridad del esquema físico y RLS; `05-data-model.md` también contiene entidades conceptuales futuras.

Los archivos no se renombran para preservar enlaces, historial y referencias académicas.