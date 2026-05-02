import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/AppThemeContext';
import { MAX_SIDEQUEST_SUBTITLE, MAX_SIDEQUEST_TITLE } from '../src/lib/textLimits';
import { feedCategoryChipParts } from '../src/lib/categoryDisplay';
import { feedV3BrowseFilterActiveSkin, feedV3TagSkin } from '../src/lib/feedV3Tokens';
import { tryGetSupabase } from '../src/lib/supabase';
import { font, getColors } from '../src/theme';

const CATEGORIES = ['food/drink', 'outdoor', 'social', 'trend', 'creative', 'chaotic'] as const;

export default function NewSidequestScreen() {
  const router = useRouter();
  const { draftTitle } = useLocalSearchParams<{ draftTitle?: string }>();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const scheme = resolvedScheme;
  const { user, isAdmin } = useAuth();
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [anonymous, setAnonymous] = useState(false);
  const canPublish = useMemo(() => title.trim().length > 2 && selected.length > 0, [title, selected.length]);

  useEffect(() => {
    const seed = typeof draftTitle === 'string' ? draftTitle.trim() : '';
    if (seed.length > 0) setTitle(seed.slice(0, MAX_SIDEQUEST_TITLE));
  }, [draftTitle]);

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
      title: title.trim().slice(0, MAX_SIDEQUEST_TITLE),
      subtitle: subtitle.trim() ? subtitle.trim().slice(0, MAX_SIDEQUEST_SUBTITLE) : null,
      categories: selected,
      is_anonymous: anonymous,
      approval_status: isAdmin ? 'approved' : 'pending',
    });
    if (error) {
      Alert.alert('Publish failed', error.message);
      return;
    }
    Alert.alert('Submitted for review', 'Your sidequest is pending approval before it appears publicly.');
    router.replace('/(tabs)/feed');
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.head}>
        <View style={styles.headSide}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
            <Text style={{ color: colors.text1, fontSize: 18 }}>←</Text>
          </Pressable>
        </View>
        <View style={styles.headCenter}>
          <View style={[styles.typePill, { backgroundColor: '#eef5ff' }]}>
            <Text style={{ color: '#1f62c5', fontFamily: font.dmBold, fontSize: 11 }}>💡 SUGGEST AN IDEA</Text>
          </View>
        </View>
        <View style={[styles.headSide, styles.headSideEnd]}>
          <Pressable disabled={!canPublish} onPress={() => void publish()} style={[styles.postBtn, { backgroundColor: '#b84d11', opacity: canPublish ? 1 : 0.5 }]}>
            <Text style={{ color: '#fff', fontFamily: font.dmBold, fontSize: 14 }}>post</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
        <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 11, letterSpacing: 1.4 }}>THE DARE</Text>
        <TextInput
          placeholder="something specific and interesting people should actually go do..."
          placeholderTextColor={colors.text3}
          value={title}
          onChangeText={(t) => setTitle(t.slice(0, MAX_SIDEQUEST_TITLE))}
          maxLength={MAX_SIDEQUEST_TITLE}
          style={[styles.input, { color: colors.text1, borderColor: colors.border2, backgroundColor: colors.card, fontFamily: font.serifItalic }]}
          multiline
          textAlignVertical="top"
        />
        <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 10 }}>{title.length} / {MAX_SIDEQUEST_TITLE}</Text>
        <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 11, letterSpacing: 1.4, marginTop: 8 }}>SUBTITLE (OPTIONAL)</Text>
        <TextInput
          placeholder="one line that sets the mood..."
          placeholderTextColor={colors.text3}
          value={subtitle}
          onChangeText={(t) => setSubtitle(t.slice(0, MAX_SIDEQUEST_SUBTITLE))}
          maxLength={MAX_SIDEQUEST_SUBTITLE}
          style={[styles.subtitleInput, { color: colors.text1, borderColor: colors.border2, backgroundColor: colors.card, fontFamily: font.dm }]}
          textAlignVertical="center"
          {...(Platform.OS === 'android' ? { includeFontPadding: false } : {})}
        />
        <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 10 }}>{subtitle.length} / {MAX_SIDEQUEST_SUBTITLE}</Text>
        <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 11, letterSpacing: 1.4 }}>VIBE</Text>
        <View style={styles.row}>
          {CATEGORIES.map((c) => {
            const { emoji, title } = feedCategoryChipParts(c);
            const tk = feedV3TagSkin(scheme);
            const on = selected.includes(c);
            const skin = on ? feedV3BrowseFilterActiveSkin(scheme) : tk;
            return (
              <Pressable
                key={c}
                onPress={() => toggleCat(c)}
                style={[
                  styles.chip,
                  { borderColor: skin.borderColor, backgroundColor: skin.backgroundColor },
                ]}
              >
                <Text style={styles.chipEmoji}>{emoji}</Text>
                <Text style={[styles.chipLabel, { color: skin.color, fontFamily: font.dmBold }]}>{title}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: anonymous }}
          accessibilityLabel="Post as anonymous"
          onPress={() => setAnonymous((x) => !x)}
          style={({ pressed }) => [
            styles.anonRow,
            {
              borderColor: colors.border2,
              backgroundColor: colors.card,
              opacity: pressed ? 0.92 : 1,
            },
          ]}
        >
          <Text style={{ fontSize: 20 }}>🕶️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.anonTitle, { color: colors.text1, fontFamily: font.syne }]}>Post as anonymous</Text>
            <Text style={[styles.anonSub, { color: colors.text2, fontFamily: font.dm }]}>
              {anonymous
                ? 'Your username stays hidden when this idea is shown on the feed.'
                : 'Turn on to hide your username for this suggestion.'}
            </Text>
          </View>
          <View
            style={[
              styles.anonSwitchTrack,
              {
                backgroundColor: anonymous ? colors.accent : colors.bg3,
                borderColor: anonymous ? colors.accent : colors.border2,
                justifyContent: anonymous ? 'flex-end' : 'flex-start',
              },
            ]}
          >
            <View
              style={[
                styles.anonSwitchKnob,
                { backgroundColor: anonymous ? (scheme === 'light' ? '#fff' : '#0A0A0A') : colors.text3 },
              ]}
            />
          </View>
        </Pressable>
        <View style={[styles.creditBox, { borderColor: colors.border2, backgroundColor: colors.card }]}>
          <Text style={{ color: '#b84d11', fontFamily: font.dmBold, marginBottom: 8 }}>💡 how credit works</Text>
          <Text style={{ color: colors.text1, fontFamily: font.dm, lineHeight: 28, fontSize: 14 }}>
            Every time someone does your idea and links it back, you get credited on their post. Your "times credited" count lives on your profile.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: {
    paddingHorizontal: 18,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    paddingBottom: 12,
  },
  headSide: { width: 88, justifyContent: 'center' },
  headSideEnd: { alignItems: 'flex-end' },
  headCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18 },
  typePill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  postBtn: { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 18,
    minHeight: 140,
    textAlignVertical: 'top',
    lineHeight: 30,
  },
  subtitleInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 15,
    lineHeight: 20,
    paddingTop: Platform.OS === 'ios' ? 14 : 0,
    paddingBottom: Platform.OS === 'ios' ? 14 : 0,
    paddingVertical: Platform.OS === 'android' ? 0 : undefined,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    maxWidth: '100%',
    flexShrink: 1,
  },
  chipEmoji: { fontSize: 13, lineHeight: 16 },
  chipLabel: { fontSize: 10.5, lineHeight: 14 },
  creditBox: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 10 },
  publish: { marginTop: 8, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  anonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 4,
  },
  anonTitle: { fontSize: 13, fontWeight: '700' },
  anonSub: { fontSize: 11, marginTop: 4, lineHeight: 15 },
  anonSwitchTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  anonSwitchKnob: { width: 20, height: 20, borderRadius: 10 },
});
