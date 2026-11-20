import { todayPlanV1, type LoggedSetV1, type PrescribedSetV1, type TodayPlanV1 } from '@coach/contract';
import type { Session as AuthSession } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { Button, ScrollView, StyleSheet, Text } from 'react-native';
import { logSet, newLoggedSet } from '../lib/logSet';
import { supabase } from '../lib/supabase';

/** What the demo button logs in a calibration week, when a set has no target load. */
const DEMO_CALIBRATION_KG = 20;

const REASON_TEXT = {
  no_active_block: 'No active block.',
  no_session_today: 'Rest day: no session today.',
} as const;

function describeLoggedSet(logged: LoggedSetV1): string {
  return `${logged.reps} × ${logged.kg} kg${logged.rpe === null ? '' : ` @ RPE ${logged.rpe}`}`;
}

/** today's plan as plain text. The real lifting UI is Step 2. */
function describePlan(plan: TodayPlanV1): string {
  if (plan.session === null) return `${plan.date}\n${REASON_TEXT[plan.reason]}`;

  const s = plan.session;
  const lines = [
    `${plan.date}: ${s.day_template_name} (${s.status})`,
    `Week ${s.block_week} of ${s.block_length_weeks}`,
    '',
  ];
  for (const e of s.exercises) {
    lines.push(`${e.position}. ${e.name}${e.rest_s === null ? '' : `, rest ${e.rest_s}s`}`);
    for (const set of e.prescribed_sets) {
      const load = set.target_kg === null ? 'calibration' : `${set.target_kg} kg`;
      lines.push(`   Set ${set.set_index}: ${set.min_reps}–${set.max_reps} reps, ${load}`);
      for (const logged of set.logged_sets) lines.push(`      logged ${describeLoggedSet(logged)}`);
    }
    for (const extra of e.extra_logged_sets) lines.push(`   Extra: ${describeLoggedSet(extra)}`);
  }
  return lines.join('\n');
}

/** A prescribed set with nothing logged against it yet, and where it belongs. */
type UnloggedSet = { sessionId: string; exerciseId: string; set: PrescribedSetV1 };

/** The first prescribed set today with nothing logged against it yet. */
function nextUnloggedSet(plan: TodayPlanV1): UnloggedSet | null {
  if (plan.session === null) return null;
  for (const e of plan.session.exercises) {
    const set = e.prescribed_sets.find((s) => s.logged_sets.length === 0);
    if (set) return { sessionId: plan.session.id, exerciseId: e.exercise_id, set };
  }
  return null;
}

/** Reads the `today_plan` published object and checks it against the v1 contract. */
async function fetchTodayPlan(): Promise<{ plan: TodayPlanV1 } | { error: string }> {
  const { data, error } = await supabase.rpc('today_plan');
  if (error) return { error: error.message };
  const parsed = todayPlanV1.safeParse(data);
  return parsed.success
    ? { plan: parsed.data }
    : { error: `today_plan didn't match the v1 contract: ${parsed.error.message}` };
}

/**
 * Shows today's plan, read from the `today_plan` published object and checked
 * against the contract, as plain text. Proves login, RLS, RPC and the contract
 * work together.
 */
export function HomeScreen({ authSession }: { authSession: AuthSession }) {
  const [plan, setPlan] = useState<TodayPlanV1 | null>(null);
  const [error, setError] = useState<string | null>(null);

  const show = useCallback((result: Awaited<ReturnType<typeof fetchTodayPlan>>) => {
    if ('plan' in result) setPlan(result.plan);
    setError('error' in result ? result.error : null);
  }, []);
  const load = useCallback(async () => show(await fetchTodayPlan()), [show]);

  // Demo only (the lifting UI is Step 2): logs the next unlogged set at the
  // bottom of its rep range, at its target load (or DEMO_CALIBRATION_KG in a calibration week).
  const logNextSet = useCallback(async () => {
    const next = plan && nextUnloggedSet(plan);
    if (!next) return;
    const { error: logError } = await logSet(
      newLoggedSet({
        session_id: next.sessionId,
        prescribed_set_id: next.set.id,
        exercise_id: next.exerciseId,
        reps: next.set.min_reps,
        kg: next.set.target_kg ?? DEMO_CALIBRATION_KG,
      }),
    );
    if (logError) setError(logError.message);
    else await load();
  }, [plan, load]);

  useEffect(() => {
    let current = true;
    void fetchTodayPlan().then((result) => {
      if (current) show(result);
    });
    return () => {
      current = false;
    };
  }, [show, authSession.user.id]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Signed in as {authSession.user.email}</Text>
      <Text style={styles.label}>{"Today's plan"}</Text>
      <Text style={styles.mono}>{error ?? (plan ? describePlan(plan) : 'Loading…')}</Text>
      <Button title="Refresh" onPress={() => void load()} />
      {plan && nextUnloggedSet(plan) && <Button title="Log a set (demo)" onPress={() => void logNextSet()} />}
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
