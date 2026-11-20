import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { AuthSessionProvider, useAuthSession } from '../auth/AuthSessionProvider';

/**
 * Auth-gated routes: `index` (today's plan) only while signed in, `sign-in`
 * only while signed out. Expo Router redirects as the auth session changes.
 */
function RootStack() {
  const authSession = useAuthSession();

  if (authSession === undefined) {
    return <ActivityIndicator style={{ flex: 1 }} />;
  }

  const signedIn = authSession !== null;
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#fff' } }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthSessionProvider>
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <RootStack />
        <StatusBar style="auto" />
      </View>
    </AuthSessionProvider>
  );
}
