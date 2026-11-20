-- The local test user and their starting Push/Pull/Legs block (ADR 0002).
--
-- Local only: sign in on the local stack as lifter@coach.local / coach-local-lifter.
-- On the hosted project the same block is created for the real account by a
-- one-off script against its user ID, not by this file.
--
-- The block starts on the Monday of the current training week (Europe/London)
-- at seed time, so today_plan has something to show straight after `db reset`.
-- Only week 1 exists: its sessions and calibration prescribed sets (no target_kg).
--
-- Safe to run again: the user is only created once, and if they already have an
-- active block the programme is left alone. `supabase db reset` rebuilds it fresh.
--
-- Everything is in one DO block because the CLI sends seed files as a pipelined
-- batch (see 02_coach_shortlist.sql).

do $$
declare
  v_user_id constant uuid := '00000000-0000-4000-8000-000000000001';
  v_email constant text := 'lifter@coach.local';
  v_start date;
  v_block_id uuid;
  v_template_id uuid;
  v_session_id uuid;
  d record;
  e record;
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) values (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt('coach-local-lifter', extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}', '{"timezone": "Europe/London"}', now(), now(),
    '', '', '', ''
  )
  on conflict (id) do nothing;

  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (
    v_user_id::text, v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  )
  on conflict (provider_id, provider) do nothing;

  -- The profile comes from the sign-up trigger; set the rest of it.
  update public.profiles
  set height_cm = coalesce(height_cm, 180), birth_year = coalesce(birth_year, 1990),
      sex = coalesce(sex, 'male'), training_days_per_week = coalesce(training_days_per_week, 3)
  where user_id = v_user_id
    -- Only when something is missing, so a rerun doesn't touch updated_at.
    and (height_cm is null or birth_year is null or sex is null or training_days_per_week is null);

  if exists (select 1 from public.blocks where user_id = v_user_id and status = 'active') then
    raise notice 'lifter@coach.local already has an active block; leaving it alone';
    return;
  end if;

  v_start := public.training_week_start(public.lifter_local_date(now(), v_user_id));

  insert into public.blocks (user_id, split_name, start_date, length_weeks, status, created_by, rationale)
  values (
    v_user_id, 'Push · Pull · Legs', v_start, 12, 'active', 'user',
    'Starting block: three full-body-coverage days a week. Week 1 is a calibration week.'
  )
  returning id into v_block_id;

  -- Day template, weekday, then its exercises in order with rest. Sets and reps
  -- follow each exercise's mechanic: compound 3 x 6-8, isolation 3 x 10-15.
  for d in
    select * from (values
      (1, 'Push', 1, array['Barbell_Bench_Press_-_Medium_Grip', 'Incline_Dumbbell_Press', 'Standing_Military_Press',
                           'Cable_Crossover', 'Side_Lateral_Raise', 'Triceps_Pushdown_-_Rope_Attachment']),
      (2, 'Pull', 3, array['Bent_Over_Barbell_Row', 'Wide-Grip_Lat_Pulldown', 'Seated_Cable_Rows',
                           'Reverse_Machine_Flyes', 'Barbell_Curl', 'Hammer_Curls']),
      (3, 'Legs', 5, array['Barbell_Squat', 'Romanian_Deadlift', 'Leg_Press',
                           'Lying_Leg_Curls', 'Leg_Extensions', 'Standing_Calf_Raises'])
    ) as v(position, name, weekday, exercise_ids)
    order by position
  loop
    insert into public.day_templates (user_id, name)
    values (v_user_id, d.name)
    on conflict (user_id, name) do update set name = excluded.name
    returning id into v_template_id;

    delete from public.day_template_exercises where day_template_id = v_template_id;

    insert into public.block_days (user_id, block_id, day_template_id, weekday, position)
    values (v_user_id, v_block_id, v_template_id, d.weekday, d.position);

    insert into public.sessions (user_id, block_id, day_template_id, training_week_start, scheduled_date)
    values (v_user_id, v_block_id, v_template_id, v_start, v_start + (d.weekday - 1))
    returning id into v_session_id;

    for e in
      select ids.position, x.id, x.mechanic
      from unnest(d.exercise_ids) with ordinality as ids(exercise_id, position)
      left join public.exercises x on x.id = ids.exercise_id
      order by ids.position
    loop
      if e.id is null then
        raise exception 'starting block lists %, which is not in the exercise library', d.exercise_ids[e.position];
      end if;

      insert into public.day_template_exercises
        (user_id, day_template_id, exercise_id, position, sets, min_reps, max_reps, rest_s)
      values (
        v_user_id, v_template_id, e.id, e.position, 3,
        case when e.mechanic = 'compound' then 6 else 10 end,
        case when e.mechanic = 'compound' then 8 else 15 end,
        case when e.position = 1 then 180 when e.mechanic = 'compound' then 150 else 90 end
      );

      insert into public.prescribed_sets
        (user_id, session_id, exercise_id, position, set_index, min_reps, max_reps, target_kg)
      select
        v_user_id, v_session_id, e.id, e.position, s,
        case when e.mechanic = 'compound' then 6 else 10 end,
        case when e.mechanic = 'compound' then 8 else 15 end,
        null
      from generate_series(1, 3) s;
    end loop;
  end loop;
end;
$$;
