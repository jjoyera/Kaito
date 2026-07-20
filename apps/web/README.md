# Kaito web

Aplicación Next.js del MVP de Kaito. Esta guía describe la web; el estado operativo canónico, los requisitos y los comandos globales están en el [`README.md` de la raíz](../../README.md).

## Recorrido entregado

| Ruta/capacidad | Comportamiento actual |
| --- | --- |
| `/login`, `/register` | Login y alta con Supabase, validación local, resolución de sesión y feedback seguro. |
| `/onboarding` | Ruta protegida con introducción y wizard persistente de siete pasos. |
| Paso 7 | Consulta elegibilidad, muestra Camino Kaio/Modo Z/Kaioken, exige una elección válida y guarda un único borrador. |
| `/plan/generating` | Lanza automáticamente la generación síncrona, presenta progreso/error, permite reintentar y redirige a `/plan` al completar. |
| `/plan` | Consume el plan activo de la API y muestra dashboard, próxima sesión, métricas planificadas y calendarios. |
| Enrutamiento de producto | Decide entre onboarding y plan según onboarding completado y presencia del plan activo, además de proteger sesión y handoffs canónicos. |

El dashboard ofrece una vista semanal y un calendario completo de sesiones. Todas sus métricas son **planificadas** (kilómetros, sesiones, días restantes y progreso temporal del bloque); no representan entrenamientos completados ni telemetría real.

## Onboarding

1. Objetivo Trail o Ultra Trail: distancia, desnivel positivo y fecha.
2. Línea base reciente.
3. Historial previo.
4. Disponibilidad: días y minutos exactos, con mínimo de tres días y 150 minutos semanales.
5. Preferencias de acceso y planificación.
6. Estado físico, dolor/limitación e impacto condicional.
7. Elegibilidad y selección explícita del enfoque antes de guardar el borrador.

El estado se guarda mediante la API protegida. No hay autosave continuo: cada avance persiste el paso correspondiente y conserva respuestas para reintentar errores.

## Arquitectura y ownership

- `app/` contiene rutas, layouts, estados Next.js y cableado de políticas.
- `features/auth/` posee Supabase y los casos de uso de identidad.
- `features/onboarding/` posee el wizard, contratos, elegibilidad y guardado del borrador.
- `features/planning/` posee generación, lectura del plan y dashboard/calendario.
- `features/product-routing/` resuelve el destino según el estado funcional del usuario.
- `shared/` solo contiene fronteras compartidas por capacidades reales.

Consulta [`../../docs/08-architecture.md`](../../docs/08-architecture.md) para las fronteras completas.

## Configuración

Usa [`apps/web/.env.example`](.env.example) como inventario y crea un archivo local no versionado. Variables principales:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_KAITO_API_URL`

Las variables Sentry son opcionales. La web solo debe recibir configuración pública; nunca expongas claves service-role, tokens, secretos JWT ni `OPENAI_API_KEY`.

## Adaptador de autenticación para tests

Los tests E2E habilitan un adaptador de autenticación controlado mediante variables específicas del runner. Este adaptador:

- solo se permite en entorno de prueba/no producción y exige un secreto efímero coordinado;
- simula estados para Playwright y evita depender de cuentas Supabase reales;
- no crea usuarios públicos ni credenciales reutilizables;
- no es un modo demo de la aplicación.

Por tanto, cadenas de fixtures como `runner@example.com` y `trail-password` no son credenciales válidas.

## Comandos

Desde la raíz:

```bash
pnpm dev:web
pnpm test:web-auth
pnpm test:web-onboarding
pnpm lint:web
pnpm build:web
pnpm test:web-e2e
```

Antes del primer E2E:

```bash
pnpm --filter web exec playwright install chromium
```

Los tests rápidos de auth/onboarding usan dobles locales. `pnpm test:web-e2e` ejecuta Playwright en configuración de desarrollo y producción; tampoco prueba una cuenta Supabase pública ni una llamada real a OpenAI.

## Límites

No están disponibles recuperación de contraseña, magic/social auth, registro de cumplimiento, ajuste/historial de planes, OCR/Backyard en la UI, Strava o RAG. La preparación para producción y los límites de Compose se detallan en el README raíz.