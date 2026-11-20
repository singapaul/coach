import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTwoTestUsers, type TestUser } from './harness/users';

// From the shortlist seed: tagged horizontal_push / upper.
const TAGGED = 'Barbell_Bench_Press_-_Medium_Grip';
// In free-exercise-db but not on the shortlist, so it has no tags.
const UNTAGGED = '3_4_Sit-Up';

async function eligibleIds(user: TestUser, ids: string[]) {
  const { data, error } = await user.client.rpc('coach_eligible_exercises').select('id').in('id', ids);
  expect(error).toBeNull();
  return (data ?? []).map((r) => r.id).sort();
}

describe('exercises eligible for the coach', () => {
  let a: TestUser;
  let b: TestUser;

  beforeEach(async () => {
    [a, b] = await createTwoTestUsers();
  });

  it('a tagged exercise with no preferences is eligible', async () => {
    expect(await eligibleIds(a, [TAGGED])).toEqual([TAGGED]);
  });

  it('an untagged exercise is not eligible', async () => {
    expect(await eligibleIds(a, [UNTAGGED])).toEqual([]);
  });

  it('is not eligible with only a movement pattern, or only a body region', async () => {
    const patternOnly = `custom:pattern-only-${randomUUID().slice(0, 8)}`;
    const regionOnly = `custom:region-only-${randomUUID().slice(0, 8)}`;
    const both = `custom:both-${randomUUID().slice(0, 8)}`;
    const { error } = await a.client.from('exercises').insert([
      { id: patternOnly, name: 'Pattern only', movement_pattern: 'squat' },
      { id: regionOnly, name: 'Region only', body_region: 'lower' },
      { id: both, name: 'Both', movement_pattern: 'squat', body_region: 'lower' },
    ]);
    expect(error).toBeNull();

    expect(await eligibleIds(a, [patternOnly, regionOnly, both])).toEqual([both]);
  });

  it('a tagged exercise marked unavailable is not eligible', async () => {
    await a.client.from('user_exercise_prefs').insert({ exercise_id: TAGGED, available: false });

    expect(await eligibleIds(a, [TAGGED])).toEqual([]);
  });

  it('a tagged exercise marked avoid is not eligible', async () => {
    await a.client.from('user_exercise_prefs').insert({ exercise_id: TAGGED, avoid: true });

    expect(await eligibleIds(a, [TAGGED])).toEqual([]);
  });

  it('a tagged exercise that is available, a favourite and not avoided stays eligible', async () => {
    await a.client
      .from('user_exercise_prefs')
      .insert({ exercise_id: TAGGED, available: true, favourite: true, avoid: false });

    expect(await eligibleIds(a, [TAGGED])).toEqual([TAGGED]);
  });

  it("my preferences don't change what's eligible for another user", async () => {
    await a.client.from('user_exercise_prefs').insert({ exercise_id: TAGGED, avoid: true });

    expect(await eligibleIds(b, [TAGGED])).toEqual([TAGGED]);
  });

  it("another user's tagged custom exercise is never eligible for me", async () => {
    const id = `custom:private-${randomUUID().slice(0, 8)}`;
    await a.client.from('exercises').insert({ id, name: 'Private', movement_pattern: 'hinge', body_region: 'lower' });

    expect(await eligibleIds(a, [id])).toEqual([id]);
    expect(await eligibleIds(b, [id])).toEqual([]);
  });
});
