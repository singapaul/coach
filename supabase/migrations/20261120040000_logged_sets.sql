-- Logged sets: what the lifter actually did (#5).
--
-- The primary key is a UUID the app creates, so logging is safe to retry: the
-- app inserts straight through PostgREST with ON CONFLICT (id) DO NOTHING
-- (supabase-js: upsert(row, { onConflict: 'id', ignoreDuplicates: true })), and
-- resending a row it already sent changes nothing. No Edge Function in the way.

-- Lets a logged set reference a prescribed set together with its session and
-- exercise, so it can't claim to fulfil a set from another session or another
-- exercise.
alter table public.prescribed_sets
  add constraint prescribed_sets_id_session_exercise_user_key unique (id, session_id, exercise_id, user_id);

create table public.logged_sets (
  -- Created by the app, never by the database: that's what makes retries safe.
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null,
  -- Null for an extra set that fulfils no prescribed set.
  prescribed_set_id uuid,
  exercise_id text not null references public.exercises (id),
  performed_at timestamptz not null default now(),
  reps smallint not null check (reps >= 0),
  kg numeric(6, 2) not null check (kg >= 0),
  rpe numeric(3, 1) check (rpe between 1 and 10),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Composite FKs: you can only log against your own sessions and prescribed sets.
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete cascade,
  -- A composite FK with a null column isn't checked, so extra sets pass.
  foreign key (prescribed_set_id, session_id, exercise_id, user_id)
    references public.prescribed_sets (id, session_id, exercise_id, user_id) on delete cascade
);

comment on table public.logged_sets is
  'A set the lifter performed. The app creates the UUID, so resending the same row changes nothing.';
comment on column public.logged_sets.prescribed_set_id is 'The prescribed set this fulfils; null for an extra set.';

create index logged_sets_session_idx on public.logged_sets (session_id, user_id);
create index logged_sets_prescribed_set_idx on public.logged_sets (prescribed_set_id, performed_at);
create index logged_sets_exercise_idx on public.logged_sets (user_id, exercise_id, performed_at);

alter table public.logged_sets enable row level security;
create policy "owner" on public.logged_sets for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create trigger logged_sets_touch_updated_at before update on public.logged_sets
  for each row execute function public.touch_updated_at();

-- today_plan v1: the sets logged against one prescribed set, oldest first.
-- Replaces the empty placeholder from the programming migration.
create or replace function public.today_plan_logged_sets(p_prescribed_set_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ls.id,
        'performed_at', to_char(ls.performed_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
        'reps', ls.reps,
        'kg', ls.kg,
        'rpe', ls.rpe
      )
      order by ls.performed_at, ls.created_at, ls.id
    ),
    '[]'::jsonb
  )
  from public.logged_sets ls
  where ls.prescribed_set_id = p_prescribed_set_id;
$$;
