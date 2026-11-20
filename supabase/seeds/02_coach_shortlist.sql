-- The coach's shortlist (ADR 0004): the seeded exercises hand-tagged with a
-- movement pattern and body region. Only tagged exercises can be eligible for
-- the coach (see public.coach_eligible_exercises).
--
-- This file is the single source of truth for tags on seeded exercises: it tags
-- every exercise listed below and clears the tags on every other seeded
-- exercise, so removing a line here untags that exercise on the next seed.
-- Running it again changes nothing. A listed ID that isn't in the library stops
-- the seed with an error.
--
-- DRAFT for the lifter's review (issue #8). Conventions used:
--   * Isolation moves take the pattern of the compound lift they assist:
--     chest flyes and triceps pushdowns/skullcrushers -> horizontal_push;
--     lateral raises and overhead triceps extensions -> vertical_push;
--     curls, face pulls and rear-delt flyes -> horizontal_pull;
--     straight-arm pulldowns -> vertical_pull;
--     leg extensions and calf raises -> squat; leg curls -> hinge.
--   * carry and core are tagged body_region 'upper' so progression makes the
--     smaller load jump (a farmer's walk is grip-limited).
--   * free-exercise-db has only one practical carry (Farmers_Walk). Add a
--     custom exercise for a suitcase or overhead carry if you want one.
--
-- Day templates (issue #4) refer to these IDs directly.

-- One statement, because the Supabase CLI sends seed statements as a pipelined
-- batch: a temp table created in one statement doesn't exist yet when the next
-- one is prepared.
do $seed$
declare
  missing text;
begin
  create temporary table coach_shortlist (
    id text primary key,
    movement_pattern text not null,
    body_region text not null
  );

  insert into coach_shortlist (id, movement_pattern, body_region) values
    -- horizontal push (11)
    ('Barbell_Bench_Press_-_Medium_Grip',          'horizontal_push', 'upper'), -- barbell
    ('Barbell_Incline_Bench_Press_-_Medium_Grip',  'horizontal_push', 'upper'), -- barbell
    ('Dumbbell_Bench_Press',                       'horizontal_push', 'upper'), -- dumbbell
    ('Incline_Dumbbell_Press',                     'horizontal_push', 'upper'), -- dumbbell
    ('Machine_Bench_Press',                        'horizontal_push', 'upper'), -- machine
    ('Dips_-_Chest_Version',                       'horizontal_push', 'upper'), -- bodyweight
    ('Dumbbell_Flyes',                             'horizontal_push', 'upper'), -- dumbbell, isolation
    ('Cable_Crossover',                            'horizontal_push', 'upper'), -- cable, isolation
    ('Butterfly',                                  'horizontal_push', 'upper'), -- machine, isolation
    ('Triceps_Pushdown_-_Rope_Attachment',         'horizontal_push', 'upper'), -- cable, isolation
    ('EZ-Bar_Skullcrusher',                        'horizontal_push', 'upper'), -- ez bar, isolation
    -- vertical push (8)
    ('Standing_Military_Press',                    'vertical_push',   'upper'), -- barbell
    ('Seated_Dumbbell_Press',                      'vertical_push',   'upper'), -- dumbbell
    ('Arnold_Dumbbell_Press',                      'vertical_push',   'upper'), -- dumbbell
    ('Machine_Shoulder_Military_Press',            'vertical_push',   'upper'), -- machine
    ('Side_Lateral_Raise',                         'vertical_push',   'upper'), -- dumbbell, isolation
    ('Cable_Seated_Lateral_Raise',                 'vertical_push',   'upper'), -- cable, isolation
    ('Cable_Rope_Overhead_Triceps_Extension',      'vertical_push',   'upper'), -- cable, isolation
    ('Seated_Triceps_Press',                       'vertical_push',   'upper'), -- dumbbell, isolation
    -- horizontal pull (11)
    ('Bent_Over_Barbell_Row',                      'horizontal_pull', 'upper'), -- barbell
    ('T-Bar_Row_with_Handle',                      'horizontal_pull', 'upper'), -- barbell
    ('One-Arm_Dumbbell_Row',                       'horizontal_pull', 'upper'), -- dumbbell
    ('Seated_Cable_Rows',                          'horizontal_pull', 'upper'), -- cable
    ('Leverage_Iso_Row',                           'horizontal_pull', 'upper'), -- machine
    ('Face_Pull',                                  'horizontal_pull', 'upper'), -- cable
    ('Reverse_Machine_Flyes',                      'horizontal_pull', 'upper'), -- machine, isolation
    ('Barbell_Curl',                               'horizontal_pull', 'upper'), -- barbell, isolation
    ('Dumbbell_Bicep_Curl',                        'horizontal_pull', 'upper'), -- dumbbell, isolation
    ('Hammer_Curls',                               'horizontal_pull', 'upper'), -- dumbbell, isolation
    ('Standing_Biceps_Cable_Curl',                 'horizontal_pull', 'upper'), -- cable, isolation
    -- vertical pull (6)
    ('Pullups',                                    'vertical_pull',   'upper'), -- bodyweight
    ('Chin-Up',                                    'vertical_pull',   'upper'), -- bodyweight
    ('Wide-Grip_Lat_Pulldown',                     'vertical_pull',   'upper'), -- cable
    ('Close-Grip_Front_Lat_Pulldown',              'vertical_pull',   'upper'), -- cable
    ('Underhand_Cable_Pulldowns',                  'vertical_pull',   'upper'), -- cable
    ('Straight-Arm_Pulldown',                      'vertical_pull',   'upper'), -- cable, isolation
    -- squat (10)
    ('Barbell_Squat',                              'squat',           'lower'), -- barbell
    ('Front_Barbell_Squat',                        'squat',           'lower'), -- barbell
    ('Goblet_Squat',                               'squat',           'lower'), -- kettlebell/dumbbell
    ('Leg_Press',                                  'squat',           'lower'), -- machine
    ('Hack_Squat',                                 'squat',           'lower'), -- machine
    ('Dumbbell_Lunges',                            'squat',           'lower'), -- dumbbell
    ('Split_Squat_with_Dumbbells',                 'squat',           'lower'), -- dumbbell
    ('Leg_Extensions',                             'squat',           'lower'), -- machine, isolation
    ('Standing_Calf_Raises',                       'squat',           'lower'), -- machine, isolation
    ('Seated_Calf_Raise',                          'squat',           'lower'), -- machine, isolation
    -- hinge (8)
    ('Barbell_Deadlift',                           'hinge',           'lower'), -- barbell
    ('Romanian_Deadlift',                          'hinge',           'lower'), -- barbell
    ('Stiff-Legged_Dumbbell_Deadlift',             'hinge',           'lower'), -- dumbbell
    ('Barbell_Hip_Thrust',                         'hinge',           'lower'), -- barbell
    ('Pull_Through',                               'hinge',           'lower'), -- cable
    ('Hyperextensions_Back_Extensions',            'hinge',           'lower'), -- bench
    ('Lying_Leg_Curls',                            'hinge',           'lower'), -- machine, isolation
    ('Seated_Leg_Curl',                            'hinge',           'lower'), -- machine, isolation
    -- carry (1)
    ('Farmers_Walk',                               'carry',           'upper'), -- dumbbells/handles
    -- core (5)
    ('Plank',                                      'core',            'upper'), -- bodyweight
    ('Cable_Crunch',                               'core',            'upper'), -- cable
    ('Hanging_Leg_Raise',                          'core',            'upper'), -- bodyweight
    ('Ab_Roller',                                  'core',            'upper'), -- wheel
    ('Pallof_Press',                               'core',            'upper'); -- cable

  select string_agg(s.id, ', ' order by s.id) into missing
  from coach_shortlist s
  left join public.exercises e on e.id = s.id and e.source = 'seed'
  where e.id is null;

  if missing is not null then
    raise exception 'coach shortlist names exercises not in the seeded library: %', missing;
  end if;

  -- Tag the shortlist; untag every other seeded exercise. Rows that already
  -- match are left alone, so a second run changes nothing (not even updated_at).
  update public.exercises e
  set movement_pattern = s.movement_pattern,
      body_region = s.body_region
  from public.exercises src
  left join coach_shortlist s on s.id = src.id
  where e.id = src.id
    and e.source = 'seed'
    and (e.movement_pattern, e.body_region) is distinct from (s.movement_pattern, s.body_region);

  drop table coach_shortlist;
end;
$seed$;
