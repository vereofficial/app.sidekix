import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { hapticLight } from '../../src/lib/haptics';
import { useAppTheme } from '../../src/context/AppThemeContext';
import { font, getColors } from '../../src/theme';

/** Center tab — same actions as modal post-choice without a nested back handler. */
export default function PostTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.topPad}>
        <Text style={[styles.logo, { color: colors.accent, fontFamily: font.serifItalic }]}>sidekix</Text>
        <Text style={[styles.title, { color: colors.text1, fontFamily: font.serifItalic }]}>what are you posting?</Text>
        <Text style={[styles.sub, { color: colors.text2, fontFamily: font.dm }]}>every post on sidekix is one of exactly two things</Text>
      </View>
      <View style={styles.body}>
        <Pressable
          onPress={() => {
            hapticLight();
            router.push('/new-sidequest');
          }}
          style={[styles.card, { borderColor: colors.border2, backgroundColor: colors.card }]}
        >
          <Text style={{ color: colors.text1, fontFamily: font.dmBold, fontSize: 24, marginBottom: 6 }}>💡</Text>
          <Text style={{ color: '#1f62c5', fontFamily: font.dmBold, fontSize: 16 }}>suggest a sidequest</Text>
          <Text style={{ color: colors.text3, fontFamily: font.dm, fontSize: 13, marginTop: 6 }}>
            drop an idea others can discover on home.
          </Text>
        </Pressable>
        <Pressable
          onPress={() => {
            hapticLight();
            router.push('/new-adventure');
          }}
          style={[styles.card, { borderColor: colors.border2, backgroundColor: colors.card }]}
        >
          <Text style={{ color: colors.text1, fontFamily: font.dmBold, fontSize: 24, marginBottom: 6 }}>⚡</Text>
          <Text style={{ color: '#c2580d', fontFamily: font.dmBold, fontSize: 16 }}>I went on an adventure</Text>
          <Text style={{ color: colors.text3, fontFamily: font.dm, fontSize: 13, marginTop: 6 }}>
            link a photo or video to a side quest you completed.
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topPad: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 10, alignItems: 'center' },
  logo: { fontSize: 22, marginBottom: 10 },
  title: { fontSize: 24, letterSpacing: -0.2, textAlign: 'center', lineHeight: 30 },
  sub: { fontSize: 13, marginTop: 8, lineHeight: 18, textAlign: 'center' },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 22, gap: 16, paddingBottom: 24 },
  card: { borderWidth: 1, borderRadius: 18, padding: 20 },
});
