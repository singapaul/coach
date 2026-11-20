import { describe, expect, it } from 'vitest';
import { createLifterWithBlock, todayPlanAt } from './harness/programming';

// Week 1 runs Monday 1 June to Sunday 7 June 2026 (British Summer Time).
// PPL: Push Monday 1, Pull Wednesday 3, Legs Friday 5.
const BLOCK_START = '2026-06-01';

async function moveSession(client: Parameters<typeof todayPlanAt>[0], sessionId: string, scheduledDate: string) {
  return client.from('sessions').update({ scheduled_date: scheduledDate }).eq('id', sessionId).select('id, scheduled_date');
}

describe('moving a session within its training week', () => {
  it("moves Wednesday's Pull to Thursday, and today's plan follows it", async () => {
    const lifter = await createLifterWithBlock({ startDate: BLOCK_START });
    const pull = lifter.sessions.find((s) => s.dayTemplateName === 'Pull')!;

    const { data, error } = await moveSession(lifter.user.client, pull.id, '2026-06-04');
    expect(error).toBeNull();
    expect(data).toEqual([{ id: pull.id, scheduled_date: '2026-06-04' }]);

    const thursday = await todayPlanAt(lifter.user.client, '2026-06-04T07:00:00+01:00');
    expect(thursday.session).toMatchObject({ id: pull.id, day_template_name: 'Pull', scheduled_date: '2026-06-04', status: 'planned' });

    const wednesday = await todayPlanAt(lifter.user.client, '2026-06-03T07:00:00+01:00');
    expect(wednesday).toMatchObject({ date: '2026-06-03', session: null, reason: 'no_session_today' });
  });

  it.each([
    ['the previous Sunday', '2026-05-31'],
    ['the next Monday', '2026-06-08'],
  ])('refuses moving a session to %s, outside its training week', async (_label, target) => {
    const lifter = await createLifterWithBlock({ startDate: BLOCK_START });
    const pull = lifter.sessions.find((s) => s.dayTemplateName === 'Pull')!;

    const { error } = await moveSession(lifter.user.client, pull.id, target);
    expect(error?.code).toBe('23514');

    const plan = await todayPlanAt(lifter.user.client, '2026-06-03T07:00:00+01:00');
    expect(plan.session).toMatchObject({ id: pull.id, scheduled_date: '2026-06-03' });
  });

  it('refuses moving a session to another week even when its training week is changed with it', async () => {
    const lifter = await createLifterWithBlock({ startDate: BLOCK_START });
    const pull = lifter.sessions.find((s) => s.dayTemplateName === 'Pull')!;

    const { error } = await lifter.user.client
      .from('sessions')
      .update({ scheduled_date: '2026-06-10', training_week_start: '2026-06-08' })
      .eq('id', pull.id)
      .select('id');
    expect(error?.code).toBe('23514');

    const nextWednesday = await todayPlanAt(lifter.user.client, '2026-06-10T07:00:00+01:00');
    expect(nextWednesday.session).toBeNull();
    const wednesday = await todayPlanAt(lifter.user.client, '2026-06-03T07:00:00+01:00');
    expect(wednesday.session).toMatchObject({ id: pull.id, scheduled_date: '2026-06-03' });
  });

  it("uses the profile's time zone at the week boundary: Sunday 23:30 in New York is still that week", async () => {
    const lifter = await createLifterWithBlock({ startDate: BLOCK_START, timezone: 'America/New_York' });
    const legs = lifter.sessions.find((s) => s.dayTemplateName === 'Legs')!;

    // Friday's Legs moves to Sunday 7 June, the last day of week 1.
    const { error } = await moveSession(lifter.user.client, legs.id, '2026-06-07');
    expect(error).toBeNull();

    // 23:30 Sunday in New York is already 03:30 Monday in UTC (the next week).
    const lateSunday = await todayPlanAt(lifter.user.client, '2026-06-07T23:30:00-04:00');
    expect(lateSunday).toMatchObject({ date: '2026-06-07', reason: null });
    expect(lateSunday.session).toMatchObject({ id: legs.id, scheduled_date: '2026-06-07', block_week: 1 });

    // Moving it on to Monday 8 June, the next week, is refused.
    const { error: nextWeekError } = await moveSession(lifter.user.client, legs.id, '2026-06-08');
    expect(nextWeekError?.code).toBe('23514');
  });

  it('refuses moving a session into another block', async () => {
    const lifter = await createLifterWithBlock({ startDate: BLOCK_START });
    const pull = lifter.sessions.find((s) => s.dayTemplateName === 'Pull')!;
    const { data: draft, error: draftError } = await lifter.user.client
      .from('blocks')
      .insert({ split_name: 'Next block', start_date: BLOCK_START, status: 'draft', created_by: 'user' })
      .select('id')
      .single();
    expect(draftError).toBeNull();

    const { error } = await lifter.user.client.from('sessions').update({ block_id: draft!.id }).eq('id', pull.id).select('id');
    expect(error?.code).toBe('23514');

    const plan = await todayPlanAt(lifter.user.client, '2026-06-03T07:00:00+01:00');
    expect(plan.session).toMatchObject({ id: pull.id, block_week: 1 });
  });
});
