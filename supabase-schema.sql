-- Initial private data model. Apply only after creating your Supabase project.
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null default 'manual' check (source in ('manual','garmin','strava','file')),
  external_id text,
  activity_type text not null,
  title text not null,
  started_at timestamptz not null,
  duration_seconds integer,
  distance_meters numeric,
  elevation_gain_meters numeric,
  average_heart_rate integer,
  max_heart_rate integer,
  average_speed numeric,
  raw_file_path text,
  notes text,
  created_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  performed_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  exercise_name text not null,
  set_number integer not null,
  reps integer,
  weight_kg numeric,
  rest_seconds integer,
  notes text
);

alter table public.activities enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.workout_sets enable row level security;

create policy "Users manage own activities" on public.activities
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage own workout sessions" on public.workout_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users manage sets in own sessions" on public.workout_sets
  for all using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = auth.uid()));
