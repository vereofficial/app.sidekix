import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Wordmark } from '../../src/components/Wordmark';
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
      <View style={styles.topLogoBar}>
        <Wordmark colors={colors} size={24} />
      </View>
      <View style={[styles.mainBlock, { paddingBottom: Math.max(insets.bottom, 28) }]}>
        <Text style={[styles.title, { color: colors.text1, fontFamily: font.serifItalic }]}>what are you posting?</Text>
        <Text style={[styles.sub, { color: colors.text2, fontFamily: font.dm }]}>
          every post on sidekix is one of exactly two things
        </Text>
        <View style={styles.cardsStack}>
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
              drop an idea others can discover on the feed.
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topLogoBar: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  /** Title, subtitle, and cards — vertically centered in the space below the logo. */
  mainBlock: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    alignItems: 'center',
  },
  title: { fontSize: 24, letterSpacing: -0.2, textAlign: 'center', lineHeight: 30 },
  sub: { fontSize: 13, marginTop: 8, lineHeight: 18, textAlign: 'center', maxWidth: 320 },
  cardsStack: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: 16,
    marginTop: 22,
  },
  card: { borderWidth: 1, borderRadius: 18, padding: 20 },
});
