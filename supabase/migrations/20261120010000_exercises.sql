-- Step 1 exercise library (ADR 0004, 0005, 0006).

-- The global library: every free-exercise-db exercise (source 'seed', no owner)
-- plus each lifter's custom exercises (source 'custom', owned).
create table public.exercises (
  -- free-exercise-db ID for seeded exercises, 'custom:<slug>' for custom ones (ADR 0006).
  id text primary key,
  name text not null check (length(trim(name)) > 0),
  primary_muscles text[] not null default '{}',
  secondary_muscles text[] not null default '{}',
  equipment text,
  force text check (force in ('push', 'pull', 'static')),
  mechanic text check (mechanic in ('compound', 'isolation')),
  category text,
  level text,
  instructions text[] not null default '{}',
  source text not null default 'custom' check (source in ('seed', 'custom')),
  -- Empty for seeded exercises; the owner for custom ones.
  user_id uuid default auth.uid() references auth.users (id) on delete cascade,
  movement_pattern text check (movement_pattern in (
    'horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull',
    'squat', 'hinge', 'carry', 'core'
  )),
  body_region text check (body_region in ('upper', 'lower')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercises_owner_matches_source check ((source = 'seed') = (user_id is null)),
  constraint exercises_id_matches_source check ((source = 'custom') = (id like 'custom:%')),
  constraint exercises_custom_id_has_slug check (source = 'seed' or id ~ '^custom:[a-z0-9]+(-[a-z0-9]+)*$')
);

comment on table public.exercises is
  'The exercise library: free-exercise-db (source seed, read-only through the API) plus owner-only custom exercises.';
comment on column public.exercises.movement_pattern is
  'Hand-tagged (ADR 0004). Only exercises with both movement_pattern and body_region can be eligible for the coach.';
comment on column public.exercises.body_region is
  'upper or lower: decides how big a load jump progression makes.';

create index exercises_user_id_idx on public.exercises (user_id) where user_id is not null;

alter table public.exercises enable row level security;

-- Any logged-in user reads seeded exercises; a custom exercise is visible only to its owner.
create policy "read seeded or own" on public.exercises
  for select
  to authenticated
  using (user_id is null or user_id = (select auth.uid()));

-- Only custom exercises are ever written through the API, and only by their owner.
create policy "owner writes custom" on public.exercises
  for insert
  to authenticated
  with check (source = 'custom' and user_id = (select auth.uid()));

create policy "owner updates custom" on public.exercises
  for update
  to authenticated
  using (source = 'custom' and user_id = (select auth.uid()))
  with check (source = 'custom' and user_id = (select auth.uid()));

create policy "owner deletes custom" on public.exercises
  for delete
  to authenticated
  using (source = 'custom' and user_id = (select auth.uid()));

create trigger exercises_touch_updated_at
  before update on public.exercises
  for each row execute function public.touch_updated_at();

-- Foreign keys ignore RLS, so on their own they'd let a lifter reference another
-- lifter's custom exercise, and their error would confirm that the ID exists.
-- Every table with an exercise column also gets this before-insert/update
-- trigger: the exercise must be seeded or owned by the row's user_id, and an
-- exercise you can't use gives the same error as one that doesn't exist.
-- Trigger arguments name the exercise columns to check.
--
-- security definer, so it sees every exercise and decides by the row's owner
-- alone, the same for every role (service_role included).
create function public.check_exercise_usable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(new);
  v_column text;
  v_exercise_id text;
begin
  foreach v_column in array tg_argv loop
    v_exercise_id := v_row ->> v_column;
    if v_exercise_id is not null and not exists (
      select 1 from public.exercises e
      where e.id = v_exercise_id
        and (e.user_id is null or e.user_id = new.user_id)
    ) then
      raise exception 'exercise % not found', v_exercise_id
        using errcode = 'foreign_key_violation',
              hint = 'Use a seeded exercise or one of your own custom exercises.';
    end if;
  end loop;
  return new;
end;
$$;

comment on function public.check_exercise_usable() is
  'Trigger: the exercise columns named in the arguments must be seeded exercises or the row owner''s custom ones.';

revoke execute on function public.check_exercise_usable() from public, anon, authenticated;
