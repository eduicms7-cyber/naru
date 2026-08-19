import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthContext';
import { colors } from '../theme/colors';
import { showAlert } from '../utils/alert';
import appJson from '../../app.json';

const APP_VERSION = appJson.expo.version;
// 안드로이드 릴리즈 APK 파일명(android/app/build.gradle의 outputFileName)에 버전이
// 들어가므로, 새 버전을 빌드/배포할 때마다 이 URL도 같이 올려줘야 한다.
const APK_DOWNLOAD_URL = `https://github.com/eduicms7-cyber/naru/releases/latest/download/naru-v${APP_VERSION}.apk`;
// 로컬 전용("Naru Local") 버전은 별도 앱(패키지)이라 app.json의 버전과 무관하게
// 독립적으로 관리된다 — 새로 빌드/배포할 때마다 이 버전 문자열을 직접 올려줘야 한다.
const LOCAL_APP_VERSION = '1.0.12';
const LOCAL_APK_DOWNLOAD_URL = `https://github.com/eduicms7-cyber/naru/releases/latest/download/naru-local-v${LOCAL_APP_VERSION}.apk`;

export default function LoginScreen() {
  const { signIn, signUp, signInWithGoogle, resetPasswordForEmail } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp' | 'forgotPassword'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  const submitGoogle = async () => {
    setGoogleSubmitting(true);
    const errorMessage = await signInWithGoogle();
    setGoogleSubmitting(false);
    if (errorMessage) showAlert('구글 로그인 실패', errorMessage);
  };

  const submit = async () => {
    if (!email.trim()) {
      showAlert('입력 필요', '이메일을 입력해주세요.');
      return;
    }
    if (mode === 'forgotPassword') {
      setSubmitting(true);
      const errorMessage = await resetPasswordForEmail(email.trim());
      setSubmitting(false);

      if (errorMessage) {
        showAlert('재설정 링크 전송 실패', errorMessage);
      } else {
        showAlert('메일 전송 완료', '비밀번호 재설정 링크를 이메일로 보냈습니다.');
        setMode('signIn');
      }
      return;
    }

    if (!password) {
      showAlert('입력 필요', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setSubmitting(true);
    const errorMessage =
      mode === 'signIn'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);
    setSubmitting(false);

    if (errorMessage) {
      showAlert(mode === 'signIn' ? '로그인 실패' : '회원가입 실패', errorMessage);
    } else if (mode === 'signUp') {
      showAlert('회원가입 완료', '확인 이메일을 확인한 뒤 로그인해주세요.');
      setMode('signIn');
    }
  };

  const subtitle =
    mode === 'signIn'
      ? '로그인하고 메모를 동기화하세요'
      : mode === 'signUp'
      ? '계정을 만들고 시작하세요'
      : '가입한 이메일로 재설정 링크를 보내드려요';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.formWrap}>
      <Text style={styles.title}>Naru</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <TextInput
        style={styles.input}
        placeholder="이메일"
        placeholderTextColor={colors.subtext}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />
      {mode !== 'forgotPassword' && (
        <TextInput
          style={styles.input}
          placeholder="비밀번호"
          placeholderTextColor={colors.subtext}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
      )}

      <Pressable style={styles.submitButton} onPress={submit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.submitButtonText}>
            {mode === 'signIn' ? '로그인' : mode === 'signUp' ? '회원가입' : '재설정 링크 보내기'}
          </Text>
        )}
      </Pressable>

      {mode !== 'forgotPassword' && (
        <>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>또는</Text>
            <View style={styles.dividerLine} />
          </View>
          <Pressable
            style={styles.googleButton}
            onPress={submitGoogle}
            disabled={googleSubmitting}
          >
            {googleSubmitting ? (
              <ActivityIndicator color={colors.text} />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color={colors.text} />
                <Text style={styles.googleButtonText}>
                  {mode === 'signUp' ? '구글로 회원가입' : '구글로 계속하기'}
                </Text>
              </>
            )}
          </Pressable>
        </>
      )}

      {mode === 'signIn' && Platform.OS === 'web' && (
        <Pressable onPress={() => setMode('forgotPassword')} hitSlop={8}>
          <Text style={styles.switchModeText}>비밀번호를 잊으셨나요?</Text>
        </Pressable>
      )}

      <Pressable
        onPress={() => setMode(mode === 'signIn' ? 'signUp' : 'signIn')}
        hitSlop={8}
      >
        <Text style={styles.switchModeText}>
          {mode === 'signUp'
            ? '이미 계정이 있으신가요? 로그인'
            : mode === 'forgotPassword'
            ? '로그인으로 돌아가기'
            : '계정이 없으신가요? 회원가입'}
        </Text>
      </Pressable>

      {Platform.OS === 'web' && (
        <View style={styles.downloadRow}>
          <Pressable
            onPress={() => Linking.openURL(APK_DOWNLOAD_URL)}
            hitSlop={8}
            style={styles.downloadButton}
          >
            <Ionicons name="download-outline" size={20} color={colors.subtext} />
            <Text style={styles.downloadButtonLabel}>앱 다운로드</Text>
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL(LOCAL_APK_DOWNLOAD_URL)}
            hitSlop={8}
            style={styles.downloadButton}
          >
            <Ionicons name="phone-portrait-outline" size={20} color={colors.subtext} />
            <Text style={styles.downloadButtonLabel}>로컬앱 다운로드</Text>
          </Pressable>
        </View>
      )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  downloadRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 28,
    marginTop: 40,
  },
  downloadButton: {
    alignItems: 'center',
    gap: 2,
  },
  downloadButtonLabel: {
    fontSize: 11,
    color: colors.subtext,
  },
  formWrap: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.subtext,
    textAlign: 'center',
    marginBottom: 28,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.text,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  submitButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  switchModeText: {
    color: colors.primary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: 18,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    fontSize: 12,
    color: colors.subtext,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 13,
    marginTop: 16,
  },
  googleButtonText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
});
