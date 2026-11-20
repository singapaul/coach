import { z } from 'zod';

/**
 * An ISO 8601 timestamp in UTC with a trailing `Z`, e.g. `2026-11-20T07:30:00.123456Z`.
 * Offsets such as `+00:00` are rejected, so SQL must format `generated_at` explicitly
 * rather than rely on `to_json(now())`.
 */
export const isoDateTimeUtc = z.iso.datetime();

/** A calendar date, `YYYY-MM-DD`, in the lifter's time zone unless stated otherwise. */
export const isoDate = z.iso.date();

/**
 * The fields every published object starts with: `version`, `generated_at`,
 * then the period field, whose name depends on the object (`date` for
 * today_plan, `week_start` for a weekly object) and whose value is an ISO date.
 */
export function envelopeSchema<const K extends string>(periodKey: K) {
  const period = { [periodKey]: isoDate } as Record<K, typeof isoDate>;
  return z.object({
    version: z.number().int().positive(),
    generated_at: isoDateTimeUtc,
    ...period,
  });
}

/** The fields every published object starts with, e.g. `Envelope<'date'>` for today_plan. */
export type Envelope<K extends string> = z.infer<ReturnType<typeof envelopeSchema<K>>>;

/**
 * Builds the schema for one version of a published object: `version`,
 * `generated_at`, then the period field (e.g. `date`), followed by the data
 * fields, all at the top level.
 *
 * ```ts
 * const todayPlanV1 = definePublishedObject({
 *   version: 1,
 *   period: 'date',
 *   data: { session: sessionSchema.nullable() },
 * });
 * type TodayPlanV1 = z.infer<typeof todayPlanV1>;
 * ```
 */
export function definePublishedObject<
  const V extends number,
  const K extends string,
  D extends z.ZodRawShape,
>(definition: { version: V; period: K; data: D }) {
  return envelopeSchema(definition.period).extend({
    version: z.literal(definition.version),
    ...definition.data,
  });
}
