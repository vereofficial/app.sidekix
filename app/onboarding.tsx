import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/AppThemeContext';
import { setHomeFeedMode, type HomeFeedMode } from '../src/lib/homeFeedPreference';
import { hapticLight } from '../src/lib/haptics';
import { markOnboardingCompleted } from '../src/lib/onboardingStorage';
import { tryGetSupabase } from '../src/lib/supabase';
import { font, getColors } from '../src/theme';

const CATEGORIES = ['food/drink', 'outdoor', 'social', 'trend', 'creative', 'chaotic'] as const;

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const { user } = useAuth();
  const [idea, setIdea] = useState('');
  const [mode, setMode] = useState<HomeFeedMode>('feed');
  const [cats, setCats] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const canFinish = useMemo(() => idea.trim().length > 3 && cats.length > 0 && !busy, [idea, cats.length, busy]);

  const toggleCat = (cat: string) => {
    hapticLight();
    setCats((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  };

  const finish = async () => {
    if (!user?.id || !canFinish) return;
    setBusy(true);
    const sb = tryGetSupabase();
    if (!sb) return;
    const { error } = await sb.from('sidequests').insert({
      creator_id: user.id,
      title: idea.trim(),
      categories: cats,
      is_anonymous: false,
    });
    if (error) {
      setBusy(false);
      Alert.alert('Could not finish onboarding', error.message);
      return;
    }
    await setHomeFeedMode(user.id, mode);
    await markOnboardingCompleted(user.id);
    router.replace('/(tabs)/feed');
    setBusy(false);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 14, paddingBottom: Math.max(insets.bottom, 24) }}>
        <Text style={[styles.title, { color: colors.text1, fontFamily: font.syneExtra }]}>before you start</Text>
        <Text style={[styles.sub, { color: colors.text2, fontFamily: font.dm }]}>
          drop one side quest idea and choose your default home style.
        </Text>
        <TextInput
          value={idea}
          onChangeText={setIdea}
          placeholder="drop an idea for a side quest..."
          placeholderTextColor={colors.text3}
          style={[styles.input, { borderColor: colors.border2, backgroundColor: colors.card, color: colors.text1, fontFamily: font.dm }]}
          multiline
        />
        <View style={styles.row}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => toggleCat(c)}
              style={[styles.chip, { borderColor: colors.border2, backgroundColor: cats.includes(c) ? colors.accentMuted : colors.card }]}
            >
              <Text style={{ color: colors.text2, fontFamily: font.syne, fontSize: 11 }}>{c}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ color: colors.text3, fontFamily: font.syne, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 }}>
          default home style
        </Text>
        <View style={[styles.modeWrap, { backgroundColor: colors.pillBg }]}>
          <Pressable onPress={() => setMode('feed')} style={[styles.modeBtn, mode === 'feed' && { backgroundColor: colors.accent }]}>
            <Text style={{ color: mode === 'feed' ? (resolvedScheme === 'light' ? '#fff' : '#0A0A0A') : colors.text3, fontFamily: font.syne }}>Feed</Text>
          </Pressable>
          <Pressable onPress={() => setMode('recent')} style={[styles.modeBtn, mode === 'recent' && { backgroundColor: colors.accent }]}>
            <Text style={{ color: mode === 'recent' ? (resolvedScheme === 'light' ? '#fff' : '#0A0A0A') : colors.text3, fontFamily: font.syne }}>Recent</Text>
          </Pressable>
        </View>
        <Pressable disabled={!canFinish} onPress={() => void finish()} style={[styles.finishBtn, { backgroundColor: canFinish ? colors.accent : colors.bg3 }]}>
          <Text style={{ color: canFinish ? (resolvedScheme === 'light' ? '#fff' : '#0A0A0A') : colors.text3, fontFamily: font.syne }}>
            {busy ? 'saving...' : 'finish onboarding'}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { fontSize: 28, letterSpacing: -0.4 },
  sub: { fontSize: 13, lineHeight: 19 },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 110, textAlignVertical: 'top', padding: 12, fontSize: 15 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  modeWrap: { flexDirection: 'row', borderRadius: 999, padding: 4, gap: 4 },
  modeBtn: { flex: 1, borderRadius: 999, alignItems: 'center', paddingVertical: 9 },
  finishBtn: { borderRadius: 999, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
});
