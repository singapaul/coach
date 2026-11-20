import { z } from 'zod';
import { definePublishedObject, isoDate, isoDateTimeUtc } from './envelope.ts';

/** A set already logged against a prescribed set, oldest first. */
export const loggedSetV1 = z.object({
  /** Created by the app when the set was logged. */
  id: z.uuid(),
  performed_at: isoDateTimeUtc,
  reps: z.number().int().nonnegative(),
  kg: z.number().nonnegative(),
  rpe: z.number().min(1).max(10).nullable(),
});

export const prescribedSetV1 = z.object({
  id: z.uuid(),
  set_index: z.number().int().positive(),
  min_reps: z.number().int().positive(),
  max_reps: z.number().int().positive(),
  /** `null` means a calibration week: lift what feels right. */
  target_kg: z.number().nonnegative().nullable(),
  logged_sets: z.array(loggedSetV1),
});

export const sessionExerciseV1 = z.object({
  /** Order within the session, starting at 1. */
  position: z.number().int().positive(),
  exercise_id: z.string().min(1),
  name: z.string().min(1),
  /** Rest between sets, from the day template; `null` if the template no longer lists it. */
  rest_s: z.number().int().nonnegative().nullable(),
  prescribed_sets: z.array(prescribedSetV1),
});

export const sessionStatus = z.enum(['planned', 'done', 'skipped']);

export const todayPlanSessionV1 = z.object({
  id: z.uuid(),
  day_template_name: z.string().min(1),
  scheduled_date: isoDate,
  status: sessionStatus,
  /** Which week of the block this session is in, starting at 1. */
  block_week: z.number().int().positive(),
  block_length_weeks: z.number().int().positive(),
  exercises: z.array(sessionExerciseV1),
});

/** Why there's no session today. */
export const noSessionReason = z.enum(['no_active_block', 'no_session_today']);

/**
 * today_plan v1: today's session (today in the lifter's time zone), or `null`
 * with the reason there isn't one.
 */
export const todayPlanV1 = z.union([
  definePublishedObject({
    version: 1,
    period: { date: isoDate },
    data: { session: todayPlanSessionV1, reason: z.null() },
  }),
  definePublishedObject({
    version: 1,
    period: { date: isoDate },
    data: { session: z.null(), reason: noSessionReason },
  }),
]);

export type TodayPlanV1 = z.infer<typeof todayPlanV1>;
export type TodayPlanSessionV1 = z.infer<typeof todayPlanSessionV1>;
export type LoggedSetV1 = z.infer<typeof loggedSetV1>;
export type NoSessionReason = z.infer<typeof noSessionReason>;
