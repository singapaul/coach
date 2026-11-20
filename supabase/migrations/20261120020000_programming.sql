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
end;
$$;

-- ---------------------------------------------------------------------------
-- today_plan v1 (ADR 0001)
-- ---------------------------------------------------------------------------

-- Logged sets recorded against one prescribed set, as today_plan v1 lists them.
-- EXTENSION POINT: the logging ticket replaces this body (create or replace) once
-- logged_sets exists. Until then nothing can be logged, so it's always empty.
create function public.today_plan_logged_sets(p_prescribed_set_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select '[]'::jsonb;
$$;

-- today_plan v1 as if "now" were p_at. The real work lives here so tests can pin
-- the clock; clients call today_plan(), which passes now().
--
-- security invoker: RLS applies, so it only ever reads the caller's own rows.
-- Choosing p_at only changes which of your own dates you look at.
create function public.today_plan_at(p_at timestamptz)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_date date;
  v_block public.blocks;
  v_session public.sessions;
  v_template_name text;
  v_exercises jsonb;
  v_envelope jsonb;
begin
  if v_user_id is null then
    raise exception 'today_plan needs a signed-in lifter' using errcode = '42501';
  end if;

  v_date := public.lifter_local_date(p_at, v_user_id);
  v_envelope := jsonb_build_object(
    'version', 1,
    'generated_at', to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'date', v_date
  );

  select * into v_block
  from public.blocks b
  where b.user_id = v_user_id and b.status = 'active';

  if not found then
    return v_envelope || jsonb_build_object('session', null, 'reason', 'no_active_block');
  end if;

  -- If a session was moved onto a day that already had one, the earlier-created wins.
  select * into v_session
  from public.sessions s
  where s.block_id = v_block.id and s.user_id = v_user_id and s.scheduled_date = v_date
  order by s.created_at, s.id
  limit 1;

  if not found then
    return v_envelope || jsonb_build_object('session', null, 'reason', 'no_session_today');
  end if;

  select dt.name into v_template_name from public.day_templates dt where dt.id = v_session.day_template_id;

  select coalesce(jsonb_agg(ex.exercise order by ex.position), '[]'::jsonb) into v_exercises
  from (
    select
      ps.position,
      jsonb_build_object(
        'position', ps.position,
        'exercise_id', ps.exercise_id,
        'name', e.name,
        'rest_s', dte.rest_s,
        'prescribed_sets', jsonb_agg(
          jsonb_build_object(
            'id', ps.id,
            'set_index', ps.set_index,
            'min_reps', ps.min_reps,
            'max_reps', ps.max_reps,
            'target_kg', ps.target_kg,
            'logged_sets', public.today_plan_logged_sets(ps.id)
          )
          order by ps.set_index
        )
      ) as exercise
    from public.prescribed_sets ps
    join public.exercises e on e.id = ps.exercise_id
    left join public.day_template_exercises dte
      on dte.day_template_id = v_session.day_template_id and dte.exercise_id = ps.exercise_id
    where ps.session_id = v_session.id
    group by ps.position, ps.exercise_id, e.name, dte.rest_s
  ) ex;

  return v_envelope || jsonb_build_object(
    'session', jsonb_build_object(
      'id', v_session.id,
      'day_template_name', v_template_name,
      'scheduled_date', v_session.scheduled_date,
      'status', v_session.status,
      'block_week', (v_session.training_week_start - v_block.start_date) / 7 + 1,
      'block_length_weeks', v_block.length_weeks,
      'exercises', v_exercises
    ),
    'reason', null
  );
end;
$$;

comment on function public.today_plan_at(timestamptz) is
  'today_plan v1 as if now were p_at. For tests; clients call today_plan().';

-- today_plan v1: today's session in the caller's time zone. The published object clients read.
create function public.today_plan()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select public.today_plan_at(now());
$$;

comment on function public.today_plan() is
  'today_plan v1 published object: today''s session (today in the profile time zone), or null with a reason.';

revoke execute on function public.today_plan_logged_sets(uuid) from public, anon;
revoke execute on function public.today_plan_at(timestamptz) from public, anon;
revoke execute on function public.today_plan() from public, anon;
grant execute on function public.today_plan_logged_sets(uuid) to authenticated, service_role;
grant execute on function public.today_plan_at(timestamptz) to authenticated, service_role;
grant execute on function public.today_plan() to authenticated, service_role;
