import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createLifterWithBlock, logSet, todayPlanAt } from './harness/programming';

const BLOCK_START = '2026-06-01';

describe('logging a set', () => {
  it('sending the same set (same UUID) twice gives exactly one row, and the retry does not fail', async () => {
    const lifter = await createLifterWithBlock({ startDate: BLOCK_START });
    const push = lifter.sessions.find((s) => s.dayTemplateName === 'Push')!;
    const set = {
      id: randomUUID(),
      session_id: push.id,
      prescribed_set_id: null,
      exercise_id: 'Barbell_Bench_Press_-_Medium_Grip',
      performed_at: '2026-06-01T18:05:00+01:00',
      reps: 8,
      kg: 60,
      rpe: 8,
    };

    const first = await logSet(lifter.user.client, set);
    // A poor gym signal: the app never saw the first response, so it resends.
    const retry = await logSet(lifter.user.client, set);

    expect(first.error).toBeNull();
    expect(retry.error).toBeNull();
    const { data } = await lifter.user.client.from('logged_sets').select('id, reps, kg, rpe').eq('id', set.id);
    expect(data).toEqual([{ id: set.id, reps: 8, kg: 60, rpe: 8 }]);
  });

  it("shows a set logged against a prescribed set under that set in today's plan, which still passes the v1 schema", async () => {
    const lifter = await createLifterWithBlock({ startDate: BLOCK_START });
    // Monday 1 June: Push.
    const before = await todayPlanAt(lifter.user.client, '2026-06-01T17:00:00+01:00');
    const bench = before.session!.exercises[0]!;
    const secondSet = bench.prescribed_sets[1]!;
    const id = randomUUID();

    const { error } = await logSet(lifter.user.client, {
      id,
      session_id: before.session!.id,
      prescribed_set_id: secondSet.id,
      exercise_id: bench.exercise_id,
      performed_at: '2026-06-01T18:05:00+01:00',
      reps: 7,
      kg: 62.5,
      rpe: 8.5,
    });
    expect(error).toBeNull();

    // todayPlanAt parses the response with todayPlanV1.
    const after = await todayPlanAt(lifter.user.client, '2026-06-01T18:06:00+01:00');
    const sets = after.session!.exercises[0]!.prescribed_sets;
    expect(sets[1]!.logged_sets).toEqual([
      { id, performed_at: '2026-06-01T17:05:00.000000Z', reps: 7, kg: 62.5, rpe: 8.5 },
    ]);
    expect(sets[0]!.logged_sets).toEqual([]);
    expect(sets[2]!.logged_sets).toEqual([]);
  });

  it('accepts an extra set that fulfils no prescribed set', async () => {
    const lifter = await createLifterWithBlock({ startDate: BLOCK_START });
    const push = lifter.sessions.find((s) => s.dayTemplateName === 'Push')!;
    const id = randomUUID();

    const { error } = await logSet(lifter.user.client, {
      id,
      session_id: push.id,
      prescribed_set_id: null,
      exercise_id: 'Cable_Crossover',
      reps: 12,
      kg: 15,
    });

    expect(error).toBeNull();
    const { data } = await lifter.user.client
      .from('logged_sets')
      .select('id, prescribed_set_id, exercise_id, rpe')
      .eq('id', id);
    expect(data).toEqual([{ id, prescribed_set_id: null, exercise_id: 'Cable_Crossover', rpe: null }]);
  });

  it("shows extra sets in today's plan under their exercise, apart from the prescribed sets", async () => {
    const lifter = await createLifterWithBlock({ startDate: BLOCK_START });
    const before = await todayPlanAt(lifter.user.client, '2026-06-01T17:00:00+01:00');
    const sessionId = before.session!.id;
    const bench = before.session!.exercises[0]!;
    const [first, second] = [randomUUID(), randomUUID()];

    // A fourth bench set beyond the three prescribed, sent out of order.
    for (const [id, performedAt, reps] of [
      [second, '2026-06-01T18:20:00+01:00', 5],
      [first, '2026-06-01T18:15:00+01:00', 6],
    ] as const) {
      const { error } = await logSet(lifter.user.client, {
        id,
        session_id: sessionId,
        prescribed_set_id: null,
        exercise_id: bench.exercise_id,
        performed_at: performedAt,
        reps,
        kg: 60,
      });
      expect(error).toBeNull();
    }

    const after = await todayPlanAt(lifter.user.client, '2026-06-01T18:30:00+01:00');
    const exercises = after.session!.exercises;
    expect(exercises[0]!.extra_logged_sets).toEqual([
      { id: first, performed_at: '2026-06-01T17:15:00.000000Z', reps: 6, kg: 60, rpe: null },
      { id: second, performed_at: '2026-06-01T17:20:00.000000Z', reps: 5, kg: 60, rpe: null },
    ]);
    expect(exercises[0]!.prescribed_sets.every((s) => s.logged_sets.length === 0)).toBe(true);
    expect(exercises[1]!.extra_logged_sets).toEqual([]);
  });

  it("lists an exercise that was only logged as extra sets after the prescribed exercises, with no prescribed sets", async () => {
    const lifter = await createLifterWithBlock({ startDate: BLOCK_START });
    const push = lifter.sessions.find((s) => s.dayTemplateName === 'Push')!;
    const id = randomUUID();

    const { error } = await logSet(lifter.user.client, {
      id,
      session_id: push.id,
      prescribed_set_id: null,
      exercise_id: 'Cable_Crossover',
      performed_at: '2026-06-01T18:40:00+01:00',
      reps: 12,
      kg: 15,
      rpe: 9,
    });
    expect(error).toBeNull();

    const plan = await todayPlanAt(lifter.user.client, '2026-06-01T19:00:00+01:00');
    const exercises = plan.session!.exercises;
    expect(exercises.map((e) => [e.position, e.exercise_id, e.prescribed_sets.length])).toEqual([
      [1, 'Barbell_Bench_Press_-_Medium_Grip', 3],
      [2, 'Seated_Dumbbell_Press', 3],
      [3, 'Side_Lateral_Raise', 3],
      [4, 'Cable_Crossover', 0],
    ]);
    expect(exercises[3]).toMatchObject({
      name: 'Cable Crossover',
      rest_s: null,
      extra_logged_sets: [{ id, performed_at: '2026-06-01T17:40:00.000000Z', reps: 12, kg: 15, rpe: 9 }],
    });
  });

  it("refuses a set that claims to fulfil another session's prescribed set, or another exercise's", async () => {
    const lifter = await createLifterWithBlock({ startDate: BLOCK_START });
    const [push, pull] = [lifter.sessions[0]!, lifter.sessions[1]!];
    const { data: pullSets } = await lifter.user.client
      .from('prescribed_sets')
      .select('id, exercise_id')
      .eq('session_id', pull.id)
      .limit(1);
    const pullSet = pullSets![0]!;

    const wrongSession = await logSet(lifter.user.client, {
      id: randomUUID(),
      session_id: push.id,
      prescribed_set_id: pullSet.id,
      exercise_id: pullSet.exercise_id,
      reps: 8,
      kg: 50,
    });
    const wrongExercise = await logSet(lifter.user.client, {
      id: randomUUID(),
      session_id: pull.id,
      prescribed_set_id: pullSet.id,
      exercise_id: 'Barbell_Squat',
      reps: 8,
      kg: 50,
    });

    expect(wrongSession.error?.code).toBe('23503');
    expect(wrongExercise.error?.code).toBe('23503');
  });
});
