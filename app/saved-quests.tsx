import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/AppThemeContext';
import { useSavedSidequests } from '../src/hooks/useSavedSidequests';
import { feedCategoryChipParts } from '../src/lib/categoryDisplay';
import { font, getColors } from '../src/theme';

const TABLET_CONTENT_MAX = 560;

type MergedRow = {
  kind: 'sidequest' | 'challenge';
  key: string;
  saved_at: string;
  title: string;
  categories: string[];
  path: string;
};

/** Saved sidequests and challenge bookmarks (stack screen — not part of tab bar). */
export default function SavedQuestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const { user } = useAuth();
  const { saved, savedChallenges, loading, refresh } = useSavedSidequests(user?.id);
  const [refreshing, setRefreshing] = useState(false);

  const merged = useMemo((): MergedRow[] => {
    const sq: MergedRow[] = saved.map((s) => ({
      kind: 'sidequest',
      key: `sq-${s.sidequest.id}`,
      saved_at: s.saved_at,
      title: s.sidequest.title,
      categories: s.sidequest.categories ?? [],
      path: `/sidequest/${s.sidequest.id}`,
    }));
    const ch: MergedRow[] = savedChallenges.map((s) => ({
      kind: 'challenge',
      key: `ch-${s.challenge.id}`,
      saved_at: s.saved_at,
      title: s.challenge.title,
      categories: s.challenge.categories ?? ['legacy'],
      path: `/challenge/${s.challenge.id}`,
    }));
    return [...sq, ...ch].sort((a, b) => b.saved_at.localeCompare(a.saved_at));
  }, [saved, savedChallenges]);

  const onPull = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const onBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/home');
  };

  const empty = !loading && merged.length === 0;

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={[styles.headRow, { paddingHorizontal: 18 }]}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={{ color: colors.text1, fontFamily: font.syne, fontSize: 18 }}>←</Text>
        </Pressable>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 28 + Math.max(insets.bottom, 8), alignItems: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPull} tintColor={colors.accent} />}
      >
        <View style={{ width: '100%', maxWidth: TABLET_CONTENT_MAX }}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: colors.text1, fontFamily: font.syneExtra }]}>saved quests</Text>
            <Text style={[styles.sub, { color: colors.text2, fontFamily: font.dm }]}>
              Ideas you bookmarked from the Feed — they show on Home too.
            </Text>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 18 }} />
          ) : empty ? (
            <View style={[styles.emptyTip, { borderColor: colors.border2, backgroundColor: colors.card }]}>
              <Text style={{ color: colors.text2, fontFamily: font.dm, lineHeight: 18, textAlign: 'center' }}>
                Tap + save on an idea card in the Feed — it appears on Home and here.
              </Text>
              <Pressable onPress={() => router.replace('/(tabs)/feed')} style={{ marginTop: 10 }}>
                <Text style={{ color: colors.accent, fontFamily: font.syne, fontWeight: '800', textAlign: 'center' }}>
                  browse feed →
                </Text>
              </Pressable>
              <Pressable onPress={() => router.replace('/(tabs)/home')} style={{ marginTop: 8 }}>
                <Text style={{ color: colors.lightAccent, fontFamily: font.dmBold, textAlign: 'center', fontSize: 13 }}>
                  open Home tab →
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.savedList}>
              {merged.map((row) => (
                <Pressable
                  key={row.key}
                  onPress={() => router.push(row.path)}
                  style={({ pressed }) => [
                    styles.savedCard,
                    { borderColor: colors.border2, backgroundColor: colors.card, opacity: pressed ? 0.93 : 1 },
                  ]}
                >
                  <Text style={{ color: colors.text3, fontFamily: font.syne, fontSize: 10 }}>saved for later</Text>
                  <Text style={[styles.savedTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>{row.title}</Text>
                  <View style={styles.savedCats}>
                    {row.categories.slice(0, 3).map((c, i) => {
                      const { title } = feedCategoryChipParts(c);
                      return (
                        <View key={`${row.key}-c${i}`} style={[styles.savedCat, { borderColor: colors.border2, backgroundColor: colors.bg3 }]}>
                          <Text style={{ color: colors.text2, fontFamily: font.syne, fontSize: 10 }}>{title}</Text>
                        </View>
                      );
                    })}
                  </View>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  headRow: { paddingTop: 4, paddingBottom: 8 },
  head: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 10 },
  title: { fontSize: 22, letterSpacing: -0.3 },
  sub: { fontSize: 12, lineHeight: 18, marginTop: 6, maxWidth: 360 },
  savedList: { paddingHorizontal: 18, gap: 10, paddingBottom: 8 },
  savedCard: { borderWidth: 1, borderRadius: 14, padding: 12 },
  savedTitle: { fontSize: 16, lineHeight: 22, marginTop: 4 },
  savedCats: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  savedCat: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  emptyTip: { marginHorizontal: 18, borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 4 },
});
