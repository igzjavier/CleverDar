# CleverDar — Plan maestro de producto y técnico

> Documento fuente para la IA (inteligencia artificial) que implementará la app.
> Léelo completo antes de escribir código. Si algo no está definido aquí, **pregunta al dueño antes de decidir**.

---

## 0. Resumen

**CleverDar** es una PWA (Progressive Web App, web instalable como app) de uso **personal y de un solo usuario** que:

1. Unifica **Google Calendar** e **iCloud Calendar** en una sola agenda.
2. Envía **notificaciones push** al iPhone (antes de cada evento, resumen matutino y semanal).
3. Planifica **bloques de tiempo** para tareas y los reorganiza si algo se corre.
4. Genera **planes de estudio** automáticos a partir de fechas de pruebas.
5. Tiene **modo foco** (temporizador, rachas, horas por ramo).
6. Incluye un **asistente por chat** que modifica la agenda con lenguaje natural.

**Usuario:** estudiante de medicina en Temuco, Chile. iPhone, sin Mac. Zona horaria `America/Santiago`.

**Restricciones duras:**
- **Costo cero.** Solo planes gratuitos.
- **Un solo usuario.** No hay registro público.
- **Idioma de la interfaz:** español de Chile (`es-CL`), semana parte el lunes, formato 24 h.
- **Sábado protegido:** nunca se agenda estudio ni tareas automáticas en sábado (configurable, activado por defecto).

---

## 1. Glosario

| Sigla | Significado |
|---|---|
| PWA | Progressive Web App: web que se instala en la pantalla de inicio y funciona como app |
| SW | Service Worker: script en segundo plano del navegador que recibe las notificaciones push |
| VAPID | Voluntary Application Server Identification: par de claves que identifica al servidor que envía push |
| OAuth | Open Authorization: protocolo para autorizar acceso a Google sin compartir la contraseña |
| CalDAV | Calendaring Extensions to WebDAV: protocolo estándar de calendarios que usa iCloud |
| RLS | Row Level Security: reglas de Postgres que limitan qué filas puede leer cada usuario |
| RRULE | Recurrence Rule: regla de repetición de eventos en formato iCalendar |
| ICS | iCalendar: formato de texto estándar para eventos |
| API | Application Programming Interface: interfaz para que programas se comuniquen |
| UTC | Tiempo Universal Coordinado |
| CI | Continuous Integration: pruebas y despliegue automáticos |
| LLM | Large Language Model: modelo de lenguaje (la IA del asistente) |

---

## 2. Arquitectura

```
┌───────────────────────────┐        ┌──────────────────────────────────────┐
│  iPhone (PWA instalada)   │        │              Supabase                │
│  ─ React + Vite (estático)│◄──────►│  Postgres + RLS                      │
│  ─ Service Worker (push)  │  HTTPS │  Auth (1 usuario)                    │
└────────────▲──────────────┘        │  Edge Functions (Deno)               │
             │ Web Push              │  pg_cron + pg_net (tareas periódicas)│
             └───────────────────────┤  Vault (secretos)                    │
                                     └───────┬───────────────┬──────────────┘
                                             │               │
                                   Google Calendar API   iCloud CalDAV
                                                         (caldav.icloud.com)
```

- **Frontend:** estático, alojado en **GitHub Pages** (`https://<usuario>.github.io/cleverdar/`).
- **Backend:** **Supabase** plan gratuito. Toda la lógica que requiere secretos o tareas programadas vive en Edge Functions.
- **Por qué el navegador no habla directo con iCloud:** CalDAV de iCloud no permite CORS (Cross-Origin Resource Sharing, permiso para que una web llame a otro dominio), y la contraseña de app no debe estar en el cliente. Todo pasa por Edge Functions.
- **Fuente de verdad de los eventos:** Google e iCloud. Supabase guarda una **caché** para mostrar rápido y para programar notificaciones.

### 2.1 Stack (no cambiar sin autorización)

