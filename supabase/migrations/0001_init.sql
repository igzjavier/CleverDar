-- CleverDar · migración inicial (Fase 0)
-- Todas las tablas: user_id = auth.uid(), RLS activado, fechas en timestamptz (UTC).

create extension if not exists pgcrypto;

create table if not exists public.settings (
  user_id uuid primary key references auth.users on delete cascade,
  timezone text not null default 'America/Santiago',
  week_start int not null default 1,
  protected_weekdays int[] not null default '{6}',
  day_start time not null default '08:00',
  day_end time not null default '22:00',
  default_reminder_minutes int[] not null default '{10}',
  morning_digest_enabled boolean not null default true,
  morning_digest_time time not null default '07:00',
  weekly_summary_enabled boolean not null default true,
  weekly_summary_day int not null default 7,
  weekly_summary_time time not null default '20:00',
  study_session_minutes int not null default 50,
  study_break_minutes int not null default 10,
  max_study_minutes_per_day int not null default 240,
  buffer_minutes int not null default 10,
  theme text not null default 'dark',
  default_write_calendar_id uuid null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendar_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  provider text not null check (provider in ('google', 'icloud')),
  account_email text,
  credentials_encrypted bytea,
  status text not null default 'ok',
  last_error text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  account_id uuid not null references public.calendar_accounts on delete cascade,
  external_id text not null,
  name text not null,
  color text,
  is_visible boolean not null default true,
  is_writable boolean not null default false,
  reminder_minutes int[] null,
  notifications_enabled boolean not null default true,
  sync_token text null,
  role text not null default 'normal' check (role in ('normal', 'cleverdar_study', 'cleverdar_blocks')),
  created_at timestamptz not null default now(),
  unique (account_id, external_id)
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  calendar_id uuid not null references public.calendars on delete cascade,
  external_id text not null,
  recurrence_id text not null default '',
  etag text null,
  title text,
  description text null,
  location text null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  all_day boolean not null default false,
  status text not null default 'confirmed' check (status in ('confirmed', 'tentative', 'cancelled')),
  is_busy boolean not null default true,
  source text not null default 'external',
  meta jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (calendar_id, external_id, recurrence_id)
);
create index if not exists events_user_start_idx on public.events (user_id, start_at);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_label text,
  last_success_at timestamptz,
  failure_count int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications_log (
  user_id uuid not null references auth.users on delete cascade,
  kind text not null,
  ref_key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, kind, ref_key)
);

create table if not exists public.subjects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  short_name text,
  color text,
  archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  notes text null,
  subject_id uuid null references public.subjects on delete set null,
  estimated_minutes int not null default 30,
  due_at timestamptz null,
  priority int not null default 2 check (priority between 1 and 3),
  status text not null default 'todo' check (status in ('todo', 'scheduled', 'done', 'dropped')),
  completed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  subject_id uuid references public.subjects on delete cascade,
  title text not null,
  kind text not null default 'prueba',
  at timestamptz not null,
  topics text null,
  estimated_hours numeric not null default 6,
  difficulty int not null default 3 check (difficulty between 1 and 5),
  status text not null default 'active' check (status in ('active', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.time_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  task_id uuid null references public.tasks on delete set null,
  exam_id uuid null references public.exams on delete cascade,
  subject_id uuid null references public.subjects on delete set null,
  title text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  kind text not null default 'task',
  flexibility text not null default 'flexible' check (flexibility in ('fixed', 'flexible')),
  status text not null default 'planned' check (status in ('planned', 'done', 'missed', 'moved')),
  event_id uuid null references public.events on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  subject_id uuid null references public.subjects on delete set null,
  time_block_id uuid null references public.time_blocks on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz null,
  planned_minutes int not null,
  actual_minutes int null,
  interrupted boolean not null default false
);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  role text not null check (role in ('user', 'assistant', 'tool')),
  content text not null,
  tool_payload jsonb null,
  proposal_status text null check (proposal_status in ('pending', 'applied', 'rejected')),
  created_at timestamptz not null default now()
);

-- RLS: cada usuario solo ve y escribe sus filas.
do $$
declare t text;
begin
  foreach t in array array[
    'settings','calendar_accounts','calendars','events','push_subscriptions',
    'notifications_log','subjects','tasks','exams','time_blocks',
    'focus_sessions','assistant_messages'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "owner_all" on public.%I', t);
    execute format(
      'create policy "owner_all" on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t
    );
  end loop;
end $$;

-- Nota: notifications_log y las funciones de servidor escriben con service_role,
-- que ignora RLS. El cliente nunca debe leer ni escribir notifications_log.
