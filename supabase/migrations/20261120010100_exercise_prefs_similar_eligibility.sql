-- Step 1 exercise library: preferences, similar-exercise links and the single
-- definition of which exercises the coach may use (ADR 0004, 0005).

-- One row per (lifter, exercise). No row means: available, not a favourite, not avoided.
create table public.user_exercise_prefs (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id text not null references public.exercises (id) on delete cascade,
  available boolean not null default true,
  favourite boolean not null default false,
  avoid boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, exercise_id)
);

comment on table public.user_exercise_prefs is
  'A lifter''s preferences for an exercise. available = false or avoid = true makes it ineligible for the coach.';

create index user_exercise_prefs_exercise_id_idx on public.user_exercise_prefs (exercise_id);

alter table public.user_exercise_prefs enable row level security;

create policy "owner" on public.user_exercise_prefs
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create trigger user_exercise_prefs_touch_updated_at
  before update on public.user_exercise_prefs
  for each row execute function public.touch_updated_at();

-- How much progress on one exercise carries over to another. Empty until Step 7.
create table public.exercise_similar (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id text not null references public.exercises (id) on delete cascade,
  similar_exercise_id text not null references public.exercises (id) on delete cascade,
  carryover_factor numeric(3, 2) not null check (carryover_factor > 0 and carryover_factor <= 1),
  created_at timestamptz not null default now(),
  primary key (user_id, exercise_id, similar_exercise_id),
  check (exercise_id <> similar_exercise_id)
);

comment on table public.exercise_similar is
  'Similar-exercise links with a carryover factor (0-1]. Created in Step 1, filled in by Step 7.';

create index exercise_similar_similar_exercise_id_idx on public.exercise_similar (similar_exercise_id);

alter table public.exercise_similar enable row level security;

create policy "owner" on public.exercise_similar
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- THE definition of "eligible for the coach" (ADR 0004). Reuse it; don't restate it.
-- An exercise is eligible when it has both a movement pattern and a body region,
-- and the lifter hasn't marked it unavailable or avoid.
--
-- security invoker: RLS still applies, so a caller only ever sees seeded
-- exercises and their own custom ones, and only their own preferences.
-- Called over RPC as the signed-in lifter it uses auth.uid(); server code running
-- as service_role passes the lifter's ID explicitly.
create function public.coach_eligible_exercises(p_user_id uuid default auth.uid())
returns setof public.exercises
language sql
stable
security invoker
set search_path = ''
as $$
  select e.*
  from public.exercises e
  left join public.user_exercise_prefs p
    on p.exercise_id = e.id
   and p.user_id = p_user_id
  where e.movement_pattern is not null
    and e.body_region is not null
    and (e.user_id is null or e.user_id = p_user_id)
    and coalesce(p.available, true)
    and not coalesce(p.avoid, false);
$$;

comment on function public.coach_eligible_exercises(uuid) is
  'Exercises the coach may prescribe for a lifter: both tags set, not marked unavailable or avoid (ADR 0004).';

revoke execute on function public.coach_eligible_exercises(uuid) from public, anon;
grant execute on function public.coach_eligible_exercises(uuid) to authenticated, service_role;
