-- Step 1 programming: day templates, blocks, sessions and prescribed sets (ADR 0002, 0005).
--
-- Every owned table carries user_id with the one "owner" policy (ADR 0005).
-- Child tables reference their parent by (id, user_id), so a row can only ever
-- hang off a parent with the same owner, even though foreign-key checks
-- themselves ignore RLS.

-- ---------------------------------------------------------------------------
-- Time: training weeks run Monday to Sunday in the lifter's time zone.
-- ---------------------------------------------------------------------------

-- The Monday that starts the training week containing `d`.
create function public.training_week_start(d date)
returns date
language sql
immutable
set search_path = ''
as $$
  select d - (extract(isodow from d)::int - 1);
$$;

comment on function public.training_week_start(date) is
  'Monday of the training week (Monday to Sunday) containing the given local date.';

-- The lifter's calendar date at instant `p_at`, in their profile time zone.
create function public.lifter_local_date(p_at timestamptz, p_user_id uuid default auth.uid())
returns date
language sql
stable
security invoker
set search_path = ''
as $$
  select (p_at at time zone p.timezone)::date
  from public.profiles p
  where p.user_id = p_user_id;
$$;

comment on function public.lifter_local_date(timestamptz, uuid) is
  'The lifter''s local date at an instant, in their profile time zone. Null if the profile isn''t visible.';

revoke execute on function public.lifter_local_date(timestamptz, uuid) from public, anon;
grant execute on function public.lifter_local_date(timestamptz, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Day templates
-- ---------------------------------------------------------------------------

create table public.day_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);

comment on table public.day_templates is 'A reusable, named list of exercises, such as Push or Legs.';

create table public.day_template_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  day_template_id uuid not null,
  exercise_id text not null references public.exercises (id),
  position smallint not null check (position >= 1),
  sets smallint not null check (sets between 1 and 20),
  min_reps smallint not null check (min_reps >= 1),
  max_reps smallint not null,
  rest_s integer not null check (rest_s >= 0),
  -- The lifter pinned this exercise; the coach mustn't swap it out.
  user_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (day_template_id, user_id) references public.day_templates (id, user_id) on delete cascade,
  unique (day_template_id, position) deferrable initially immediate,
  unique (day_template_id, exercise_id),
  check (max_reps >= min_reps)
);

comment on column public.day_template_exercises.position is 'Order within the day template, starting at 1.';

create index day_template_exercises_exercise_id_idx on public.day_template_exercises (exercise_id);

-- ---------------------------------------------------------------------------
-- Blocks
-- ---------------------------------------------------------------------------

create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  split_name text not null,
  -- Blocks line up with training weeks, so they start on a Monday.
  start_date date not null check (start_date = public.training_week_start(start_date)),
  length_weeks smallint not null default 12 check (length_weeks between 1 and 52),
  status text not null default 'draft' check (status in ('draft', 'active', 'done')),
  created_by text not null default 'user' check (created_by in ('user', 'coach')),
  rationale text,
  -- References goals once Step 5 adds them.
  goal_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

comment on table public.blocks is 'A split run for a fixed number of weeks. At most one active block per lifter.';

-- Only one active block per lifter.
create unique index blocks_one_active_per_user on public.blocks (user_id) where status = 'active';

create table public.block_days (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  block_id uuid not null,
  day_template_id uuid not null,
  -- ISO weekday the session is scheduled on by default: 1 = Monday ... 7 = Sunday.
  weekday smallint not null check (weekday between 1 and 7),
  position smallint not null check (position >= 1),
  created_at timestamptz not null default now(),
  foreign key (block_id, user_id) references public.blocks (id, user_id) on delete cascade,
  foreign key (day_template_id, user_id) references public.day_templates (id, user_id),
  unique (block_id, position)
);

comment on table public.block_days is 'The split: which day templates a block runs, their order and default weekday.';

create index block_days_day_template_id_idx on public.block_days (day_template_id, user_id);

-- ---------------------------------------------------------------------------
-- Sessions and prescribed sets
-- ---------------------------------------------------------------------------

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  block_id uuid not null,
  day_template_id uuid not null,
  training_week_start date not null,
  scheduled_date date not null,
  performed_date date,
  status text not null default 'planned' check (status in ('planned', 'done', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (block_id, user_id) references public.blocks (id, user_id) on delete cascade,
  foreign key (day_template_id, user_id) references public.day_templates (id, user_id),
  unique (id, user_id),
  -- A session is scheduled inside its own training week.
  check (training_week_start = public.training_week_start(scheduled_date))
);

comment on table public.sessions is
  'One day template due in a training week, scheduled for a date in that week.';
comment on column public.sessions.training_week_start is 'Monday of the training week this session belongs to.';

create index sessions_block_scheduled_idx on public.sessions (block_id, scheduled_date);
create index sessions_user_scheduled_idx on public.sessions (user_id, scheduled_date);
create index sessions_day_template_id_idx on public.sessions (day_template_id, user_id);

create table public.prescribed_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null,
  exercise_id text not null references public.exercises (id),
  -- Order of this exercise within the session, starting at 1.
  position smallint not null check (position >= 1),
  set_index smallint not null check (set_index >= 1),
  min_reps smallint not null check (min_reps >= 1),
  max_reps smallint not null,
  -- Null means a calibration week: no target load yet.
  target_kg numeric(6, 2) check (target_kg >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (session_id, user_id) references public.sessions (id, user_id) on delete cascade,
  unique (session_id, exercise_id, set_index),
  unique (id, user_id),
  check (max_reps >= min_reps)
);

comment on table public.prescribed_sets is
  'A set the coach prescribes in a session. Created one training week at a time (ADR 0002).';
comment on column public.prescribed_sets.target_kg is 'Null in a calibration week.';

create index prescribed_sets_exercise_id_idx on public.prescribed_sets (exercise_id);

-- ---------------------------------------------------------------------------
-- RLS and updated_at, the same on every table (ADR 0005)
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['day_templates', 'day_template_exercises', 'blocks', 'block_days', 'sessions', 'prescribed_sets'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "owner" on public.%I for all to authenticated '
      'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t
    );
  end loop;

  foreach t in array array['day_templates', 'day_template_exercises', 'blocks', 'sessions', 'prescribed_sets'] loop
    execute format(
      'create trigger %I before update on public.%I for each row execute function public.touch_updated_at()',
      t || '_touch_updated_at', t
    );
  end loop;

  -- Only seeded exercises or the lifter's own custom ones (see check_exercise_usable).
  foreach t in array array['day_template_exercises', 'prescribed_sets'] loop
    execute format(
      'create trigger %I before insert or update of exercise_id, user_id on public.%I '
      'for each row execute function public.check_exercise_usable(''exercise_id'')',
      t || '_check_exercise', t
    );
  end loop;
end;
$$;
