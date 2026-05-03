import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/AppThemeContext';
import { font, getColors } from '../src/theme';

export default function AuthScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
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

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.center}>
        <Text style={[styles.brand, { color: colors.accent, fontFamily: font.serifItalic }]}>sidekix</Text>
        <Text style={[styles.title, { color: colors.text1, fontFamily: font.serifItalic }]}>pick better sidequests.</Text>
        <Text style={[styles.sub, { color: colors.text2, fontFamily: font.dm }]}>
          suggest ideas, post adventures, and react to everyone else's chaos.
        </Text>
      </View>
      <View style={{ paddingHorizontal: 22, paddingBottom: Math.max(20, insets.bottom) }}>
        {err ? <Text style={[styles.err, { color: '#d45a5a', fontFamily: font.dm }]}>{err}</Text> : null}
        <Pressable onPress={runGoogle} disabled={Boolean(busy)} style={[styles.btn, { borderColor: colors.border2, backgroundColor: colors.card }]}>
          {busy === 'google' ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={{ color: colors.text1, fontFamily: font.dmBold }}>continue with google</Text>
          )}
        </Pressable>
        {Platform.OS === 'ios' ? (
          <Pressable onPress={runApple} disabled={Boolean(busy)} style={[styles.btn, { backgroundColor: '#111', borderColor: '#111' }]}>
            {busy === 'apple' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: '#fff', fontFamily: font.dmBold }}>continue with apple</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'space-between' },
  center: { paddingHorizontal: 22, paddingTop: 40, alignItems: 'center' },
  brand: { fontSize: 42, marginBottom: 44 },
  title: { fontSize: 46, textAlign: 'center', lineHeight: 50, marginBottom: 14 },
  sub: { fontSize: 15, textAlign: 'center', lineHeight: 22, maxWidth: 320 },
  btn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  err: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
});
