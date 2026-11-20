import { todayPlanV1 } from '@coach/contract';
import { beforeAll, describe, expect, it } from 'vitest';
import { addDays, SEED_LIFTER } from './harness/programming';
import { anonClient, type Client } from './harness/users';

describe('the seeded starting block', () => {
  let client: Client;

  beforeAll(async () => {
    client = anonClient();
    const { error } = await client.auth.signInWithPassword(SEED_LIFTER);
    expect(error).toBeNull();
  });

  it('the local test user can sign in and has a London profile', async () => {
    const { data } = await client.from('profiles').select('timezone').single();

    expect(data?.timezone).toBe('Europe/London');
  });

  it('has one active Push/Pull/Legs block of 12 weeks, created by the user, starting on a Monday', async () => {
    const { data: blocks } = await client.from('blocks').select('*');

    expect(blocks).toHaveLength(1);
    const block = blocks![0]!;
    expect(block).toMatchObject({ split_name: 'Push · Pull · Legs', status: 'active', length_weeks: 12, created_by: 'user' });
    expect(new Date(`${block.start_date}T00:00:00Z`).getUTCDay()).toBe(1);
  });

  it('has Push, Pull and Legs day templates of 5–6 coach-eligible exercises: 3 × 6–8 compound, 3 × 10–15 isolation', async () => {
    const { data: templates } = await client
      .from('day_templates')
      .select('name, day_template_exercises(exercise_id, position, sets, min_reps, max_reps, rest_s, exercises(mechanic))')
      .order('name');

    expect(templates!.map((t) => t.name)).toEqual(['Legs', 'Pull', 'Push']);
    const { data: eligible } = await client.rpc('coach_eligible_exercises').select('id');
    const eligibleIds = new Set(eligible!.map((e) => e.id));

    for (const t of templates!) {
      expect(t.day_template_exercises.length).toBeGreaterThanOrEqual(5);
      expect(t.day_template_exercises.length).toBeLessThanOrEqual(6);
      for (const e of t.day_template_exercises) {
        expect(eligibleIds.has(e.exercise_id)).toBe(true);
        const expected = e.exercises?.mechanic === 'compound' ? [3, 6, 8] : [3, 10, 15];
        expect([e.sets, e.min_reps, e.max_reps], `${t.name}: ${e.exercise_id}`).toEqual(expected);
      }
    }
  });

  it("has only week 1's sessions, Push Monday, Pull Wednesday, Legs Friday, with calibration sets", async () => {
    const { data: block } = await client.from('blocks').select('start_date').single();
    const { data: sessions } = await client
      .from('sessions')
      .select('scheduled_date, training_week_start, status, day_templates(name, day_template_exercises(sets)), prescribed_sets(target_kg)')
      .order('scheduled_date');

    const start = block!.start_date;
    expect(sessions!.map((s) => [s.day_templates?.name, s.scheduled_date, s.training_week_start, s.status])).toEqual([
      ['Push', start, start, 'planned'],
      ['Pull', addDays(start, 2), start, 'planned'],
      ['Legs', addDays(start, 4), start, 'planned'],
    ]);
    for (const s of sessions!) {
      const prescribed = s.day_templates!.day_template_exercises.reduce((n, e) => n + e.sets, 0);
      expect(s.prescribed_sets).toHaveLength(prescribed);
      expect(s.prescribed_sets.every((p) => p.target_kg === null)).toBe(true);
    }
  });

  it('has a favourite from the block, and an avoided and an unavailable exercise outside it, which the coach may not use', async () => {
    const { data: prefs } = await client
      .from('user_exercise_prefs')
      .select('exercise_id, available, favourite, avoid')
      .order('exercise_id');
    const { data: inTemplates } = await client.from('day_template_exercises').select('exercise_id');
    const templateIds = new Set(inTemplates!.map((e) => e.exercise_id));
    const { data: eligible } = await client
      .rpc('coach_eligible_exercises')
      .select('id')
      .in('id', ['Barbell_Deadlift', 'Hack_Squat', 'Barbell_Bench_Press_-_Medium_Grip']);

    expect(prefs).toEqual([
      { exercise_id: 'Barbell_Bench_Press_-_Medium_Grip', available: true, favourite: true, avoid: false },
      { exercise_id: 'Barbell_Deadlift', available: true, favourite: false, avoid: true },
      { exercise_id: 'Hack_Squat', available: false, favourite: false, avoid: false },
    ]);
    expect(templateIds.has('Barbell_Bench_Press_-_Medium_Grip')).toBe(true);
    expect(templateIds.has('Barbell_Deadlift')).toBe(false);
    expect(templateIds.has('Hack_Squat')).toBe(false);
    expect(eligible).toEqual([{ id: 'Barbell_Bench_Press_-_Medium_Grip' }]);
  });

  it("today_plan answers for the seeded user in the v1 shape", async () => {
    const { data, error } = await client.rpc('today_plan');

    expect(error).toBeNull();
    expect(() => todayPlanV1.parse(data)).not.toThrow();
  });
});
