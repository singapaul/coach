import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@coach/db-types';
import { inject } from 'vitest';

export type Client = SupabaseClient<Database>;

export type TestUser = {
  id: string;
  email: string;
  /** A supabase-js client signed in as this user, the way the app would be. */
  client: Client;
};

const TEST_PASSWORD = 'test-password-123';

function stack() {
  return inject('stack');
}

function newClient(key: string): Client {
  return createClient<Database>(stack().apiUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** A client with no session: what the app has before anyone signs in. */
export function anonClient(): Client {
  return newClient(stack().anonKey);
}

/** Bypasses RLS. Use only to arrange test data, never to check behaviour. */
export function adminClient(): Client {
  return newClient(stack().serviceRoleKey);
}

export function uniqueEmail(label = 'user'): string {
  return `${label}-${randomUUID()}@test.local`;
}

/**
 * Creates a real, confirmed auth user with a unique email and returns a client
 * signed in as them. Each call makes a fresh user, so tests never share state.
 */
export async function createTestUser(
  options: { label?: string; metadata?: Record<string, unknown> } = {},
): Promise<TestUser> {
  const email = uniqueEmail(options.label);
  const { data: created, error: createError } = await adminClient().auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: options.metadata,
  });
  if (createError) throw createError;

  const client = anonClient();
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: TEST_PASSWORD,
  });
  if (signInError) throw signInError;

  return { id: created.user.id, email, client };
}

/** Two independent signed-in users, for "B can't touch A's rows" tests. */
export async function createTwoTestUsers(): Promise<[TestUser, TestUser]> {
  return Promise.all([createTestUser({ label: 'a' }), createTestUser({ label: 'b' })]);
}
