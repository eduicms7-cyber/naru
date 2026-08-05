import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY가 설정되지 않았습니다. .env.example을 참고해 .env를 만들어주세요.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // 비밀번호 재설정 링크의 URL(#access_token=...)은 웹에서만 파싱하면 됨 — 네이티브에는 window/URL 해시가 없음.
    detectSessionInUrl: Platform.OS === 'web',
    // 구글 로그인(OAuth)이 code=... 쿼리파라미터로 돌아오게 함 — 네이티브 딥링크(naru://auth-callback)에서
    // exchangeCodeForSession으로 교환하기 쉬운 형태. 웹은 detectSessionInUrl이 이 code도 자동 처리한다.
    flowType: 'pkce',
  },
});
