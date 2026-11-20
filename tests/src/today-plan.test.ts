import { describe, expect, it } from 'vitest';
import { todayPlanV1 } from '@coach/contract';
import { createLifterWithBlock, PPL_DAYS, todayPlanAt } from './harness/programming';
import { anonClient, createTestUser } from './harness/users';

// A Monday in British Summer Time. Nothing here depends on the real date:
// every call passes "now" explicitly to today_plan_at.
const BLOCK_START = '2026-06-01';

describe("today's plan", () => {
  it('on a scheduled day returns that session, its exercises in order and calibration sets', async () => {
    const lifter = await createLifterWithBlock({ startDate: BLOCK_START });
    const pull = lifter.sessions.find((s) => s.dayTemplateName === 'Pull')!;

    // Wednesday 3 June, 07:00 in London.
    const plan = await todayPlanAt(lifter.user.client, '2026-06-03T07:00:00+01:00');

    expect(plan.version).toBe(1);
    expect(plan.date).toBe('2026-06-03');
    expect(plan.reason).toBeNull();
    expect(plan.session).toMatchObject({
      id: pull.id,
      day_template_name: 'Pull',
      scheduled_date: '2026-06-03',
      status: 'planned',
      block_week: 1,
      block_length_weeks: 12,
    });
    expect(plan.session!.exercises.map((e) => [e.position, e.exercise_id, e.name, e.rest_s])).toEqual([
      [1, 'Bent_Over_Barbell_Row', 'Bent Over Barbell Row', 180],
      [2, 'Wide-Grip_Lat_Pulldown', 'Wide-Grip Lat Pulldown', 150],
      [3, 'Barbell_Curl', 'Barbell Curl', 90],
    ]);
    expect(plan.session!.exercises[0]!.prescribed_sets.map((s) => [s.set_index, s.min_reps, s.max_reps, s.target_kg, s.logged_sets])).toEqual([
      [1, 6, 8, null, []],
      [2, 6, 8, null, []],
      [3, 6, 8, null, []],
    ]);
    expect(plan.session!.exercises[2]!.prescribed_sets.map((s) => [s.min_reps, s.max_reps])).toEqual([
      [10, 15],
      [10, 15],
      [10, 15],
    ]);
  });

  it('on a rest day returns no session, with reason no_session_today', async () => {
    const lifter = await createLifterWithBlock({ startDate: BLOCK_START });

    // Tuesday 2 June: PPL runs Monday, Wednesday, Friday.
    const plan = await todayPlanAt(lifter.user.client, '2026-06-02T12:00:00+01:00');

    expect(plan).toMatchObject({ date: '2026-06-02', session: null, reason: 'no_session_today' });
  });

  it('with no active block returns no session, with reason no_active_block', async () => {
    const user = await createTestUser({ metadata: { timezone: 'Europe/London' } });

    const plan = await todayPlanAt(user.client, '2026-06-03T07:00:00+01:00');

    expect(plan).toMatchObject({ date: '2026-06-03', session: null, reason: 'no_active_block' });
  });

  it('ignores a block that is only a draft or already done', async () => {
    const lifter = await createLifterWithBlock({ startDate: BLOCK_START });
    const { error } = await lifter.user.client.from('blocks').update({ status: 'done' }).eq('id', lifter.blockId);
    expect(error).toBeNull();

    const plan = await todayPlanAt(lifter.user.client, '2026-06-03T07:00:00+01:00');

    expect(plan).toMatchObject({ session: null, reason: 'no_active_block' });
  });

  it('counts the block week from the block start', async () => {
    const lifter = await createLifterWithBlock({ startDate: '2026-05-18', lengthWeeks: 8 });
    // A week-3 session, as the Sunday review would create it.
    const { data: session, error } = await lifter.user.client
      .from('sessions')
      .insert({
        block_id: lifter.blockId,
        day_template_id: lifter.dayTemplateIds.Legs!,
        training_week_start: '2026-06-01',
        scheduled_date: '2026-06-05',
      })
      .select('id')
      .single();
    expect(error).toBeNull();

    const plan = await todayPlanAt(lifter.user.client, '2026-06-05T18:00:00+01:00');

    expect(plan.session).toMatchObject({ id: session!.id, block_week: 3, block_length_weeks: 8, exercises: [] });
  });

  describe("day boundaries use the profile's time zone", () => {
    // A Sunday session so the boundary between Sunday and Monday matters.
    const SUNDAY_DAYS = [{ ...PPL_DAYS[2]!, name: 'Legs', weekday: 7 as const }];

    it("at 23:30 on a Sunday in British Summer Time it's still Sunday's plan", async () => {
      const lifter = await createLifterWithBlock({ startDate: BLOCK_START, days: SUNDAY_DAYS });

      const plan = await todayPlanAt(lifter.user.client, '2026-06-07T23:30:00+01:00');

      expect(plan.date).toBe('2026-06-07');
      expect(plan.session?.id).toBe(lifter.sessions[0]!.id);
    });

    it("at 00:30 on Monday in British Summer Time (still Sunday in UTC) it's Monday's plan", async () => {
      const lifter = await createLifterWithBlock({ startDate: BLOCK_START, days: SUNDAY_DAYS });

      const plan = await todayPlanAt(lifter.user.client, '2026-06-08T00:30:00+01:00');

      expect(plan).toMatchObject({ date: '2026-06-08', session: null, reason: 'no_session_today' });
    });

    it("at 23:30 on a Sunday in New York (already Monday in UTC) it's still Sunday's plan", async () => {
      const lifter = await createLifterWithBlock({
        startDate: BLOCK_START,
        days: SUNDAY_DAYS,
        timezone: 'America/New_York',
      });

      const plan = await todayPlanAt(lifter.user.client, '2026-06-07T23:30:00-04:00');

      expect(plan.date).toBe('2026-06-07');
      expect(plan.session?.id).toBe(lifter.sessions[0]!.id);
    });
  });

  it('today_plan with no arguments answers for the real now, in the same v1 shape', async () => {
    const user = await createTestUser({ metadata: { timezone: 'Europe/London' } });

    const { data, error } = await user.client.rpc('today_plan');

    expect(error).toBeNull();
    expect(todayPlanV1.parse(data)).toMatchObject({ session: null, reason: 'no_active_block' });
  });

  it('refuses callers who are not signed in', async () => {
    const { data, error } = await anonClient().rpc('today_plan');

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});
