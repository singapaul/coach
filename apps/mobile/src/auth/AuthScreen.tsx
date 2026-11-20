import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import { supabase } from '../lib/supabase';

/** The phone's IANA time zone, e.g. `Europe/London`, saved on the new profile. */
function deviceTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: () => Promise<{ error: Error | null }>) {
    setBusy(true);
    setMessage(null);
    const { error } = await action();
    if (error) setMessage(error.message);
    setBusy(false);
  }

  const signIn = () =>
    run(() => supabase.auth.signInWithPassword({ email: email.trim(), password }));

  const signUp = () =>
    run(() =>
      supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { timezone: deviceTimezone() } },
      }),
    );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Coach</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        autoCapitalize="none"
        autoComplete="password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <View style={styles.buttons}>
        <Button title="Log in" onPress={signIn} disabled={busy} />
        <Button title="Sign up" onPress={signUp} disabled={busy} />
      </View>
      {message ? <Text style={styles.error}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '600', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 6, padding: 12, fontSize: 16 },
  buttons: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 },
  error: { color: '#b00020' },
});
