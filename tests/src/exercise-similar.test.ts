import { beforeEach, describe, expect, it } from 'vitest';
import { createTwoTestUsers, type TestUser } from './harness/users';

describe('exercise_similar (filled in by Step 7)', () => {
  let a: TestUser;
  let b: TestUser;

  beforeEach(async () => {
    [a, b] = await createTwoTestUsers();
  });

  it('exists and starts empty', async () => {
    const { data, error } = await a.client.from('exercise_similar').select('*');
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('is owner-only: user B cannot see, change or delete user A’s links', async () => {
    const link = { exercise_id: 'Barbell_Squat', similar_exercise_id: 'Front_Barbell_Squat', carryover_factor: 0.8 };
    const inserted = await a.client.from('exercise_similar').insert(link).select('carryover_factor').single();
    expect(inserted.error).toBeNull();
    expect(inserted.data).toEqual({ carryover_factor: 0.8 });

    expect((await b.client.from('exercise_similar').select('*')).data).toEqual([]);
    expect(
      (await b.client.from('exercise_similar').update({ carryover_factor: 0.1 }).eq('user_id', a.id).select()).data,
    ).toEqual([]);
    expect((await b.client.from('exercise_similar').delete().eq('user_id', a.id).select()).data).toEqual([]);

    const spoof = await b.client.from('exercise_similar').insert({ ...link, user_id: a.id });
    expect(spoof.error?.code).toBe('42501');

    const stillThere = await a.client.from('exercise_similar').select('carryover_factor');
    expect(stillThere.data).toEqual([{ carryover_factor: 0.8 }]);
  });
});
