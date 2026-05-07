import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { getCurrentSession, signOut } from '../services/supabase/auth';
import { supabase } from '../services/supabase/client';

type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

interface AuthSessionContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  isAuthenticated: boolean;
  refreshSession: () => Promise<void>;
  signOutAndClear: () => Promise<void>;
}

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

const resolveStatus = (session: Session | null): AuthStatus =>
  session?.user ? 'authenticated' : 'anonymous';

export const AuthSessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  const applySession = useCallback((nextSession: Session | null) => {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setStatus(resolveStatus(nextSession));
  }, []);

  const refreshSession = useCallback(async () => {
    const { data, error } = await getCurrentSession();

    if (error) {
      console.info('[supabase-auth] bootstrap-error', error.message);
      setStatus('anonymous');
      setSession(null);
      setUser(null);
      return;
    }

    console.info('[supabase-auth] bootstrap-session', data.session?.user?.email || 'anonymous');
    applySession(data.session);
  }, [applySession]);

  const signOutAndClear = useCallback(async () => {
    const { error } = await signOut();

    if (error) {
      throw error;
    }

    applySession(null);
  }, [applySession]);

  useEffect(() => {
    let isMounted = true;

    void getCurrentSession().then(({ data, error }) => {
      if (!isMounted) {
        return;
      }

      if (error) {
        console.info('[supabase-auth] bootstrap-error', error.message);
        setStatus('anonymous');
        setSession(null);
        setUser(null);
        return;
      }

      console.info('[supabase-auth] bootstrap-session', data.session?.user?.email || 'anonymous');
      applySession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      console.info('[supabase-auth] state-change', event, nextSession?.user?.email || 'anonymous');

      if (isMounted) {
        applySession(nextSession);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [applySession]);

  const value = useMemo<AuthSessionContextValue>(
    () => ({
      status,
      session,
      user,
      isAuthenticated: status === 'authenticated' && !!user,
      refreshSession,
      signOutAndClear,
    }),
    [refreshSession, session, signOutAndClear, status, user],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
};

export const useAuthSession = (): AuthSessionContextValue => {
  const context = useContext(AuthSessionContext);

  if (!context) {
    throw new Error('useAuthSession must be used within AuthSessionProvider');
  }

  return context;
};
