import { beforeAll, describe, expect, it } from 'vitest';
import { createLifterWithBlock, todayPlanAt, type LifterWithBlock } from './harness/programming';
import { createTestUser, type TestUser } from './harness/users';

const BLOCK_START = '2026-06-01';
const PROGRAMMING_TABLES = [
  'day_templates',
  'day_template_exercises',
  'blocks',
  'block_days',
  'sessions',
  'prescribed_sets',
] as const;
type ProgrammingTable = (typeof PROGRAMMING_TABLES)[number];

describe('programming rows are private to their owner', () => {
  let a: LifterWithBlock;
  let b: TestUser;
  const aRowIds = {} as Record<ProgrammingTable, string[]>;

  beforeAll(async () => {
    [a, b] = await Promise.all([
      createLifterWithBlock({ startDate: BLOCK_START, label: 'a' }),
      createTestUser({ label: 'b', metadata: { timezone: 'Europe/London' } }),
    ]);
    for (const table of PROGRAMMING_TABLES) {
      const { data, error } = await a.user.client.from(table).select('id');
      expect(error).toBeNull();
      expect(data!.length).toBeGreaterThan(0);
      aRowIds[table] = data!.map((r) => r.id);
    }
  });

  it.each(PROGRAMMING_TABLES)("B can't read A's %s", async (table) => {
    const { data, error } = await b.client.from(table).select('id').in('id', aRowIds[table]);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it.each(PROGRAMMING_TABLES)("B can't change or delete A's %s", async (table) => {
    const ids = aRowIds[table];
    const updated = await b.client
      .from(table)
      .update({ user_id: b.id })
      .in('id', ids)
      .select('id');
    const deleted = await b.client.from(table).delete().in('id', ids).select('id');

    expect(updated).toMatchObject({ data: [], error: null });
    expect(deleted).toMatchObject({ data: [], error: null });
    const { data } = await a.user.client.from(table).select('id').in('id', ids);
    expect(data).toHaveLength(ids.length);
  });

  it("B can't create programming rows in A's name", async () => {
    const { error } = await b.client.from('day_templates').insert({ user_id: a.user.id, name: 'Sneaky' });

    expect(error?.code).toBe('42501');
  });

  it("B can't hang their own rows off A's block or session", async () => {
    const [bTemplate] = (
      await b.client.from('day_templates').insert({ name: 'B push' }).select('id')
    ).data!;
    const aSession = a.sessions[0]!;

    const session = await b.client.from('sessions').insert({
      block_id: a.blockId,
      day_template_id: bTemplate!.id,
      training_week_start: BLOCK_START,
      scheduled_date: BLOCK_START,
    });
    const set = await b.client.from('prescribed_sets').insert({
      session_id: aSession.id,
      exercise_id: 'Barbell_Squat',
      position: 9,
      set_index: 1,
      min_reps: 5,
      max_reps: 5,
    });

    expect(session.error?.code).toBe('23503');
    expect(set.error?.code).toBe('23503');
  });

  it("today_plan only ever returns the caller's own data", async () => {
    const at = '2026-06-01T09:00:00+01:00';

    const asA = await todayPlanAt(a.user.client, at);
    const asB = await todayPlanAt(b.client, at);

    expect(asA.session?.id).toBe(a.sessions[0]!.id);
    expect(asB).toMatchObject({ session: null, reason: 'no_active_block' });
  });
});

describe('one active block per lifter', () => {
  it('a second active block for the same lifter is refused', async () => {
    const lifter = await createLifterWithBlock({ startDate: BLOCK_START });

    const { error } = await lifter.user.client
      .from('blocks')
      .insert({ split_name: 'Upper · Lower', start_date: '2026-06-08', status: 'active' });

    expect(error?.code).toBe('23505');
  });

  it('a draft block alongside the active one is fine, as are active blocks for different lifters', async () => {
    const [one, two] = await Promise.all([
      createLifterWithBlock({ startDate: BLOCK_START }),
      createLifterWithBlock({ startDate: BLOCK_START }),
    ]);

    const { error } = await one.user.client
      .from('blocks')
      .insert({ split_name: 'Upper · Lower', start_date: '2026-08-24', status: 'draft' });

    expect(error).toBeNull();
    expect(two.blockId).not.toBe(one.blockId);
  });

  it('a block must start on a Monday', async () => {
    const user = await createTestUser();

    const { error } = await user.client
      .from('blocks')
      .insert({ split_name: 'PPL', start_date: '2026-06-02', status: 'draft' });

    expect(error?.code).toBe('23514');
  });
});
