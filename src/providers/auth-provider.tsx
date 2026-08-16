import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { AppState } from 'react-native';

import { unregisterCurrentPushToken } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import {
  createAccount,
  resendSignupConfirmation,
  type CreateAccountResult,
} from '@/services/auth';

type SignUpInput = {
  email: string;
  password: string;
  username: string;
  displayName?: string;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  initializationError: string | null;
  retrySession: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<CreateAccountResult>;
  resendConfirmation: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const currentUserId = useRef<string | null>(null);

  const applySession = useCallback(
    (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id ?? null;
      if (currentUserId.current && currentUserId.current !== nextUserId) queryClient.clear();
      currentUserId.current = nextUserId;
      setSession(nextSession);
    },
    [queryClient],
  );

  const retrySession = useCallback(async () => {
    setLoading(true);
    setInitializationError(null);
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      applySession(data.session);
    } catch {
      setInitializationError('Sock could not restore your session. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [applySession]);

  useEffect(() => {
    let active = true;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) throw error;
        applySession(data.session);
        setInitializationError(null);
      })
      .catch(() => {
        if (active) {
          setInitializationError(
            'Sock could not restore your session. Check your connection and retry.',
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [applySession]);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
      setInitializationError(null);
      setLoading(false);
    });

    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });

    return () => {
      data.subscription.unsubscribe();
      appState.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, [applySession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    if (!data.session) throw new Error('Sock did not receive a login session.');
    applySession(data.session);
  }, [applySession]);

  const signUp = useCallback(async (input: SignUpInput) => createAccount(input), []);
  const resendConfirmation = useCallback(
    async (email: string) => resendSignupConfirmation(email),
    [],
  );

  const signOut = useCallback(async () => {
    if (session?.user.id) {
      await unregisterCurrentPushToken(session.user.id);
    }
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw error;
    queryClient.clear();
  }, [queryClient, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      initializationError,
      retrySession,
      signIn,
      signUp,
      resendConfirmation,
      signOut,
    }),
    [
      initializationError,
      loading,
      resendConfirmation,
      retrySession,
      session,
      signIn,
      signOut,
      signUp,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
