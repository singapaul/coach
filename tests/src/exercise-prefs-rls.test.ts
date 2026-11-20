import { beforeEach, describe, expect, it } from 'vitest';
import { createTwoTestUsers, type TestUser } from './harness/users';

const EXERCISE = 'Barbell_Deadlift';

describe("exercise preferences: another user can't touch mine", () => {
  let a: TestUser;
  let b: TestUser;

  beforeEach(async () => {
    [a, b] = await createTwoTestUsers();
    const { error } = await a.client
      .from('user_exercise_prefs')
      .insert({ exercise_id: EXERCISE, favourite: true, notes: 'hook grip' });
    expect(error).toBeNull();
  });

  async function aPrefs() {
    const { data } = await a.client
      .from('user_exercise_prefs')
      .select('available, favourite, avoid, notes')
      .eq('exercise_id', EXERCISE)
      .single();
    return data;
  }

  it('a new preference defaults to available, not avoided', async () => {
    expect(await aPrefs()).toEqual({ available: true, favourite: true, avoid: false, notes: 'hook grip' });
  });

  it("user B can't read user A's preferences", async () => {
    const { data, error } = await b.client.from('user_exercise_prefs').select('*').eq('user_id', a.id);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("user B can't update user A's preferences", async () => {
    const { data } = await b.client
      .from('user_exercise_prefs')
      .update({ avoid: true, notes: 'hijacked' })
      .eq('user_id', a.id)
      .select();
    expect(data).toEqual([]);
    expect(await aPrefs()).toEqual({ available: true, favourite: true, avoid: false, notes: 'hook grip' });
  });

  it("user B can't delete user A's preferences", async () => {
    const { data } = await b.client.from('user_exercise_prefs').delete().eq('user_id', a.id).select();
    expect(data).toEqual([]);
    expect(await aPrefs()).not.toBeNull();
  });

  it("user B can't create preferences in user A's name", async () => {
    const { error } = await b.client
      .from('user_exercise_prefs')
      .insert({ user_id: a.id, exercise_id: 'Barbell_Squat', avoid: true });
    expect(error?.code).toBe('42501');
  });

  it('user B keeps their own preference for the same exercise', async () => {
    const { error } = await b.client.from('user_exercise_prefs').insert({ exercise_id: EXERCISE, avoid: true });
    expect(error).toBeNull();
    expect(await aPrefs()).toMatchObject({ avoid: false });
  });
});
