import { envelopeSchema } from '@coach/contract';
import type { Database } from '@coach/db-types';
import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text } from 'react-native';
import { supabase } from '../lib/supabase';

type Profile = Database['public']['Tables']['profiles']['Row'];

/**
 * Walking-skeleton home screen: proves login, RLS and the contract package are
 * wired up by showing the signed-in user's own profile as plain text. Later
 * tickets replace this with today's plan.
 */
export function HomeScreen({ session }: { session: Session }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data, error: readError }) => {
        if (readError) setError(readError.message);
        setProfile(data);
      });
  }, [session.user.id]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Signed in as {session.user.email}</Text>
      <Text style={styles.label}>Profile</Text>
      <Text style={styles.mono}>
        {error ?? (profile ? JSON.stringify(profile, null, 2) : 'Loading…')}
      </Text>
      <Text style={styles.label}>Contract envelope fields</Text>
      <Text style={styles.mono}>{Object.keys(envelopeSchema.shape).join(', ')}</Text>
      <Button title="Log out" onPress={() => supabase.auth.signOut()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 24, paddingTop: 64, gap: 12 },
  title: { fontSize: 18, fontWeight: '600' },
  label: { fontWeight: '600', marginTop: 8 },
  mono: { fontFamily: 'monospace' },
});
