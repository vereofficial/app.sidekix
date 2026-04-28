import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/AppThemeContext';
import { tryGetSupabase } from '../src/lib/supabase';
import { font, getColors } from '../src/theme';

const CATEGORIES = ['food/drink', 'outdoor', 'social', 'trend', 'creative', 'chaotic'] as const;

export default function NewSidequestScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const canPublish = useMemo(() => title.trim().length > 2 && selected.length > 0, [title, selected.length]);

  const toggleCat = (c: string) =>
    setSelected((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const publish = async () => {
    if (!user?.id) {
      Alert.alert('Sign in required', "You can't post until you sign in.");
      return;
    }
    if (!canPublish) return;
    const sb = tryGetSupabase();
    if (!sb) return;
    const { error } = await sb.from('sidequests').insert({
      creator_id: user.id,
      title: title.trim(),
      categories: selected,
      is_anonymous: anonymous,
    });
    if (error) {
      Alert.alert('Publish failed', error.message);
      return;
    }
    router.replace('/(tabs)/feed');
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()}><Text style={{ color: colors.text1, fontSize: 18 }}>←</Text></Pressable>
        <Text style={[styles.title, { color: colors.text1, fontFamily: font.syneExtra }]}>suggest a side quest</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
        <TextInput
          placeholder="what's the side quest?"
          placeholderTextColor={colors.text3}
          value={title}
          onChangeText={setTitle}
          style={[styles.input, { color: colors.text1, borderColor: colors.border2, backgroundColor: colors.card, fontFamily: font.dm }]}
        />
        <View style={styles.row}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => toggleCat(c)}
              style={[styles.chip, { borderColor: colors.border2, backgroundColor: selected.includes(c) ? colors.accentMuted : colors.card }]}
            >
              <Text style={{ color: colors.text2, fontFamily: font.syne, fontSize: 11 }}>{c}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => setAnonymous((x) => !x)}><Text style={{ color: colors.text2, fontFamily: font.dm }}>post as anonymous: {anonymous ? 'yes' : 'no'}</Text></Pressable>
        <Pressable
          disabled={!canPublish}
          onPress={() => void publish()}
          style={[styles.publish, { backgroundColor: canPublish ? colors.accent : colors.bg3 }]}
        >
          <Text style={{ color: canPublish ? (resolvedScheme === 'light' ? '#fff' : '#0A0A0A') : colors.text3, fontFamily: font.syne }}>publish</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { paddingHorizontal: 18, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 18 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 16 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  publish: { marginTop: 8, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
});
