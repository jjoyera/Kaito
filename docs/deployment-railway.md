# Desplegar Kaito en Railway con Supabase Cloud

Esta guía despliega exactamente dos servicios públicos desde el mismo monorepo: **Web** (Next.js) y **API** (FastAPI). Supabase Cloud sigue siendo la autoridad externa de Auth y PostgreSQL. Railway no aloja una base de datos para Kaito.

## Orden de despliegue

1. Prepara el proyecto de Supabase y aplica las migraciones.
2. Habilita de forma segura el `LOGIN` de `kaito_api_login` y comprueba sus atributos.
3. Crea el servicio API en Railway, configura sus variables y genera su dominio.
4. Crea el servicio Web, configura sus variables públicas de build y genera su dominio.
5. Vuelve a la API, define `KAITO_WEB_ORIGIN` con el dominio Web y vuelve a desplegarla.
6. Comprueba ambos `/health` y ejecuta el smoke test funcional.

## Prerrequisitos

- Acceso administrativo al proyecto correcto de Supabase Cloud.
- Supabase CLI autenticada y vinculada al proyecto.
- `psql` disponible para el aprovisionamiento interactivo del rol.
- Un proyecto Railway con acceso al repositorio y a la rama que se desplegará.
- Capacidad para guardar secretos en las interfaces de Supabase/Railway; no uses archivos versionados ni pegues secretos en comandos, tickets o logs.

## 1. Aplicar las migraciones de Supabase

Supabase CLI es la única autoridad de migraciones. La API no ejecuta Alembic ni migra al arrancar.

```bash
supabase link --project-ref <SUPABASE_PROJECT_REF>
supabase migration list --linked
supabase db push --linked
supabase migration list --linked
```

Comprueba que el historial remoto incluya todas las migraciones locales antes de continuar. No edites migraciones ya aplicadas ni uses el arranque de Railway para corregir diferencias de esquema.

## 2. Aprovisionar o rotar `kaito_api_login`

La migración crea `kaito_api_login` como `NOLOGIN` a propósito y conserva el límite de mínimo privilegio. La habilitación para producción es un paso operativo posterior.

1. Desde el panel **Connect** de Supabase, obtén una conexión administrativa temporal. Guárdala en un gestor de secretos o proporciónala a `psql` mediante un mecanismo que solicite la contraseña; no la escribas en el repositorio ni en la línea de comandos.
2. Abre una sesión administrativa de `psql`.
3. Ejecuta `\password kaito_api_login`. `psql` solicitará la contraseña nueva sin incluirla en el historial SQL. Genera una contraseña aleatoria y única y guárdala en el gestor de secretos.
4. Después de establecer la contraseña, aplica únicamente los atributos esperados:

```sql
ALTER ROLE kaito_api_login
  LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS
  NOCREATEROLE NOCREATEDB NOREPLICATION;
```

5. Inspecciona el rol con `\du+ kaito_api_login`. Debe poder iniciar sesión, no heredar y no tener privilegios administrativos ni `BYPASSRLS`. La pertenencia a `authenticated` con capacidad de `SET ROLE` creada por las migraciones debe conservarse.

Para rotar la contraseña, coordina una ventana corta: ejecuta de nuevo `\password kaito_api_login`, actualiza inmediatamente `DATABASE_URL` en Railway y vuelve a desplegar la API. No cambies el nombre del rol, no otorgues `SUPERUSER`/`BYPASSRLS` ni uses una clave `service_role` como sustituto.

## 3. Obtener y comprobar `DATABASE_URL`

Usa una conexión **directa** o el **Session pooler** de Supabase. No uses Transaction mode: la API exige que la sesión PostgreSQL conserve la identidad de login para instalar el contexto RLS de cada usuario.

Construye la URL con el host y el puerto indicados por Supabase, el usuario `kaito_api_login`, la base de datos del proyecto y la contraseña guardada. Almacena la URL completa directamente como secreto `DATABASE_URL` de Railway. Si la contraseña contiene caracteres reservados, usa una URL generada/codificada por una herramienta segura en lugar de editarla a mano.

Antes del despliegue, conéctate con esa misma URL mediante un mecanismo que no exponga la contraseña y ejecuta:

```sql
SELECT session_user, current_user, rolsuper, rolbypassrls
FROM pg_catalog.pg_roles
WHERE rolname = session_user;
```

