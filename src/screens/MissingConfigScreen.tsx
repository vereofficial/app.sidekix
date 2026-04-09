import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getColors } from '../theme';
import { useAppTheme } from '../context/AppThemeContext';
import { font } from '../theme';

export function MissingConfigScreen() {
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.box, { backgroundColor: colors.bg, paddingTop: insets.top + 24, paddingHorizontal: 24 }]}>
      <Text style={[styles.title, { color: colors.text1, fontFamily: font.syneExtra }]}>Supabase isn&apos;t configured</Text>
      <Text style={[styles.body, { color: colors.text2, fontFamily: font.dm }]}>
        This app reads credentials only from your environment. Before running{' '}
        <Text style={{ fontFamily: font.dmMedium }}>npx expo start</Text> or an EAS build, set:
      </Text>
      <View style={[styles.code, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text style={[styles.mono, { color: colors.accent, fontFamily: font.dm }]}>EXPO_PUBLIC_SUPABASE_URL</Text>
        <Text style={[styles.mono, { color: colors.accent, fontFamily: font.dm, marginTop: 8 }]}>
          EXPO_PUBLIC_SUPABASE_ANON_KEY
        </Text>
      </View>
      <Text style={[styles.body, { color: colors.text3, fontFamily: font.dm, marginTop: 16 }]}>
        Local: set the same names in your shell, then run Expo. EAS: project secrets. Vercel (web): Project → Settings →
        Environment Variables → add both for Production, then redeploy. (Names are EXPO_PUBLIC_…, not NEXT_PUBLIC_.)
      </Text>
      <Text style={[styles.body, { color: colors.text2, fontFamily: font.dm, marginTop: 12 }]}>
        In the Supabase dashboard: run <Text style={{ fontFamily: font.dmMedium }}>supabase/schema.sql</Text>, enable Phone
        auth, and connect your SMS provider (e.g. Twilio).
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flex: 1 },
  title: { fontSize: 22, marginBottom: 16, letterSpacing: -0.3 },
  body: { fontSize: 14, lineHeight: 21 },
  code: { marginTop: 16, padding: 14, borderRadius: 12, borderWidth: 1 },
  mono: { fontSize: 13 },
});