| Capa | Elección | Motivo |
|---|---|---|
| Lenguaje | TypeScript estricto (`strict: true`) | Menos errores |
| Framework UI | React 18 + Vite | Sitio estático simple, ideal para GitHub Pages |
| Estilos | Tailwind CSS | Rápido y consistente |
| Componentes | Radix UI primitives (o shadcn/ui) | Accesibles, sin estilo impuesto |
| Calendario visual | FullCalendar (plugins MIT: `daygrid`, `timegrid`, `list`, `interaction`) | Vistas día/semana/mes y arrastrar y soltar |
| Arrastrar tareas | `@fullcalendar/interaction` `Draggable` + `@dnd-kit` para listas | |
| Estado servidor | TanStack Query | Caché y reintentos |
| Estado local | Zustand | Liviano |
| Fechas | `date-fns` + `date-fns-tz` | Manejo de zona horaria y horario de verano chileno |
| Rutas | React Router con `HashRouter` | GitHub Pages no soporta rutas del lado servidor |
| PWA | `vite-plugin-pwa` con estrategia `injectManifest` | Necesitamos SW propio para push |
| Backend | Supabase (`@supabase/supabase-js`) | Gratis, Postgres, Auth, funciones |
| Funciones | Supabase Edge Functions (Deno) | |
| CalDAV | `tsdav` (vía `npm:` en Deno) + `ical.js` para parsear y expandir RRULE | |
| Web Push servidor | Librería compatible con Deno (ej. `jsr:@negrel/webpush`); **verificar que funcione en Edge Runtime antes de elegir** | `web-push` de Node puede fallar en Deno |
| Pruebas | Vitest (unitarias) + Playwright (humo, opcional) | |
| Lint/format | ESLint + Prettier | |

### 2.2 Límites del plan gratuito (verificar valores vigentes al implementar)

- Supabase gratis **pausa proyectos inactivos** tras un período sin uso. Mitigación: workflow de GitHub Actions que haga un `GET` liviano a una Edge Function `health` cada 3 días.
- Respetar cuotas de invocaciones de Edge Functions: el cron de notificaciones corre cada minuto (~43 000 llamadas/mes); la sincronización cada 5 minutos. Mantener el resto bajo demanda.
- Google Calendar API: cuota gratuita amplia para uso personal; usar sincronización incremental (`syncToken`) para minimizar llamadas.

---

## 3. Seguridad

1. **Solo la clave `anon` de Supabase va al frontend.** Nunca la `service_role`.
2. **RLS activado en todas las tablas**, política `user_id = auth.uid()`.
3. **Desactivar registro público** en Supabase Auth después de crear la cuenta del dueño.
4. Login con **email + contraseña** o **magic link** (enlace por correo).
5. **Secretos en Supabase Secrets / Vault:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:), `ENCRYPTION_KEY`, `LLM_API_KEY`, `CRON_SECRET`.
6. **Cifrar en reposo** el refresh token de Google y la contraseña de app de iCloud (AES-GCM con `ENCRYPTION_KEY`, o Supabase Vault). Nunca devolverlos al cliente.
7. Las funciones llamadas por cron validan el encabezado `Authorization: Bearer <CRON_SECRET>`.
8. Las funciones llamadas por el cliente validan el JWT (JSON Web Token) de Supabase.
9. No registrar (log) tokens, contraseñas ni contenido completo de eventos.

---

## 4. Modelo de datos (Postgres)

Todas las tablas: `id uuid pk default gen_random_uuid()`, `user_id uuid not null references auth.users`, `created_at`, `updated_at`. Todas las fechas en `timestamptz` (UTC). RLS en todas.