El resultado requerido es `session_user = current_user = kaito_api_login`, con `rolsuper = false` y `rolbypassrls = false`. Esto coincide con `DATABASE_EXPECTED_ROLE=kaito_api_login`; la API falla de forma cerrada si no coincide.

## 4. Crear el servicio API

1. En Railway, crea un servicio desde este repositorio y la rama de despliegue.
2. En **Service settings → Config as Code**, asigna la ruta absoluta `/railway.api.toml`.
3. No importes `compose.yaml` ni añadas un servicio PostgreSQL.
4. Configura las variables de la tabla siguiente desde la interfaz de variables de Railway.
5. Despliega y genera un dominio público HTTPS para la API.
6. Guarda ese origen, por ejemplo `https://<api-domain>`, para configurar la Web. No añadas una barra final a los orígenes.

### Variables de API

Los nombres y valores por defecto se basan en `apps/api/app/core/config.py` y `apps/api/app/observability/sentry.py`.

| Variable | Requisito | Procedencia/valor seguro |
| --- | --- | --- |
| `DATABASE_URL` | Obligatoria, secreta | URL directa o Session mode de Supabase con login `kaito_api_login`. Guardar solo en Railway. |
| `DATABASE_EXPECTED_ROLE` | Obligatoria | Literal `kaito_api_login`; activa el guard de rol existente. |
| `KAITO_WEB_ORIGIN` | Obligatoria después de crear la Web | Origen HTTPS exacto de la Web. Vacía mantiene CORS cerrado. |
| `SUPABASE_JWKS_URL` | Obligatoria | Endpoint JWKS explícito mostrado por Supabase para Signing Keys. |
| `SUPABASE_URL` | Opcional/informativa | URL base HTTPS del proyecto Supabase; no deriva JWKS. |
| `SUPABASE_JWT_AUDIENCE` | Recomendada | Audiencia del proyecto; el valor esperado habitual y predeterminado es `authenticated`. |
| `SUPABASE_JWT_ISSUER` | Recomendada | Emisor exacto comunicado por Supabase, habitualmente `<SUPABASE_URL>/auth/v1`. |
| `SUPABASE_JWKS_CACHE_TTL_SECONDS` | Opcional | Entero positivo; por defecto `600`. |
| `OPENAI_API_KEY` | Obligatoria para generar, secreta | Clave server-side almacenada solo en Railway. |
| `OPENAI_MODEL` | Recomendada | Debe ser exactamente `gpt-5.5-2026-04-23`; otro valor falla de forma cerrada. |
| `OPENAI_TIMEOUT_SECONDS` | Opcional | Número positivo y finito; por defecto `60`. |
| `SENTRY_DSN` | Opcional, sensible | DSN server-side de la API; ausente desactiva Sentry. |
| `SENTRY_ENVIRONMENT` | Opcional | Usa `production` si Sentry está activo. |
| `SENTRY_TRACES_SAMPLE_RATE` | Opcional | Entre `0` y `1`; `0` lo desactiva. |
| `SENTRY_PROFILES_SAMPLE_RATE` | Opcional | Entre `0` y `1`; `0` lo desactiva. |

Railway inyecta `PORT`; no lo fijes. No definas `SUPABASE_LOCAL_JWT_SECRET` ni `ENABLE_DEBUG_SENTRY` en producción. Tampoco copies claves de Supabase server-side a la Web.

## 5. Crear el servicio Web

1. Crea un segundo servicio Railway desde el mismo repositorio y rama.
2. Asigna la ruta absoluta `/railway.web.toml` en **Config as Code**.
3. Configura las variables públicas antes del primer build.
4. Despliega y genera el dominio público HTTPS de la Web.
5. Cada cambio en una variable `NEXT_PUBLIC_*` requiere un nuevo build/deploy: Next.js la incorpora al artefacto durante `next build`.

### Variables Web de build

Los nombres se basan en el consumo actual bajo `apps/web`. Son públicas por definición: no pongas secretos en ninguna variable `NEXT_PUBLIC_*`.

