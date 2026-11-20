import { describe, expect, it } from 'vitest';
import { inject } from 'vitest';
import { createTestUser } from './harness/users';

// ADR 0001: PostgREST over RPC is the only API; GraphQL stays off.
describe('GraphQL', () => {
  it('is not available to a signed-in client', async () => {
    const user = await createTestUser();
    const { data: session } = await user.client.auth.getSession();
    const { apiUrl, anonKey } = inject('stack');

    const response = await fetch(`${apiUrl}/graphql/v1`, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${session.session!.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: '{ __typename }' }),
    });
    const body = (await response.json()) as { data?: unknown };

    expect(body.data ?? null).toBeNull();
  });
});