```sql
-- Ajustes del usuario (1 fila)
settings (
  user_id pk,
  timezone text default 'America/Santiago',
  week_start int default 1,                -- lunes
  protected_weekdays int[] default '{6}',  -- 6 = sábado (ISO: lunes=1 … domingo=7)
  day_start time default '08:00',          -- inicio de jornada planificable
  day_end time default '22:00',
  default_reminder_minutes int[] default '{10}',
  morning_digest_enabled bool default true,
  morning_digest_time time default '07:00',
  weekly_summary_enabled bool default true,
  weekly_summary_day int default 7,        -- domingo
  weekly_summary_time time default '20:00',
  study_session_minutes int default 50,
  study_break_minutes int default 10,
  max_study_minutes_per_day int default 240,
  buffer_minutes int default 10,           -- margen entre eventos
  theme text default 'dark',
  default_write_calendar_id uuid null
)

-- Cuentas conectadas
calendar_accounts (
  provider text check (provider in ('google','icloud')),
  account_email text,
  credentials_encrypted bytea,   -- refresh token (Google) o usuario+contraseña de app (iCloud)
  status text default 'ok',      -- ok | error | reauth_required
  last_error text,
  last_synced_at timestamptz
)

-- Calendarios de cada cuenta
calendars (
  account_id uuid references calendar_accounts on delete cascade,
  external_id text,              -- id de Google o URL CalDAV
  name text,
  color text,                    -- hex
  is_visible bool default true,
  is_writable bool,
  reminder_minutes int[] null,   -- sobreescribe el default
  notifications_enabled bool default true,
  sync_token text null,          -- Google syncToken o CalDAV sync-token/ctag
  role text default 'normal',    -- normal | cleverdar_study | cleverdar_blocks
  unique (account_id, external_id)
)

-- Caché de eventos (ocurrencias ya expandidas)
events (
  calendar_id uuid references calendars on delete cascade,
  external_id text,              -- id del evento (Google) o UID (iCloud)
  recurrence_id text null,       -- para ocurrencias de eventos repetidos
  etag text null,
  title text,
  description text null,
  location text null,
  start_at timestamptz,
  end_at timestamptz,
  all_day bool default false,
  status text default 'confirmed', -- confirmed | tentative | cancelled
  is_busy bool default true,
  source text default 'external',  -- external | cleverdar
  meta jsonb default '{}',         -- p.ej. {"task_id":..., "exam_id":...}
  unique (calendar_id, external_id, recurrence_id)
)
create index on events (user_id, start_at);

-- Suscripciones push (una por dispositivo)
push_subscriptions (
  endpoint text unique,
  p256dh text,
  auth text,
  device_label text,
  last_success_at timestamptz,
  failure_count int default 0
)

-- Registro de notificaciones enviadas (evita duplicados)
notifications_log (
  kind text,                     -- event_reminder | morning_digest | weekly_summary | study_nudge | block_start
  ref_key text,                  -- p.ej. "<event_id>|<start_at>|<minutes>"
  sent_at timestamptz,
  unique (user_id, kind, ref_key)
)

-- Ramos / asignaturas
subjects (
  name text,
  short_name text,
  color text,
  archived bool default false
)

-- Tareas (fase 2)
tasks (
  title text,
  notes text null,
  subject_id uuid null references subjects,
  estimated_minutes int default 30,
  due_at timestamptz null,
  priority int default 2,        -- 1 alta, 2 media, 3 baja
  status text default 'todo',    -- todo | scheduled | done | dropped
  completed_at timestamptz null
)

-- Bloques de tiempo (fase 2 y 3)
time_blocks (
  task_id uuid null references tasks on delete set null,
  exam_id uuid null references exams on delete cascade,
  subject_id uuid null references subjects,
  title text,
  start_at timestamptz,
  end_at timestamptz,
  kind text,                     -- task | study | review | focus
  flexibility text default 'flexible', -- fixed | flexible
  status text default 'planned', -- planned | done | missed | moved
  event_id uuid null references events on delete set null -- espejo en calendario externo
)

-- Evaluaciones (fase 3)
exams (
  subject_id uuid references subjects,
  title text,                    -- "Prueba U3 Patología"
  kind text,                     -- prueba | examen | control | práctico | entrega
  at timestamptz,
  topics text null,
  estimated_hours numeric default 6,
  difficulty int default 3,      -- 1..5
  status text default 'active'   -- active | done | cancelled
)

-- Sesiones de foco (fase 4)
focus_sessions (
  subject_id uuid null references subjects,
  time_block_id uuid null references time_blocks,
  started_at timestamptz,
  ended_at timestamptz null,
  planned_minutes int,
  actual_minutes int null,
  interrupted bool default false
)

-- Conversación del asistente (fase 5)
assistant_messages (
  role text,                     -- user | assistant | tool
  content text,
  tool_payload jsonb null,
  proposal_status text null      -- pending | applied | rejected
)
```

---

## 5. Edge Functions

Todas en `supabase/functions/<nombre>/index.ts`. Código compartido en `supabase/functions/_shared/`.