| Variable | Requisito | Procedencia/valor seguro |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Obligatoria | URL pública HTTPS del proyecto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Obligatoria | Publishable key pública de Supabase; nunca `service_role` ni secret key. |
| `NEXT_PUBLIC_KAITO_API_URL` | Obligatoria | Origen HTTPS público de la API Railway, sin barra final. |
| `NEXT_PUBLIC_SENTRY_DSN` | Opcional | DSN público del proyecto Web; vacío desactiva Sentry. |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | Opcional | Por defecto de imagen `production`. |
| `NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Opcional | Entre `0` y `1`; por defecto de imagen `0`. |

El Dockerfile declara estas variables como `ARG` y `ENV` solo en la etapa de build. No declara `SENTRY_AUTH_TOKEN`, credenciales de base de datos, claves OpenAI ni otros secretos como argumentos de build.

## 6. Cerrar CORS y redesplegar

Cuando Railway haya generado el dominio Web:

1. Define `KAITO_WEB_ORIGIN` en el servicio API con el origen HTTPS exacto de la Web.
2. Vuelve a desplegar la API para que el middleware CORS lea el nuevo valor al arrancar.
3. Si ha cambiado el dominio API, actualiza `NEXT_PUBLIC_KAITO_API_URL` en la Web y reconstruye la Web.

## 7. Verificar el despliegue

Los health checks no requieren login ni proveedores externos y deben devolver HTTP 200:

```bash
curl --fail --show-error https://<api-domain>/health
curl --fail --show-error https://<web-domain>/health
```

Ambos deben responder `{"status":"ok"}`. Después, ejecuta el smoke test con una cuenta de prueba creada para el entorno, sin guardar sus credenciales:

- [ ] Registro y confirmación según la política de Supabase Auth.
- [ ] Login y recuperación de sesión.
- [ ] Onboarding completo y persistencia owner-bound.
- [ ] Generación de plan con OpenAI.
- [ ] Lectura del dashboard/plan activo sin datos de otro usuario.
- [ ] Logout y rechazo de rutas privadas sin sesión.

La generación y el dashboard deben probarse solo si esas capacidades están conectadas en la revisión desplegada; documenta explícitamente cualquier paso que aún no esté disponible en el producto.

## Rollback

- **Web/API:** desde Railway, restaura el último deployment sano del servicio afectado. Comprueba de nuevo `/health`.
- **Variables públicas Web:** restaura el valor anterior y ejecuta un nuevo deploy; restaurar solo el runtime no cambia los valores incorporados durante el build.
- **Secretos API:** restáuralos desde el gestor de secretos y vuelve a desplegar. Si has rotado la contraseña PostgreSQL, el rollback debe usar la contraseña vigente, no una URL antigua.
- **Base de datos:** no reviertas migraciones Supabase automáticamente. Las migraciones del proyecto son aditivas; una corrección requiere una nueva migración revisada.

## Solución de problemas

| Síntoma | Verificación segura |
| --- | --- |
| El build Web no recibe configuración | Comprueba que el servicio usa `/railway.web.toml`, que las tres variables públicas obligatorias existen antes del build y que se ha realizado un redeploy completo. |
| La API no llega a estar healthy | Comprueba que `DATABASE_URL` usa direct/Session mode y que la consulta de identidad devuelve `kaito_api_login`; el lifespan falla antes de servir tráfico cuando el guard de base de datos no pasa. |
| Rutas privadas devuelven 503 de auth | Comprueba `SUPABASE_JWKS_URL`; no habilites el adaptador HS256 local. |
| El navegador muestra errores CORS | Compara el origen Web exacto con `KAITO_WEB_ORIGIN`, incluido el esquema y sin path. Vuelve a desplegar la API. |
| Generación devuelve 503 | Comprueba `OPENAI_API_KEY`, el modelo exacto y un timeout válido sin imprimir la clave. |
| Railway consulta el Dockerfile equivocado | Comprueba la ruta absoluta de Config as Code del servicio y que el Root Directory permanece en la raíz del monorepo. |

## Por qué no Railway PostgreSQL ni importación Compose

Supabase PostgreSQL contiene `auth.users`, `auth.uid()`, roles Supabase y políticas RLS que forman parte del modelo de seguridad. Un PostgreSQL de Railway sería otra autoridad incompatible y duplicaría datos, migraciones y credenciales.

`compose.yaml` es una comodidad local con Dockerfiles de desarrollo y puertos fijos. La importación Compose de Railway mapea servicios, pero no ejecuta Docker Compose literalmente ni soporta todas sus funciones. Los archivos `railway.web.toml` y `railway.api.toml` seleccionan de forma explícita imágenes de producción, health checks, watch patterns y políticas de reinicio para cada servicio.
