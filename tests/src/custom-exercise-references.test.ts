import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { createLifterWithBlock, logSet, type LifterWithBlock } from './harness/programming';
import type { Client } from './harness/users';

const BLOCK_START = '2026-06-01';
const SEEDED = 'Barbell_Bench_Press_-_Medium_Grip';

/** Every column that references exercises (id). */
const COLUMNS = [
  'user_exercise_prefs.exercise_id',
  'exercise_similar.exercise_id',
  'exercise_similar.similar_exercise_id',
  'day_template_exercises.exercise_id',
  'prescribed_sets.exercise_id',
  'logged_sets.exercise_id',
] as const;

type Failure = { error: { code: string; message: string } | null };

/** The parts of an error a caller sees, with the exercise ID taken out so two IDs can be compared. */
function shape(result: Failure, exerciseId: string) {
  expect(result.error).not.toBeNull();
  return {
    code: result.error!.code,
    message: result.error!.message.replaceAll(exerciseId, '<id>'),
  };
}

/**
 * Every table that references an exercise, written as `client`'s user with
 * `exerciseId` in the exercise column. Each entry hangs off that user's own
 * rows, so the exercise is the only thing that can be wrong.
 */
function writers(
  lifter: LifterWithBlock,
): Record<(typeof COLUMNS)[number], (client: Client, exerciseId: string) => PromiseLike<Failure>> {
  const push = lifter.sessions[0]!;
  return {
    'user_exercise_prefs.exercise_id': (c, id) => c.from('user_exercise_prefs').insert({ exercise_id: id, favourite: true }),
    'exercise_similar.exercise_id': (c, id) =>
      c.from('exercise_similar').insert({ exercise_id: id, similar_exercise_id: SEEDED, carryover_factor: 0.5 }),
    'exercise_similar.similar_exercise_id': (c, id) =>
      c.from('exercise_similar').insert({ exercise_id: SEEDED, similar_exercise_id: id, carryover_factor: 0.5 }),
    'day_template_exercises.exercise_id': (c, id) =>
      c.from('day_template_exercises').insert({
        day_template_id: lifter.dayTemplateIds.Push!,
        exercise_id: id,
        position: 99,
        sets: 3,
        min_reps: 8,
        max_reps: 12,
        rest_s: 90,
      }),
    'prescribed_sets.exercise_id': (c, id) =>
      c.from('prescribed_sets').insert({
        session_id: push.id,
        exercise_id: id,
        position: 99,
        set_index: 1,
        min_reps: 8,
        max_reps: 12,
      }),
    'logged_sets.exercise_id': (c, id) =>
      logSet(c, { id: randomUUID(), session_id: push.id, prescribed_set_id: null, exercise_id: id, reps: 10, kg: 20 }),
  };
}

describe("another lifter's custom exercise can't be referenced", () => {
  let a: LifterWithBlock;
  let b: LifterWithBlock;
  let aCustom: string;

  beforeAll(async () => {
    [a, b] = await Promise.all([
      createLifterWithBlock({ startDate: BLOCK_START, label: 'a' }),
      createLifterWithBlock({ startDate: BLOCK_START, label: 'b' }),
    ]);
    aCustom = `custom:a-private-${randomUUID().slice(0, 8)}`;
    const { error } = await a.user.client.from('exercises').insert({ id: aCustom, name: "A's private move" });
    expect(error).toBeNull();
  });

  for (const column of COLUMNS) {
    it(`${column}: B gets the same error for A's custom exercise as for one that doesn't exist`, async () => {
      const write = writers(b)[column];
      const missing = `custom:does-not-exist-${randomUUID().slice(0, 8)}`;

      const leaked = await write(b.user.client, aCustom);
      const nonexistent = await write(b.user.client, missing);

      expect(shape(leaked, aCustom)).toEqual(shape(nonexistent, missing));
      expect(leaked.error!.code).toBe('23503');
    });

    it(`${column}: A can reference their own custom exercise`, async () => {
      const result = await writers(a)[column](a.user.client, aCustom);

      expect(result.error).toBeNull();
    });
  }
});