| Función | Quién la llama | Qué hace |
|---|---|---|
| `health` | GitHub Actions | Responde `ok`. Evita la pausa por inactividad |
| `google-oauth-start` | Cliente | Devuelve la URL de consentimiento de Google (`access_type=offline`, `prompt=consent`, `state` firmado con el `user_id`) |
| `google-oauth-callback` | Google (redirect) | Canjea el `code`, guarda el refresh token cifrado, lista calendarios, redirige a la app `#/ajustes/cuentas?ok=google` |
| `icloud-connect` | Cliente | Recibe Apple ID + contraseña de app, valida con CalDAV (descubre principal → calendar-home-set → calendarios), guarda cifrado, inserta calendarios |
| `sync` | Cron cada 5 min + botón "Sincronizar" | Para cada calendario visible: trae cambios en la ventana `[-30 días, +180 días]`, expande repetidos, hace upsert en `events`, borra cancelados |
| `events-write` | Cliente | Crear, editar o borrar evento en Google/iCloud y actualizar la caché. Body: `{action, calendar_id, event}` |
| `notify-dispatch` | Cron cada 1 min | Envía recordatorios de eventos y de inicio de bloques que caen en la ventana actual; registra en `notifications_log` |
| `digest` | Cron cada 15 min | Si la hora local coincide con `morning_digest_time` o `weekly_summary_time` y no se ha enviado hoy, envía el resumen |
| `push-test` | Cliente | Envía una notificación de prueba al dispositivo |
| `planner` | Cliente | Genera propuesta de plan de estudio o reorganización (no escribe nada hasta confirmación) |
| `planner-apply` | Cliente | Aplica una propuesta: crea `time_blocks` y los espeja como eventos |
| `assistant` | Cliente | Chat con LLM y herramientas (fase 5) |

### 5.1 Programación (pg_cron + pg_net)

```sql
select cron.schedule('notify-dispatch', '* * * * *', $$
  select net.http_post(
    url := '<SUPABASE_URL>/functions/v1/notify-dispatch',
    headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'))
  );
$$);
select cron.schedule('sync', '*/5 * * * *', $$ ...sync... $$);
select cron.schedule('digest', '*/15 * * * *', $$ ...digest... $$);
```

**Importante:** pg_cron usa UTC. Chile cambia de horario. Por eso `digest` corre cada 15 min y compara contra la **hora local** calculada con `America/Santiago`; nunca fijar horas locales en la expresión cron.

### 5.2 Sincronización Google

- Endpoint `events.list` con `singleEvents=true` (Google expande los repetidos), `timeMin`/`timeMax` de la ventana.
- Primera vez: guardar `nextSyncToken`. Siguientes: usar `syncToken`. Si responde **410 Gone**, borrar caché de ese calendario y resincronizar completo.
- Refrescar access token con el refresh token cuando expire. Si el refresh falla con `invalid_grant`, marcar cuenta `reauth_required` y enviar push "Reconecta Google".

### 5.3 Sincronización iCloud (CalDAV)

- Servidor: `https://caldav.icloud.com`. Autenticación básica con Apple ID + **contraseña específica para apps**.
- Descubrimiento con `tsdav` (`createDAVClient`, `fetchCalendars`).
- Detectar cambios con `ctag`/`sync-token`; si no cambió, no descargar.
- Descargar objetos en la ventana con `calendar-query` + filtro de tiempo. Parsear con `ical.js`, **expandir RRULE** dentro de la ventana, respetar `EXDATE` y ocurrencias modificadas (`RECURRENCE-ID`).
- Eventos con `TZID`: convertir a UTC correctamente.
- Errores 401 → `reauth_required` + push.

### 5.4 Escritura de eventos

- Al crear desde CleverDar, el usuario elige el calendario destino (por defecto `settings.default_write_calendar_id`).
- Google: `events.insert/patch/delete`. iCloud: `PUT` de un `.ics` con UID nuevo (`crypto.randomUUID()`), `If-Match` con etag al editar.
- Para eventos repetidos, la fase 1 solo permite editar o borrar **esta ocurrencia** o **toda la serie**.
- Al crear en la fase 1, se puede crear evento único (sin RRULE). Repetición simple (diaria/semanal) es opcional en fase 1.
- Tras escribir, upsert inmediato en `events` para que la UI se actualice sin esperar el cron.

### 5.5 Calendarios propios de CleverDar

En la fase 2 crear automáticamente en Google (si está conectado; si no, en iCloud):
- **"CleverDar · Estudio"** (`role = cleverdar_study`)
- **"CleverDar · Bloques"** (`role = cleverdar_blocks`)

Así los bloques se ven también en la app de Calendario del iPhone. Nunca modificar automáticamente eventos de otros calendarios.

---

## 6. Notificaciones push

### 6.1 Requisitos en iPhone

- iOS 16.4 o superior.
- La app **debe estar agregada a la pantalla de inicio** desde Safari (Compartir → Agregar a inicio). En Safari normal no hay push.
- El permiso solo se puede pedir **tras un toque del usuario** (botón "Activar notificaciones").
- La app debe detectar si **no** está instalada (`navigator.standalone !== true` y no `display-mode: standalone`) y mostrar una guía con capturas paso a paso.

### 6.2 Flujo

