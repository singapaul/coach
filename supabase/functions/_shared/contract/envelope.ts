import { z } from 'zod';

/**
 * An ISO 8601 timestamp in UTC with a trailing `Z`, e.g. `2026-11-20T07:30:00.123456Z`.
 * Offsets such as `+00:00` are rejected, so SQL must format `generated_at` explicitly
 * rather than rely on `to_json(now())`.
 */
export const isoDateTimeUtc = z.iso.datetime();

/** A calendar date, `YYYY-MM-DD`, in the lifter's time zone unless stated otherwise. */
export const isoDate = z.iso.date();

/** The fields every published object starts with. */
export const envelopeSchema = z.object({
  version: z.number().int().positive(),
  generated_at: isoDateTimeUtc,
});

/** The fields every published object starts with. */
export type Envelope = z.infer<typeof envelopeSchema>;

/**
 * Builds the schema for one version of a published object: `version`,
 * `generated_at`, then the period field (e.g. `{ date: isoDate }`), followed
 * by the data fields, all at the top level.
 *
 * ```ts
 * const todayPlanV1 = definePublishedObject({
 *   version: 1,
 *   period: { date: isoDate },
 *   data: { session: sessionSchema.nullable() },
 * });
 * type TodayPlanV1 = z.infer<typeof todayPlanV1>;
 * ```
 */
export function definePublishedObject<
  const V extends number,
  P extends z.ZodRawShape,
  D extends z.ZodRawShape,
>(definition: { version: V; period: P; data: D }) {
  return z.object({
    version: z.literal(definition.version),
    generated_at: isoDateTimeUtc,
    ...definition.period,
    ...definition.data,
  });
}
