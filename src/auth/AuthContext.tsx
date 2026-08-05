import React, { createContext, useContext, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { migrateLegacyDataIfNeeded } from '../storage/migrateLegacyData';

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<string | null>;
  signInWithGoogle: () => Promise<string | null>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<string | null>;
  updatePassword: (newPassword: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
      if (data.session) migrateLegacyDataIfNeeded();
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === 'PASSWORD_RECOVERY') setIsPasswordRecovery(true);
      setSession(nextSession);
      if (nextSession && event !== 'PASSWORD_RECOVERY') migrateLegacyDataIfNeeded();
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? error.message : null;
  };

  // 웹: 브라우저가 페이지를 벗어났다 돌아오고, 콜백 URL의 ?code=는 detectSessionInUrl이 알아서 처리한다.
  // 네이티브: 앱 안에서 브라우저 세션을 열고(openAuthSessionAsync), naru://auth-callback으로 돌아온
  // 딥링크에서 code를 직접 꺼내 exchangeCodeForSession으로 세션을 교환한다.
  const signInWithGoogle = async (): Promise<string | null> => {
    if (Platform.OS === 'web') {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      return error ? error.message : null;
    }

    const redirectTo = Linking.createURL('auth-callback');
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data?.url) return error?.message ?? '구글 로그인을 시작하지 못했습니다.';

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return null; // 사용자가 취소한 경우는 에러로 보여주지 않는다.

    const { queryParams } = Linking.parse(result.url);
    const code = queryParams?.code;
    if (!code || Array.isArray(code)) return '구글 로그인에 실패했습니다.';

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    return exchangeError ? exchangeError.message : null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPasswordForEmail = async (email: string) => {
    if (Platform.OS !== 'web') {
      return '비밀번호 재설정은 현재 웹에서만 지원됩니다. npm run web으로 접속해주세요.';
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    return error ? error.message : null;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (!error) setIsPasswordRecovery(false);
    return error ? error.message : null;
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        loading,
        isPasswordRecovery,
        signIn,
        signUp,
        signInWithGoogle,
        signOut,
        resetPasswordForEmail,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
