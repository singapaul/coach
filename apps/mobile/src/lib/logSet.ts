import { logSet as sendLoggedSet, type LoggedSetInsert } from '@coach/db-types/logged-sets';
import { randomUUID } from 'expo-crypto';
import { supabase } from './supabase';

/** A logged set ready to send. The UUID is created here, once, so every retry sends the same row. */
export function newLoggedSet(set: Omit<LoggedSetInsert, 'id' | 'user_id'>): LoggedSetInsert {
  return { id: randomUUID(), performed_at: new Date().toISOString(), ...set };
}

/** Sends a logged set as the signed-in lifter. Safe to resend: see `logSet` in @coach/db-types. */
export function logSet(set: LoggedSetInsert) {
  return sendLoggedSet(supabase, set);
}