1. Cliente: `Notification.requestPermission()` → `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })`.
2. Guardar en `push_subscriptions` (insert directo con RLS).
3. Servidor envía con VAPID. Si responde **404/410**, borrar la suscripción. Otros errores: `failure_count++`.
4. SW (`src/sw.ts`): evento `push` → `showNotification(title, {body, tag, data:{url}})`; evento `notificationclick` → abrir/enfocar la URL (`#/hoy`, `#/evento/<id>`, etc.).

### 6.3 Tipos

| Tipo | Cuándo | Ejemplo |
|---|---|---|
| Recordatorio de evento | `start_at - minutos` (por calendario o default) | "Patología en 10 min · Sala 304" |
| Inicio de bloque | Al comenzar un `time_block` | "Bloque de estudio: Neuro U3 (50 min)" |
| Resumen matutino | `morning_digest_time` | "Hoy: 4 eventos, 2 bloques de estudio. Primera: 08:30 BCM4" |
| Resumen semanal | Domingo 20:00 | "Semana: 9 h estudio (Patología 3 h…). Racha: 5 días" |
| Alerta de prueba | 7, 3 y 1 día antes de un `exam` | "Prueba de Microbiología en 3 días · 60 % del plan completado" |
| Reconexión | Error de credenciales | "Reconecta tu cuenta de iCloud" |

Reglas:
- **Deduplicar** siempre con `notifications_log`.
- Eventos de día completo: sin recordatorio previo; aparecen en el resumen matutino.
- No enviar recordatorios de eventos `cancelled` ni de calendarios con `notifications_enabled = false`.
- **Horas de silencio** opcionales (por defecto 23:00–07:00) salvo recordatorios de eventos reales.

### 6.4 Ventana de envío de `notify-dispatch`

Cada minuto, buscar ocurrencias donde `start_at - reminder` cae en `[now - 2 min, now + 30 s]`. La tolerancia hacia atrás cubre retrasos del cron; el log impide duplicados.

---

## 7. Diseño e interfaz

### 7.1 Principios

- **Mobile first** (iPhone). Debe verse impecable a 390 px de ancho; usable en escritorio.
- **Oscuro por defecto**, con modo claro. Respetar `safe-area-inset` (muesca e indicador de inicio).
- Estética sobria y "pro": fondo casi negro `#0B0D10`, superficies `#14171C`, bordes sutiles, un color de acento (sugerido: violeta `#7C5CFF`), esquinas 14–16 px, sombras suaves.
- Tipografía: **Inter** o **Plus Jakarta Sans** (Google Fonts), números tabulares para horas.
- Colores de evento = color del calendario o del ramo.
- Animaciones cortas (150–250 ms), respetar `prefers-reduced-motion`.
- Estados vacíos con texto útil, estados de carga con esqueletos (skeletons), errores con acción ("Reintentar", "Reconectar").
- Todo en español de Chile. Fechas: "lun 9 nov", horas "14:30".

### 7.2 Navegación

Barra inferior con 5 pestañas: **Hoy · Agenda · Estudio · Foco · Más**.
Botón flotante "+" (crear evento, tarea o prueba). El asistente (fase 5) se abre desde un botón en "Hoy".

### 7.3 Pantallas

| Ruta | Pantalla | Fase |
|---|---|---|
| `#/login` | Inicio de sesión | 1 |
| `#/bienvenida` | Onboarding: instalar en inicio → activar notificaciones → conectar Google → conectar iCloud | 1 |
| `#/hoy` | Línea de tiempo del día: eventos + bloques, "ahora" marcado, próximo evento destacado, pruebas próximas | 1 (bloques en 2) |
| `#/agenda` | FullCalendar con vistas Día / Semana / Mes / Lista, filtro de calendarios | 1 |
| `#/evento/:id` | Detalle y edición | 1 |
| `#/tareas` | Bandeja de tareas, arrastrar a la agenda | 2 |
| `#/estudio` | Ramos, pruebas, planes y progreso | 3 |
| `#/foco` | Temporizador, racha, estadísticas | 4 |
| `#/asistente` | Chat | 5 |
| `#/ajustes` | Cuentas, calendarios (visibilidad, color, recordatorios), notificaciones, horario, sábado protegido, tema | 1 |

---

## 8. Fases de implementación

Cada fase termina con: código en `main`, despliegue funcionando y **todos los criterios de aceptación cumplidos**. No empezar la siguiente fase sin eso.

### Fase 0 — Esqueleto y despliegue

