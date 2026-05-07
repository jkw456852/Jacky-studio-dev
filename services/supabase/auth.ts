import { supabase } from './client';

export interface AuthCredentials {
  email: string;
  password: string;
  username?: string;
}

export const signUpWithEmail = async ({
  email,
  password,
  username,
}: AuthCredentials) => {
  return supabase.auth.signUp({
    email,
    password,
    options: username
      ? {
          data: {
            username,
          },
        }
      : undefined,
  });
};

export const signInWithEmail = async ({ email, password }: AuthCredentials) => {
  return supabase.auth.signInWithPassword({
    email,
    password,
  });
};

export const requestPasswordReset = async (email: string, redirectTo?: string) => {
  return supabase.auth.resetPasswordForEmail(
    email,
    redirectTo
      ? {
          redirectTo,
        }
      : undefined,
  );
};

export const updateCurrentUserPassword = async (password: string) => {
  return supabase.auth.updateUser({
    password,
  });
};

export const signOut = async () => {
  return supabase.auth.signOut();
};

export const getCurrentSession = async () => {
  return supabase.auth.getSession();
};

export const getCurrentUser = async () => {
  return supabase.auth.getUser();
};
