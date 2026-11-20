-- today_plan v1 (ADR 0001): the published object the app reads for today's session.
--
-- After the programming and logged_sets migrations, because it reads both.

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
    'generated_at', public.iso_utc(now()),
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

  -- Exercises: the prescribed ones in their order, then any exercise that was
  -- only logged as extra sets, in the order it was first performed. Logged sets
  -- are listed oldest first, under the prescribed set they fulfil, or under
  -- extra_logged_sets when they fulfil none.
  with logged as (
    select
      ls.prescribed_set_id,
      ls.exercise_id,
      ls.performed_at,
      ls.created_at,
      ls.id,
      jsonb_build_object(
        'id', ls.id,
        'performed_at', public.iso_utc(ls.performed_at),
        'reps', ls.reps,
        'kg', ls.kg,
        'rpe', ls.rpe
      ) as item
    from public.logged_sets ls
    where ls.session_id = v_session.id
  ),
  extra as (
    select
      l.exercise_id,
      min(l.performed_at) as first_performed_at,
      jsonb_agg(l.item order by l.performed_at, l.created_at, l.id) as sets
    from logged l
    where l.prescribed_set_id is null
    group by l.exercise_id
  ),
  prescribed as (
    select
      ps.position,
      ps.exercise_id,
      jsonb_agg(
        jsonb_build_object(
          'id', ps.id,
          'set_index', ps.set_index,
          'min_reps', ps.min_reps,
          'max_reps', ps.max_reps,
          'target_kg', ps.target_kg,
          'logged_sets', (
            select coalesce(jsonb_agg(l.item order by l.performed_at, l.created_at, l.id), '[]'::jsonb)
            from logged l
            where l.prescribed_set_id = ps.id
          )
        )
        order by ps.set_index
      ) as sets
    from public.prescribed_sets ps
    where ps.session_id = v_session.id
    group by ps.position, ps.exercise_id
  ),
  exercises as (
    select p.position, p.exercise_id, p.sets as prescribed_sets, coalesce(x.sets, '[]'::jsonb) as extra_logged_sets
    from prescribed p
    left join extra x on x.exercise_id = p.exercise_id
    union all
    select
      coalesce((select max(p.position) from prescribed p), 0)
        + row_number() over (order by x.first_performed_at, x.exercise_id),
      x.exercise_id,
      '[]'::jsonb,
      x.sets
    from extra x
    where not exists (select 1 from prescribed p where p.exercise_id = x.exercise_id)
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'position', ex.position,
        'exercise_id', ex.exercise_id,
        'name', e.name,
        'rest_s', dte.rest_s,
        'prescribed_sets', ex.prescribed_sets,
        'extra_logged_sets', ex.extra_logged_sets
      )
      order by ex.position
    ),
    '[]'::jsonb
  ) into v_exercises
  from exercises ex
  join public.exercises e on e.id = ex.exercise_id
  left join public.day_template_exercises dte
    on dte.day_template_id = v_session.day_template_id and dte.exercise_id = ex.exercise_id;

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

revoke execute on function public.today_plan_at(timestamptz) from public, anon;
revoke execute on function public.today_plan() from public, anon;
grant execute on function public.today_plan_at(timestamptz) to authenticated, service_role;
grant execute on function public.today_plan() to authenticated, service_role;