**Tareas**
1. Crear proyecto Vite + React + TS, Tailwind, ESLint, Prettier, Vitest.
2. Configurar `base: '/cleverdar/'` en Vite y `HashRouter`.
3. `vite-plugin-pwa` con `injectManifest`, `manifest.webmanifest` (nombre "CleverDar", `display: standalone`, `start_url: './#/hoy'`, `scope: './'`, íconos 192/512 y `apple-touch-icon` 180), meta `apple-mobile-web-app-capable`.
4. Workflow de GitHub Actions: en cada push a `main`, `npm ci && npm run build` y desplegar a GitHub Pages.
5. Proyecto Supabase: crear cuenta del dueño, desactivar registro, migración inicial con todas las tablas de la sección 4 y RLS.
6. Layout base con barra inferior y pantallas vacías.
7. Login funcional.
8. Workflow `keepalive` que llame a `health` cada 3 días.

**Aceptación**
- La URL de GitHub Pages carga, se instala en el iPhone y abre a pantalla completa.
- Login funciona; sin sesión redirige a `#/login`.
- Con un segundo usuario de prueba, RLS impide ver datos del primero.

### Fase 1 — Agenda unificada y notificaciones

**Tareas**
1. Onboarding de instalación con detección de modo standalone.
2. Activación de push, guardar suscripción, botón "Enviar prueba".
3. Google OAuth completo (`google-oauth-start`, `google-oauth-callback`), listar calendarios.
4. iCloud: formulario Apple ID + contraseña de app con enlace a instrucciones (`account.apple.com` → Inicio de sesión y seguridad → Contraseñas específicas para apps), función `icloud-connect`.
5. Función `sync` + cron + botón manual + indicador "Sincronizado hace X min".
6. Vista Agenda (Día/Semana/Mes/Lista), colores por calendario, filtro de visibilidad.
7. Vista Hoy.
8. Crear/editar/borrar eventos (`events-write`), con selección de calendario destino.
9. `notify-dispatch` + cron; recordatorios configurables por calendario.
10. `digest` (resumen matutino).
11. Ajustes: cuentas, calendarios, recordatorios, horario de resumen, tema.

**Aceptación**
- Eventos de Google e iCloud aparecen juntos, con hora correcta incluso en el cambio de horario de Chile.
- Un evento creado en el iPhone (app Calendario) aparece en CleverDar en ≤ 6 min.
- Un evento creado en CleverDar aparece en Google/iCloud de inmediato.
- Eventos repetidos se muestran correctamente (incluyendo excepciones).
- Con la app **cerrada**, llega el recordatorio 10 min antes de un evento y el resumen a las 07:00.
- Nunca llega una notificación duplicada.
- Desconectar internet → la app muestra la última caché y un aviso.

### Fase 2 — Tareas y bloques de tiempo

**Tareas**
1. CRUD (crear, leer, actualizar, borrar) de tareas con duración estimada, ramo, prioridad y fecha límite.
2. Bandeja de tareas en panel lateral (escritorio) u hoja inferior (móvil).
3. Arrastrar tarea a la agenda → crea `time_block` + evento espejo en "CleverDar · Bloques".
4. Mover/redimensionar bloques en la agenda.
5. Marcar bloque como hecho / no hecho al terminar (notificación con acción o al abrir la app).
6. **Reorganizar el día** (ver algoritmo 9.2): botón "Reorganizar" y sugerencia automática cuando un bloque queda `missed` o un evento nuevo choca.
7. Botón "Planificar mi día": coloca tareas pendientes en huecos libres de hoy por prioridad y fecha límite.
8. Notificación de inicio de bloque.

**Aceptación**
- Nunca se crea un bloque encima de un evento ocupado ni en día protegido (sábado).
- Reorganizar muestra **una vista previa** de los cambios; nada se aplica sin confirmar.
- Los bloques se ven en la app Calendario del iPhone.

### Fase 3 — Planificador de estudio

**Tareas**
1. CRUD de ramos (precargar: BCM4, Neurociencias, Microbiología Clínica, Fundamentos del Diagnóstico Clínico, Salud Comunitaria I, Patología; editable).
2. CRUD de pruebas (`exams`): ramo, tipo, fecha y hora, temas, horas estimadas, dificultad.
3. Función `planner` (algoritmo 9.1) → propuesta visual (lista + vista semana con bloques fantasma).
4. Usuario puede ajustar horas, quitar sesiones y confirmar → `planner-apply`.
5. Progreso por prueba: sesiones hechas / planificadas, horas acumuladas.
6. Replanificación automática al marcar sesiones como no hechas (propuesta, no aplicación directa).
7. Alertas 7/3/1 días antes con porcentaje de avance.
8. Conflictos entre pruebas cercanas: repartir capacidad diaria entre ellas por urgencia y dificultad.

