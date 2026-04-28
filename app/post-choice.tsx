import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../src/context/AppThemeContext';
import { font, getColors } from '../src/theme';

export default function PostChoiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.text1, fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={{ color: colors.text1, fontFamily: font.syneExtra, fontSize: 18 }}>post</Text>
      </View>
      <View style={styles.body}>
        <Pressable
          onPress={() => router.push('/new-sidequest')}
          style={[styles.card, { borderColor: colors.border2, backgroundColor: colors.card }]}
        >
          <Text style={{ color: colors.text1, fontFamily: font.syneExtra, fontSize: 20 }}>suggest a side quest</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push('/new-adventure')}
          style={[styles.card, { borderColor: colors.border2, backgroundColor: colors.card }]}
        >
          <Text style={{ color: colors.text1, fontFamily: font.syneExtra, fontSize: 20 }}>I went on an adventure</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { paddingHorizontal: 18, paddingTop: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  body: { flex: 1, justifyContent: 'center', paddingHorizontal: 18, gap: 12 },
  card: { borderWidth: 1, borderRadius: 16, padding: 18 },
});
