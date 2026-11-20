import { expect } from 'vitest';
import { todayPlanV1, type TodayPlanV1 } from '@coach/contract';
import { createTestUser, type Client, type TestUser } from './users';

/**
 * The local test user created by supabase/seeds/03_starting_block.sql, with the
 * starting PPL block. Local-only test credentials; tests must not change its rows.
 */
export const SEED_LIFTER = { email: 'lifter@coach.local', password: 'coach-local-lifter' };

/** ISO weekday: 1 = Monday ... 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type TemplateExercise = {
  exerciseId: string;
  sets: number;
  minReps: number;
  maxReps: number;
  restS: number;
};

export type DaySpec = {
  name: string;
  weekday: Weekday;
  exercises: TemplateExercise[];
};

/** Shortlist exercises (seeded and tagged), so every template is coach-eligible. */
export const PPL_DAYS: DaySpec[] = [
  {
    name: 'Push',
    weekday: 1,
    exercises: [
      { exerciseId: 'Barbell_Bench_Press_-_Medium_Grip', sets: 3, minReps: 6, maxReps: 8, restS: 180 },
      { exerciseId: 'Seated_Dumbbell_Press', sets: 3, minReps: 6, maxReps: 8, restS: 150 },
      { exerciseId: 'Side_Lateral_Raise', sets: 3, minReps: 10, maxReps: 15, restS: 90 },
    ],
  },
  {
    name: 'Pull',
    weekday: 3,
    exercises: [
      { exerciseId: 'Bent_Over_Barbell_Row', sets: 3, minReps: 6, maxReps: 8, restS: 180 },
      { exerciseId: 'Wide-Grip_Lat_Pulldown', sets: 3, minReps: 6, maxReps: 8, restS: 150 },
      { exerciseId: 'Barbell_Curl', sets: 3, minReps: 10, maxReps: 15, restS: 90 },
    ],
  },
  {
    name: 'Legs',
    weekday: 5,
    exercises: [
      { exerciseId: 'Barbell_Squat', sets: 3, minReps: 6, maxReps: 8, restS: 180 },
      { exerciseId: 'Romanian_Deadlift', sets: 3, minReps: 6, maxReps: 8, restS: 150 },
      { exerciseId: 'Leg_Extensions', sets: 3, minReps: 10, maxReps: 15, restS: 90 },
    ],
  },
];

export type SeededSession = {
  id: string;
  dayTemplateName: string;
  scheduledDate: string;
  trainingWeekStart: string;
};

export type LifterWithBlock = {
  user: TestUser;
  blockId: string;
  dayTemplateIds: Record<string, string>;
  /** Week 1's sessions, in weekday order. */
  sessions: SeededSession[];
};

/** Adds `days` to an ISO date (`YYYY-MM-DD`), with no time zone involved. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function check<T>(result: { data: T; error: unknown }): NonNullable<T> {
  expect(result.error).toBeNull();
  if (result.data == null) throw new Error('expected data');
  return result.data;
}

/**
 * Gives `client`'s user an active block of `days`, starting on `startDate` (a
 * Monday), with week 1's sessions and calibration prescribed sets (no target
 * loads), all inserted through the API as that user, the way the app or the
 * coach would. Nothing depends on the real current date.
 */
export async function seedBlock(
  client: Client,
  options: { startDate: string; days?: DaySpec[]; lengthWeeks?: number },
): Promise<Omit<LifterWithBlock, 'user'>> {
  const days = options.days ?? PPL_DAYS;
  const dayTemplateIds: Record<string, string> = {};

  for (const day of days) {
    const template = check(
      await client.from('day_templates').insert({ name: day.name }).select('id').single(),
    );
    dayTemplateIds[day.name] = template.id;
    check(
      await client
        .from('day_template_exercises')
        .insert(
          day.exercises.map((e, i) => ({
            day_template_id: template.id,
            exercise_id: e.exerciseId,
            position: i + 1,
            sets: e.sets,
            min_reps: e.minReps,
            max_reps: e.maxReps,
            rest_s: e.restS,
          })),
        )
        .select('id'),
    );
  }

  const block = check(
    await client
      .from('blocks')
      .insert({
        split_name: days.map((d) => d.name).join(' · '),
        start_date: options.startDate,
        length_weeks: options.lengthWeeks ?? 12,
        status: 'active',
        created_by: 'user',
      })
      .select('id')
      .single(),
  );

  check(
    await client
      .from('block_days')
      .insert(
        days.map((d, i) => ({
          block_id: block.id,
          day_template_id: dayTemplateIds[d.name]!,
          weekday: d.weekday,
          position: i + 1,
        })),
      )
      .select('id'),
  );

  const sessions: SeededSession[] = [];
  for (const day of days) {
    const scheduledDate = addDays(options.startDate, day.weekday - 1);
    const session = check(
      await client
        .from('sessions')
        .insert({
          block_id: block.id,
          day_template_id: dayTemplateIds[day.name]!,
          training_week_start: options.startDate,
          scheduled_date: scheduledDate,
        })
        .select('id')
        .single(),
    );
    sessions.push({
      id: session.id,
      dayTemplateName: day.name,
      scheduledDate,
      trainingWeekStart: options.startDate,
    });

    check(
      await client
        .from('prescribed_sets')
        .insert(
          day.exercises.flatMap((e, i) =>
            Array.from({ length: e.sets }, (_, s) => ({
              session_id: session.id,
              exercise_id: e.exerciseId,
              position: i + 1,
              set_index: s + 1,
              min_reps: e.minReps,
              max_reps: e.maxReps,
              target_kg: null,
            })),
          ),
        )
        .select('id'),
    );
  }

  return { blockId: block.id, dayTemplateIds, sessions };
}

/**
 * A fresh signed-in lifter in `timezone` with an active PPL block (or `days`)
 * starting on `startDate`, a Monday. The usual starting point for today_plan,
 * logging and session tests.
 */
export async function createLifterWithBlock(options: {
  startDate: string;
  timezone?: string;
  days?: DaySpec[];
  lengthWeeks?: number;
  label?: string;
}): Promise<LifterWithBlock> {
  const user = await createTestUser({
    label: options.label ?? 'lifter',
    metadata: { timezone: options.timezone ?? 'Europe/London' },
  });
  return { user, ...(await seedBlock(user.client, options)) };
}

/**
 * Calls `today_plan_at` as if "now" were `at` (an ISO timestamp with an
 * explicit offset, e.g. `2026-06-07T23:30:00+01:00`), and checks the response
 * against the contract's v1 schema before returning it.
 */
export async function todayPlanAt(client: Client, at: string): Promise<TodayPlanV1> {
  const { data, error } = await client.rpc('today_plan_at', { p_at: at });
  expect(error).toBeNull();
  return todayPlanV1.parse(data);
}

export type LoggedSetInsert = {
  id: string;
  session_id: string;
  prescribed_set_id: string | null;
  exercise_id: string;
  performed_at?: string;
  reps: number;
  kg: number;
  rpe?: number | null;
};

/**
 * Logs a set exactly as the app does: a direct PostgREST insert of a row whose
 * UUID the app created, sent with `ON CONFLICT (id) DO NOTHING` so a retry of
 * the same row changes nothing and doesn't fail.
 */
export async function logSet(client: Client, set: LoggedSetInsert) {
  return client.from('logged_sets').upsert(set, { onConflict: 'id', ignoreDuplicates: true });
}
