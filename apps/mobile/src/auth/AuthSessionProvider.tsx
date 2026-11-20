import type { Session as AuthSession } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';

/**
 * The Supabase auth session: who is signed in. `undefined` while the saved
 * session is still being restored from storage, `null` when signed out.
 * Not to be confused with a training Session (GLOSSARY.md).
 */
export type AuthSessionState = AuthSession | null | undefined;

const AuthSessionContext = createContext<AuthSessionState>(undefined);

/** Restores the saved auth session and keeps it current for the whole app. */
export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [authSession, setAuthSession] = useState<AuthSessionState>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setAuthSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthSessionContext.Provider value={authSession}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession(): AuthSessionState {
  return useContext(AuthSessionContext);
}

/** The signed-in auth session, for screens that only render behind the sign-in guard. */
export function useSignedInAuthSession(): AuthSession {
  const authSession = useAuthSession();
  if (!authSession) throw new Error('useSignedInAuthSession used outside the signed-in routes');
  return authSession;
}
