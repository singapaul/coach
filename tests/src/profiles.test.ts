import { describe, expect, it } from 'vitest';
import { anonClient, createTestUser, uniqueEmail } from './harness/users';

describe('profiles', () => {
  it('signing up gives the new user a profile row with their time zone', async () => {
    const client = anonClient();
    const { data, error } = await client.auth.signUp({
      email: uniqueEmail('signup'),
      password: 'test-password-123',
      options: { data: { timezone: 'Europe/London' } },
    });
    expect(error).toBeNull();
    const userId = data.user!.id;

    const { data: profile, error: readError } = await client
      .from('profiles')
      .select('user_id, timezone')
      .single();

    expect(readError).toBeNull();
    expect(profile).toEqual({ user_id: userId, timezone: 'Europe/London' });
  });

  it('a signed-in user can fill in and update their own profile, including timezone', async () => {
    const user = await createTestUser();

    const { error: updateError } = await user.client
      .from('profiles')
      .update({
        height_cm: 180.5,
        birth_year: 1990,
        sex: 'male',
        units: 'imperial',
        training_days_per_week: 4,
        timezone: 'America/New_York',
      })
      .eq('user_id', user.id);
    expect(updateError).toBeNull();

    const { data: profile } = await user.client
      .from('profiles')
      .select('height_cm, birth_year, sex, units, training_days_per_week, timezone')
      .eq('user_id', user.id)
      .single();
    expect(profile).toEqual({
      height_cm: 180.5,
      birth_year: 1990,
      sex: 'male',
      units: 'imperial',
      training_days_per_week: 4,
      timezone: 'America/New_York',
    });
  });

  it('rejects a time zone that is not an IANA name', async () => {
    const user = await createTestUser();

    const { error } = await user.client
      .from('profiles')
      .update({ timezone: 'Mars/Olympus_Mons' })
      .eq('user_id', user.id);

    expect(error?.code).toBe('23514'); // check_violation
  });

  it('a signed-in user can create their own profile if it is missing', async () => {
    const user = await createTestUser();
    await user.client.from('profiles').delete().eq('user_id', user.id);

    // No user_id sent: it defaults to the logged-in user.
    const { data, error } = await user.client
      .from('profiles')
      .insert({ timezone: 'Australia/Sydney' })
      .select('user_id, timezone')
      .single();

    expect(error).toBeNull();
    expect(data).toEqual({ user_id: user.id, timezone: 'Australia/Sydney' });
  });
});