**Aceptación**
- Para una prueba en 10 días con 8 h estimadas, se propone un plan sin sábados, sin choques y respetando el máximo diario.
- Si no hay tiempo suficiente, la app lo dice con números ("Faltan 2 h; opciones: subir el máximo diario, empezar hoy, reducir horas").
- Pruebas unitarias del algoritmo con casos: semana llena, examen mañana, dos pruebas el mismo día, cambio de horario de verano.

### Fase 4 — Foco y revisión

**Tareas**
1. Temporizador tipo Pomodoro (50/10 por defecto, configurable) asociado a ramo o bloque.
2. El temporizador sigue bien aunque se cierre la app (guardar `started_at` y calcular; push al terminar programado vía `notify-dispatch`).
3. Registrar `focus_sessions`; marcar bloque como hecho al completar.
4. Racha de días con al menos una sesión (sábado no rompe la racha).
5. Estadísticas: horas por ramo (semana/mes), cumplimiento de planes, gráfico simple.
6. Resumen semanal push el domingo 20:00.

**Aceptación**
- Iniciar foco, cerrar la app y volver: el tiempo es correcto y llega push al terminar.
- Estadísticas coinciden con las sesiones registradas.

### Fase 5 — Asistente por chat

**Tareas**
1. Función `assistant` con proveedor LLM de **capa gratuita** que soporte llamadas a herramientas (function calling). Opciones: Google Gemini API o Groq. **Verificar límites vigentes antes de elegir.** Encapsular en una interfaz `LLMProvider` para poder cambiar de proveedor.
2. Herramientas expuestas al LLM (sin acceso directo a la base de datos):
   - `list_events(from, to)`
   - `find_free_slots(from, to, min_minutes)`
   - `propose_create_event(...)`, `propose_move_event(id, new_start)`, `propose_delete_event(id)`
   - `propose_create_task(...)`, `propose_schedule_task(task_id, ...)`
   - `propose_create_exam(...)`, `propose_study_plan(exam_id)`
   - `reorganize_day(date)`
3. **Toda acción que modifique datos devuelve una propuesta** que el usuario confirma con un botón. El LLM nunca aplica cambios directamente.
4. Contexto en el prompt de sistema: fecha y hora actual en `America/Santiago`, ajustes, ramos, pruebas próximas. Mantener corto.
5. Interpretar fechas relativas en español chileno ("mañana", "el jueves", "pasado mañana", "en la tarde" = 14:00–19:00).
6. Historial limitado a los últimos 20 mensajes.
7. Si el LLM no está disponible o agotó la cuota, el chat lo dice y el resto de la app sigue funcionando.

**Aceptación**
- "Mañana tengo patología a las 10, muéveme el estudio" → propuesta correcta de mover bloques de estudio que choquen.
- "Agrega prueba de neuro el 20 de noviembre a las 9, unidad 3" → propuesta de crear `exam` y ofrecer plan.
- Ningún cambio ocurre sin confirmar.

---

## 9. Algoritmos

### 9.1 Plan de estudio (`planner`, función pura y probada)

**Entrada:** prueba (fecha, horas estimadas, dificultad), ajustes, eventos ocupados, bloques existentes, otras pruebas activas, `now`.

**Pasos:**
1. **Horizonte:** desde mañana (o hoy si quedan ≥ 2 h de jornada) hasta el día anterior a la prueba. El día de la prueba solo se permite un repaso corto de 30 min si la prueba es después de las 14:00.
2. **Días disponibles:** excluir `protected_weekdays` (sábado).
3. **Huecos libres por día:** entre `day_start` y `day_end`, restar eventos `is_busy` y bloques existentes, con `buffer_minutes` antes y después. Descartar huecos menores a 30 min.
4. **Capacidad diaria:** `max_study_minutes_per_day` menos el estudio ya planificado ese día para otras pruebas.
5. **Distribución:** horas totales = `estimated_hours × (0.8 + 0.1 × difficulty)`. Repartir con peso creciente hacia la prueba (peso del día `i` = `1 + i / n`), pero reservar los **2 últimos días** para repaso (`kind = review`, sesiones más cortas).
6. **Sesiones:** cortar en bloques de `study_session_minutes` con `study_break_minutes` entre ellos. Preferir el primer hueco de la tarde si existe (configurable).
7. **Espaciado:** no más de 3 sesiones seguidas del mismo ramo sin otro bloque o pausa larga.
8. **Déficit:** si la capacidad total < horas requeridas, devolver `deficit_minutes` y sugerencias.
9. **Salida:** lista de bloques propuestos + resumen (horas, días, déficit). **No escribe nada.**

