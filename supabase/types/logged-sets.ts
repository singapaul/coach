import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database';

/** A logged set as sent to PostgREST, from the generated types. `id` is created by the app. */
export type LoggedSetInsert = Database['public']['Tables']['logged_sets']['Insert'];

/**
 * Logs a set: a direct PostgREST insert of a row whose UUID the app created,
 * sent with ON CONFLICT (id) DO NOTHING, so resending the same row after a
 * dropped response changes nothing and doesn't fail. First write wins.
 *
 * The one way to write a logged set: the app passes its signed-in client, the
 * API tests pass theirs.
 */
export function logSet(client: SupabaseClient<Database>, set: LoggedSetInsert) {
  return client.from('logged_sets').upsert(set, { onConflict: 'id', ignoreDuplicates: true });
}
