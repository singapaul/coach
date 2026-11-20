import type { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthScreen } from './src/auth/AuthScreen';
import { HomeScreen } from './src/home/HomeScreen';
import { supabase } from './src/lib/supabase';

export default function App() {
  // undefined while the saved session is being restored from storage.
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {session === undefined ? (
        <ActivityIndicator style={{ flex: 1 }} />
      ) : session ? (
        <HomeScreen key={session.user.id} session={session} />
      ) : (
        <AuthScreen />
      )}
      <StatusBar style="auto" />
    </View>
  );
}