### 9.2 Reorganizar día (`reorganize_day`)

1. Tomar bloques `flexible` del día desde `now` en adelante que estén `planned` o `missed`.
2. Recalcular huecos libres desde `now` (eventos fijos y bloques `fixed` no se mueven).
3. Ordenar bloques por: fecha límite más cercana → prioridad → orden original.
4. Colocar en orden en los huecos; si no caben, pasar al siguiente día disponible (sin sábado) y marcar como "pasa a mañana".
5. Devolver diff (antes/después). Aplicar solo con confirmación.

---

## 10. Estructura del repositorio

```
cleverdar/
├─ PLAN.md                     ← este documento
├─ README.md                   ← cómo correr y desplegar
├─ .github/workflows/
│   ├─ deploy.yml              ← build + GitHub Pages
│   └─ keepalive.yml           ← ping a /health
├─ public/                     ← íconos, apple-touch-icon
├─ src/
│   ├─ main.tsx, App.tsx, sw.ts
│   ├─ routes/                 ← una carpeta por pantalla
│   ├─ components/             ← UI reutilizable
│   ├─ features/
│   │   ├─ calendar/  tasks/  study/  focus/  assistant/  push/  settings/
│   ├─ lib/
│   │   ├─ supabase.ts
│   │   ├─ time.ts             ← todas las funciones de zona horaria
│   │   └─ planner/            ← algoritmos puros (compartidos con Deno si es posible)
│   └─ styles/
├─ supabase/
│   ├─ migrations/             ← SQL versionado
│   └─ functions/
│       ├─ _shared/            ← cifrado, google, caldav, webpush, auth, planner
│       └─ <función>/index.ts
└─ tests/
```

Variables del frontend (`.env`, públicas): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_VAPID_PUBLIC_KEY`.

---

## 11. Reglas para la IA que programa

1. **Seguir este plan.** Si algo falta o es ambiguo, preguntar al dueño antes de decidir.
2. **No cambiar el stack** ni agregar servicios de pago.
3. **Trabajar por fases y tareas pequeñas.** Un commit por tarea con mensaje claro en español.
4. **Nunca exponer secretos** en el frontend, en commits ni en logs. `.env` en `.gitignore`.
5. **Toda hora se guarda en UTC** y se muestra en `America/Santiago`. Todas las conversiones pasan por `src/lib/time.ts`.
6. **Algoritmos como funciones puras** con pruebas unitarias antes de conectarlos a la UI.
7. **Nada se modifica en calendarios externos sin acción explícita del usuario**, salvo los calendarios propios "CleverDar · …".
8. **Migraciones SQL versionadas**; nunca editar una migración ya aplicada.
9. Antes de cerrar una fase, recorrer sus criterios de aceptación y reportar cuáles se probaron y cómo.
10. Mantener `README.md` actualizado con pasos de configuración (Supabase, Google Cloud, VAPID, iCloud).
11. Código y comentarios pueden estar en inglés; **todo texto visible para el usuario en español de Chile**.

---

## 12. Configuración que hará el dueño (con guía)

1. Crear repositorio `cleverdar` en GitHub y activar Pages (fuente: GitHub Actions).
2. Crear proyecto en Supabase; copiar URL y clave `anon`.
3. Google Cloud Console: crear proyecto, habilitar **Google Calendar API**, pantalla de consentimiento externa **publicada** (sin verificar; aceptar la advertencia al conectar), cliente OAuth web con URI de redirección `https://<proyecto>.supabase.co/functions/v1/google-oauth-callback`.
4. Generar claves VAPID (`npx web-push generate-vapid-keys`) y guardarlas como secretos.
5. Generar contraseña específica para apps en la cuenta de Apple.
6. (Fase 5) Crear clave gratuita del proveedor LLM elegido.

---

## 13. Fuera de alcance (por ahora)

- Varios usuarios, compartir calendarios, invitaciones a otras personas.
- Outlook / Microsoft 365.
- App nativa de App Store.
- Widgets de pantalla de inicio de iOS.
- Sincronización con Recordatorios de Apple.
