-- A few exercise preferences for the local test user (lifter@coach.local), so
-- prefs and eligibility have something to show locally. None of them touch the
-- starting block: the favourite is already in it, and the avoided and
-- unavailable exercises aren't, so today_plan is unchanged.
--
-- Safe to run again: existing preferences are left alone.

insert into public.user_exercise_prefs (user_id, exercise_id, available, favourite, avoid, notes)
values
  ('00000000-0000-4000-8000-000000000001', 'Barbell_Bench_Press_-_Medium_Grip', true, true, false, 'Favourite lift.'),
  ('00000000-0000-4000-8000-000000000001', 'Barbell_Deadlift', true, false, true, 'Lower back: avoid conventional deadlifts for now.'),
  ('00000000-0000-4000-8000-000000000001', 'Hack_Squat', false, false, false, 'No hack squat machine at my gym.')
on conflict (user_id, exercise_id) do nothing;
