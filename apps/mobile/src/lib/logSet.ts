import type { Database } from '@coach/db-types';
import { randomUUID } from 'expo-crypto';
import { supabase } from './supabase';

type LoggedSetInsert = Database['public']['Tables']['logged_sets']['Insert'];

/** A logged set ready to send. The UUID is created here, once, so every retry sends the same row. */
export function newLoggedSet(set: Omit<LoggedSetInsert, 'id' | 'user_id'>): LoggedSetInsert {
  return { id: randomUUID(), performed_at: new Date().toISOString(), ...set };
}

/**
 * Sends a logged set straight to PostgREST with ON CONFLICT (id) DO NOTHING,
 * so resending the same row after a dropped response changes nothing.
 */
export async function logSet(set: LoggedSetInsert) {
  return supabase.from('logged_sets').upsert(set, { onConflict: 'id', ignoreDuplicates: true });
}
