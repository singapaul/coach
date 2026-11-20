import { beforeEach, describe, expect, it } from 'vitest';
import { anonClient, createTwoTestUsers, type TestUser } from './harness/users';

describe("profiles: another user can't touch my profile", () => {
  let a: TestUser;
  let b: TestUser;

  beforeEach(async () => {
    [a, b] = await createTwoTestUsers();
    await a.client.from('profiles').update({ timezone: 'Europe/London' }).eq('user_id', a.id);
  });

  async function aTimezone() {
    const { data } = await a.client.from('profiles').select('timezone').eq('user_id', a.id).single();
    return data?.timezone;
  }

  it("user B can't read user A's profile", async () => {
    const { data, error } = await b.client.from('profiles').select('*').eq('user_id', a.id);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it('user B only ever sees their own profile', async () => {
    const { data } = await b.client.from('profiles').select('user_id');

    expect(data).toEqual([{ user_id: b.id }]);
  });

  it("user B can't update user A's profile", async () => {
    const { data } = await b.client
      .from('profiles')
      .update({ timezone: 'Asia/Tokyo' })
      .eq('user_id', a.id)
      .select();

    expect(data).toEqual([]);
    expect(await aTimezone()).toBe('Europe/London');
  });

  it("user B can't delete user A's profile", async () => {
    const { data } = await b.client.from('profiles').delete().eq('user_id', a.id).select();

    expect(data).toEqual([]);
    expect(await aTimezone()).toBe('Europe/London');
  });

  it("user B can't create a profile in user A's name", async () => {
    await a.client.from('profiles').delete().eq('user_id', a.id);

    const { error } = await b.client.from('profiles').insert({ user_id: a.id });

    expect(error?.code).toBe('42501'); // RLS violation
  });

  it("a signed-out client can't read any profile", async () => {
    const { data } = await anonClient().from('profiles').select('*');

    expect(data ?? []).toEqual([]);
  });
});
