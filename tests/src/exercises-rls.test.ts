import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { createTwoTestUsers, type TestUser } from './harness/users';

const SEEDED_ID = 'Barbell_Squat';

function customId(label: string) {
  return `custom:${label}-${randomUUID().slice(0, 8)}`;
}

describe("seeded exercises: everyone reads them, nobody changes them", () => {
  let a: TestUser;
  let b: TestUser;

  beforeEach(async () => {
    [a, b] = await createTwoTestUsers();
  });

  async function seededName() {
    const { data } = await a.client.from('exercises').select('name').eq('id', SEEDED_ID).single();
    return data?.name;
  }

  it('both users can read the same seeded exercise', async () => {
    for (const user of [a, b]) {
      const { data } = await user.client.from('exercises').select('id').eq('id', SEEDED_ID);
      expect(data).toEqual([{ id: SEEDED_ID }]);
    }
  });

  it("neither user can insert a seeded exercise", async () => {
    for (const user of [a, b]) {
      const { error } = await user.client
        .from('exercises')
        .insert({ id: `Fake_Seed_${randomUUID().slice(0, 8)}`, name: 'Fake', source: 'seed', user_id: null });
      expect(error?.code).toBe('42501');
    }
  });

  it("neither user can update a seeded exercise", async () => {
    for (const user of [a, b]) {
      const { data } = await user.client
        .from('exercises')
        .update({ name: 'Renamed', movement_pattern: 'core' })
        .eq('id', SEEDED_ID)
        .select();
      expect(data).toEqual([]);
    }
    expect(await seededName()).toBe('Barbell Squat');
  });

  it("neither user can delete a seeded exercise", async () => {
    for (const user of [a, b]) {
      const { data } = await user.client.from('exercises').delete().eq('id', SEEDED_ID).select();
      expect(data).toEqual([]);
    }
    expect(await seededName()).toBe('Barbell Squat');
  });
});

describe('custom exercises: owner-only', () => {
  let a: TestUser;
  let b: TestUser;

  beforeEach(async () => {
    [a, b] = await createTwoTestUsers();
  });

  it('a user can create, read, update and delete their own custom exercise', async () => {
    const id = customId('hammer-strength-row');

    const created = await a.client
      .from('exercises')
      .insert({ id, name: 'Hammer Strength Row', equipment: 'machine', primary_muscles: ['middle back'] })
      .select('id, name, source, user_id')
      .single();
    expect(created.error).toBeNull();
    expect(created.data).toEqual({ id, name: 'Hammer Strength Row', source: 'custom', user_id: a.id });

    const updated = await a.client
      .from('exercises')
      .update({ name: 'Hammer Strength Iso Row', movement_pattern: 'horizontal_pull', body_region: 'upper' })
      .eq('id', id)
      .select('name, movement_pattern, body_region')
      .single();
    expect(updated.data).toEqual({ name: 'Hammer Strength Iso Row', movement_pattern: 'horizontal_pull', body_region: 'upper' });

    const deleted = await a.client.from('exercises').delete().eq('id', id).select('id');
    expect(deleted.data).toEqual([{ id }]);

    const read = await a.client.from('exercises').select('id').eq('id', id);
    expect(read.data).toEqual([]);
  });

  it('a custom exercise ID must look like custom:<slug>', async () => {
    const { error } = await a.client.from('exercises').insert({ id: 'My Machine', name: 'My Machine' });
    expect(error?.code).toBe('23514');
  });

  describe("another user's custom exercise", () => {
    let id: string;

    beforeEach(async () => {
      id = customId('belt-squat');
      const { error } = await a.client.from('exercises').insert({ id, name: 'Belt Squat' });
      expect(error).toBeNull();
    });

    async function aName() {
      const { data } = await a.client.from('exercises').select('name').eq('id', id).single();
      return data?.name;
    }

    it("is invisible to user B", async () => {
      const { data } = await b.client.from('exercises').select('id').eq('id', id);
      expect(data).toEqual([]);
    });

    it("can't be updated by user B", async () => {
      const { data } = await b.client.from('exercises').update({ name: 'Hijacked' }).eq('id', id).select();
      expect(data).toEqual([]);
      expect(await aName()).toBe('Belt Squat');
    });

    it("can't be deleted by user B", async () => {
      const { data } = await b.client.from('exercises').delete().eq('id', id).select();
      expect(data).toEqual([]);
      expect(await aName()).toBe('Belt Squat');
    });

    it("can't be created in user A's name by user B", async () => {
      const { error } = await b.client
        .from('exercises')
        .insert({ id: customId('spoof'), name: 'Spoof', user_id: a.id });
      expect(error?.code).toBe('42501');
    });
  });
});
