import { beforeAll, describe, expect, it } from 'vitest';
import { anonClient, createTwoTestUsers, type TestUser } from './harness/users';

// free-exercise-db at the commit pinned in scripts/generate-exercise-seed.mjs.
const FREE_EXERCISE_DB_COUNT = 876;

describe('seeded exercise library', () => {
  let a: TestUser;
  let b: TestUser;

  beforeAll(async () => {
    [a, b] = await createTwoTestUsers();
  });

  it('every logged-in user can read the full free-exercise-db library', async () => {
    for (const user of [a, b]) {
      const { count, error } = await user.client
        .from('exercises')
        .select('*', { count: 'exact', head: true })
        .eq('source', 'seed');

      expect(error).toBeNull();
      expect(count).toBe(FREE_EXERCISE_DB_COUNT);
    }
  });

  it('a seeded exercise keeps its free-exercise-db ID and details', async () => {
    const { data, error } = await a.client
      .from('exercises')
      .select('id, name, primary_muscles, secondary_muscles, equipment, force, mechanic, category, source, user_id')
      .eq('id', 'Barbell_Bench_Press_-_Medium_Grip')
      .single();

    expect(error).toBeNull();
    expect(data).toEqual({
      id: 'Barbell_Bench_Press_-_Medium_Grip',
      name: 'Barbell Bench Press - Medium Grip',
      primary_muscles: ['chest'],
      secondary_muscles: ['shoulders', 'triceps'],
      equipment: 'barbell',
      force: 'push',
      mechanic: 'compound',
      category: 'strength',
      source: 'seed',
      user_id: null,
    });
  });

  it('the coach shortlist is about 60 tagged exercises covering every movement pattern', async () => {
    const { data, error } = await a.client
      .from('exercises')
      .select('id, movement_pattern, body_region, equipment')
      .eq('source', 'seed')
      .not('movement_pattern', 'is', null);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(50);
    expect(data!.length).toBeLessThanOrEqual(70);
    expect(data!.every((e) => e.body_region !== null)).toBe(true);
    expect(new Set(data!.map((e) => e.movement_pattern))).toEqual(
      new Set(['horizontal_push', 'vertical_push', 'horizontal_pull', 'vertical_pull', 'squat', 'hinge', 'carry', 'core']),
    );
    for (const equipment of ['barbell', 'dumbbell', 'cable', 'machine']) {
      expect(data!.some((e) => e.equipment === equipment)).toBe(true);
    }
  });

  it('a shortlisted exercise carries its movement pattern and body region', async () => {
    const { data } = await a.client
      .from('exercises')
      .select('movement_pattern, body_region')
      .in('id', ['Barbell_Squat', 'Pullups'])
      .order('id');

    expect(data).toEqual([
      { movement_pattern: 'squat', body_region: 'lower' },
      { movement_pattern: 'vertical_pull', body_region: 'upper' },
    ]);
  });

  it("a signed-out client can't read the library", async () => {
    const { data } = await anonClient().from('exercises').select('id').limit(1);

    expect(data ?? []).toEqual([]);
  });
});
