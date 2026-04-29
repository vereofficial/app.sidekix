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
  const { user, isAdmin } = useAuth();
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
      approval_status: isAdmin ? 'approved' : 'pending',
    });
    if (error) {
      Alert.alert('Publish failed', error.message);
      return;
    }
    Alert.alert('Submitted for review', 'Your sidequest is pending approval before it appears publicly.');
    router.replace('/(tabs)/home');
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()}><Text style={{ color: colors.text1, fontSize: 18 }}>← back</Text></Pressable>
        <View style={[styles.typePill, { backgroundColor: '#eef5ff' }]}>
          <Text style={{ color: '#1f62c5', fontFamily: font.dmBold, fontSize: 11 }}>💡 SUGGEST AN IDEA</Text>
        </View>
        <Pressable disabled={!canPublish} onPress={() => void publish()} style={[styles.postBtn, { backgroundColor: '#b84d11', opacity: canPublish ? 1 : 0.5 }]}>
          <Text style={{ color: '#fff', fontFamily: font.dmBold, fontSize: 14 }}>post</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
        <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 11, letterSpacing: 1.4 }}>THE DARE</Text>
        <TextInput
          placeholder="something specific and interesting people should actually go do..."
          placeholderTextColor={colors.text3}
          value={title}
          onChangeText={setTitle}
          style={[styles.input, { color: colors.text1, borderColor: colors.border2, backgroundColor: colors.card, fontFamily: font.serifItalic }]}
          multiline
        />
        <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 11, letterSpacing: 1.4 }}>VIBE</Text>
        <View style={styles.row}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => toggleCat(c)}
              style={[styles.chip, { borderColor: colors.border2, backgroundColor: selected.includes(c) ? colors.accentMuted : colors.card }]}
            >
              <Text style={{ color: colors.text2, fontFamily: font.dmBold, fontSize: 11 }}>{c}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={() => setAnonymous((x) => !x)}><Text style={{ color: colors.text2, fontFamily: font.dm }}>post as anonymous: {anonymous ? 'yes' : 'no'}</Text></Pressable>
        <View style={[styles.creditBox, { borderColor: colors.border2, backgroundColor: colors.card }]}>
          <Text style={{ color: '#b84d11', fontFamily: font.dmBold, marginBottom: 8 }}>💡 how credit works</Text>
          <Text style={{ color: colors.text1, fontFamily: font.dm, lineHeight: 28, fontSize: 14 }}>
            Every time someone does your idea and links it back, you get credited on their post. Your "times done" count lives on your profile.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { paddingHorizontal: 18, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd', paddingBottom: 12 },
  title: { fontSize: 18 },
  typePill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  postBtn: { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 18, minHeight: 140, textAlignVertical: 'top', lineHeight: 30 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  creditBox: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 10 },
  publish: { marginTop: 8, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
});
