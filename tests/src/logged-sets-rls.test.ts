import { randomUUID } from 'node:crypto';
import { beforeAll, describe, expect, it } from 'vitest';
import { createLifterWithBlock, logSet, type LifterWithBlock } from './harness/programming';

const BLOCK_START = '2026-06-01';
const BENCH = 'Barbell_Bench_Press_-_Medium_Grip';

describe('logged sets are private to their owner', () => {
  let a: LifterWithBlock;
  let b: LifterWithBlock;
  let aSetId: string;
  let aPrescribedSetId: string;

  beforeAll(async () => {
    [a, b] = await Promise.all([
      createLifterWithBlock({ startDate: BLOCK_START, label: 'a' }),
      createLifterWithBlock({ startDate: BLOCK_START, label: 'b' }),
    ]);
    const { data: prescribed } = await a.user.client
      .from('prescribed_sets')
      .select('id')
      .eq('session_id', a.sessions[0]!.id)
      .eq('exercise_id', BENCH)
      .eq('set_index', 1);
    aPrescribedSetId = prescribed![0]!.id;
    aSetId = randomUUID();
    const { error } = await logSet(a.user.client, {
      id: aSetId,
      session_id: a.sessions[0]!.id,
      prescribed_set_id: aPrescribedSetId,
      exercise_id: BENCH,
      reps: 8,
      kg: 60,
    });
    expect(error).toBeNull();
  });

  async function aSetAsA() {
    const { data } = await a.user.client.from('logged_sets').select('id, user_id, reps, kg').eq('id', aSetId);
    return data;
  }

  it("B can't read A's logged sets", async () => {
    const { data, error } = await b.user.client.from('logged_sets').select('id').eq('id', aSetId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("B can't change or delete A's logged sets", async () => {
    const updated = await b.user.client
      .from('logged_sets')
      .update({ reps: 1, user_id: b.user.id })
      .eq('id', aSetId)
      .select('id');
    const deleted = await b.user.client.from('logged_sets').delete().eq('id', aSetId).select('id');

    expect(updated).toMatchObject({ data: [], error: null });
    expect(deleted).toMatchObject({ data: [], error: null });
    expect(await aSetAsA()).toEqual([{ id: aSetId, user_id: a.user.id, reps: 8, kg: 60 }]);
  });

  it("B resending A's set UUID changes nothing", async () => {
    await logSet(b.user.client, {
      id: aSetId,
      session_id: b.sessions[0]!.id,
      prescribed_set_id: null,
      exercise_id: BENCH,
      reps: 1,
      kg: 1,
    });

    expect(await aSetAsA()).toEqual([{ id: aSetId, user_id: a.user.id, reps: 8, kg: 60 }]);
  });

  it("B can't insert a logged set in A's name", async () => {
    const { error } = await b.user.client.from('logged_sets').insert({
      id: randomUUID(),
      user_id: a.user.id,
      session_id: a.sessions[0]!.id,
      exercise_id: BENCH,
      reps: 8,
      kg: 60,
    });

    expect(error?.code).toBe('42501');
  });

  it("B can't log against A's sessions or prescribed sets", async () => {
    const againstSession = await logSet(b.user.client, {
      id: randomUUID(),
      session_id: a.sessions[0]!.id,
      prescribed_set_id: null,
      exercise_id: BENCH,
      reps: 8,
      kg: 60,
    });
    const againstPrescribedSet = await logSet(b.user.client, {
      id: randomUUID(),
      session_id: b.sessions[0]!.id,
      prescribed_set_id: aPrescribedSetId,
      exercise_id: BENCH,
      reps: 8,
      kg: 60,
    });

    expect(againstSession.error?.code).toBe('23503');
    expect(againstPrescribedSet.error?.code).toBe('23503');
  });
});
