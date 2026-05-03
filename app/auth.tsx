import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthOpeningBackdrop } from '../src/components/AuthOpeningBackdrop';
import { AUTH_PRIVACY_URL, AUTH_TERMS_URL } from '../src/constants/authLegal';
import { useAuth } from '../src/context/AuthContext';
import { font } from '../src/theme';

const LIME = '#D4FF3F';

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signInWithGoogle, signInWithApple } = useAuth();
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const runGoogle = async () => {
    setErr(null);
    setBusy('google');
    const { error } = await signInWithGoogle();
    setBusy(null);
    if (error) setErr(error);
    else router.replace('/');
  };

  const runApple = async () => {
    setErr(null);
    setBusy('apple');
    const { error } = await signInWithApple();
    setBusy(null);
    if (error) setErr(error);
    else router.replace('/');
  };

  const openUrl = (url: string) => () => {
    void Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <AuthOpeningBackdrop />

      <View
        style={[
          styles.foreground,
          {
            paddingTop: insets.top + 8,
            paddingBottom: Math.max(16, insets.bottom),
          },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.upperFill}>
          <View style={styles.upperInner}>
            <View style={styles.wordmarkRow}>
              <Text style={[styles.wordPart, { fontFamily: font.wordmark, color: '#ffffff' }]}>side</Text>
              <Text style={[styles.wordPart, { fontFamily: font.wordmark, color: LIME }]}>kix</Text>
            </View>
            <Text style={[styles.tagline, { fontFamily: font.dm }]}>
              a community for people who actually do things
            </Text>
          </View>
        </View>

        <View style={styles.signInSection}>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={[styles.dividerLabel, { fontFamily: font.mono }]}>SIGN IN TO GET STARTED</Text>
            <View style={styles.dividerLine} />
          </View>

          {err ? <Text style={[styles.err, { fontFamily: font.dm }]}>{err}</Text> : null}

          {Platform.OS === 'ios' ? (
            <Pressable
              onPress={runApple}
              disabled={Boolean(busy)}
              style={({ pressed }) => [
                styles.oauthBtn,
                styles.appleBtn,
                pressed && busy !== 'apple' && styles.oauthPressed,
              ]}
            >
              {busy === 'apple' ? (
                <ActivityIndicator color="#111" />
              ) : (
                <>
                  <Ionicons name="logo-apple" size={24} color="#111" style={styles.oauthIcon} />
                  <Text style={[styles.oauthLabelApple, { fontFamily: font.dmBold }]}>continue with apple</Text>
                </>
              )}
            </Pressable>
          ) : null}

          <Pressable
            onPress={runGoogle}
            disabled={Boolean(busy)}
            style={({ pressed }) => [
              styles.oauthBtn,
              styles.googleBtn,
              pressed && busy !== 'google' && styles.oauthPressed,
            ]}
          >
            {busy === 'google' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="logo-google" size={22} color="#fff" style={styles.oauthIcon} />
                <Text style={[styles.oauthLabelGoogle, { fontFamily: font.dmBold }]}>continue with google</Text>
              </>
            )}
          </Pressable>

          <Text style={[styles.legal, { fontFamily: font.dm }]}>
            by continuing you agree to our{' '}
            <Text onPress={openUrl(AUTH_TERMS_URL)} style={styles.legalLink}>
              terms
            </Text>{' '}
            and{' '}
            <Text onPress={openUrl(AUTH_PRIVACY_URL)} style={styles.legalLink}>
              privacy policy
            </Text>
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#060504' },
  foreground: {
    flex: 1,
    paddingHorizontal: 22,
  },
  upperFill: {
    flex: 1,
    justifyContent: 'flex-end',
    alignSelf: 'stretch',
    minHeight: 0,
    paddingBottom: 20,
  },
  upperInner: {
    alignSelf: 'stretch',
    alignItems: 'flex-start',
    width: '100%',
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'flex-start',
    flexWrap: 'nowrap',
    marginBottom: 10,
  },
  wordPart: {
    fontSize: 44,
    letterSpacing: -1.2,
    lineHeight: 48,
    includeFontPadding: false,
  },
  tagline: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'left',
    width: '100%',
    maxWidth: 340,
    textTransform: 'lowercase',
    includeFontPadding: false,
  },
  signInSection: {
    width: '100%',
    flexShrink: 0,
    paddingTop: 4,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 18,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  dividerLabel: {
    marginHorizontal: 12,
    fontSize: 10,
    letterSpacing: 1.6,
    color: 'rgba(255,255,255,0.72)',
  },
  oauthBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginTop: 12,
    gap: 10,
  },
  appleBtn: {
    backgroundColor: '#ffffff',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  googleBtn: {
    backgroundColor: '#1e1e1e',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  oauthPressed: {
    opacity: 0.92,
  },
  oauthIcon: {
    marginRight: 2,
  },
  oauthLabelApple: {
    fontSize: 16,
    color: '#111111',
  },
  oauthLabelGoogle: {
    fontSize: 16,
    color: '#ffffff',
  },
  err: { fontSize: 13, textAlign: 'center', marginBottom: 6, color: '#ffb4b4' },
  legal: {
    marginTop: 18,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.45)',
  },
  legalLink: {
    textDecorationLine: 'underline',
    color: 'rgba(255,255,255,0.55)',
  },
});
