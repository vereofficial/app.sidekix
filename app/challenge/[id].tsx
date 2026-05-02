import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PeopleParticipationRow } from '../../src/components/PeopleParticipationRow';
import { PostMediaTile } from '../../src/components/PostMediaTile';
import { useAppTheme } from '../../src/context/AppThemeContext';
import { useLegacyChallengePosts } from '../../src/hooks/useLegacyChallengePosts';
import { feedCategoryChipParts } from '../../src/lib/categoryDisplay';
import { feedV3TagSkin } from '../../src/lib/feedV3Tokens';
import { participantDisplayLabelsFromPosts } from '../../src/lib/participantDisplayLabels';
import { tryGetSupabase } from '../../src/lib/supabase';
import type { ChallengeRow } from '../../src/types/database';
import { font, getColors } from '../../src/theme';

function detailPreviewColumns(count: number): 1 | 2 | 3 {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  return 3;
}

export default function LegacyChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const scheme = resolvedScheme;
  const colors = getColors(resolvedScheme);
  const { posts, usernames, loading, refresh } = useLegacyChallengePosts(id);
  const [challenge, setChallenge] = useState<ChallengeRow | null>(null);
  const participantLabels = useMemo(() => participantDisplayLabelsFromPosts(posts, usernames), [posts, usernames]);
  const completedCount = posts.length;
  const avatarRing = colors.card;
  const communityRating =
    completedCount === 0 ? 0 : Number(Math.min(5, 3.8 + Math.log10(completedCount + 1)).toFixed(1));
  const listCols = detailPreviewColumns(posts.length);
  const useSubmissionGrid = posts.length > 2;

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const sb = tryGetSupabase();
      if (!sb) return;
      const { data } = await sb.from('challenges').select('*').eq('id', id).maybeSingle();
      setChallenge((data as ChallengeRow | null) ?? null);
    };
    void load();
  }, [id]);

  const onBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/feed');
  };

  const postCaption = (p: (typeof posts)[0]) => (p.caption ?? p.body ?? '').trim();

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={{ color: colors.text1, fontSize: 18 }}>←</Text>
        </Pressable>
      </View>
      {challenge ? (
        <View style={[styles.hero, { borderColor: colors.border2, backgroundColor: colors.card }]}>
          {(challenge.categories?.length ?? 0) > 0 ? (
            <View style={styles.categoryRow}>
              {(challenge.categories ?? []).slice(0, 6).map((c, i) => {
                const tk = feedV3TagSkin(scheme);
                const { emoji, title } = feedCategoryChipParts(c);
                return (
                  <View
                    key={`${c}-${i}`}
                    style={[styles.categoryChip, { borderColor: tk.borderColor, backgroundColor: tk.backgroundColor }]}
                  >
                    <Text style={styles.categoryChipEmoji}>{emoji}</Text>
                    <Text style={[styles.categoryChipLabel, { color: tk.color, fontFamily: font.dmBold }]}>{title}</Text>
                  </View>
                );
              })}
            </View>
          ) : null}
          <Text style={[styles.heroTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>{challenge.title}</Text>
          <Text style={{ color: colors.text2, fontFamily: font.dm, marginTop: 8 }}>
            {challenge.subtitle?.trim() || 'A prompt from an earlier drop.'}
          </Text>
          <View style={[styles.heroPeopleRow, { marginTop: 10 }]}>
            <PeopleParticipationRow
              names={participantLabels}
              count={completedCount}
              colors={colors}
              avatarBorderColor={avatarRing}
              size="md"
            />
          </View>
          <View style={[styles.metricsRow, { marginTop: 8 }]}>
            <View style={styles.metricItem}>
              <Text style={[styles.metricValue, { color: colors.text1, fontFamily: font.dmBold }]}>
                {communityRating.toFixed(1)}
              </Text>
              <Text style={[styles.metricLabel, { color: colors.text3, fontFamily: font.mono }]}>rating</Text>
            </View>
          </View>
          <Pressable
            onPress={() => router.push({ pathname: '/new-adventure', params: { challengeId: id } })}
            style={[styles.questBtn, { backgroundColor: colors.accent }]}
          >
            <Text
              style={{ color: resolvedScheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.dmBold, fontSize: 16 }}
            >
              I did this quest ✓
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={{ marginHorizontal: 18, marginTop: 20, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
        </View>
      )}
      {loading && posts.length === 0 ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
      ) : useSubmissionGrid ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 28 + insets.bottom, paddingTop: 10, paddingHorizontal: 18 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
        >
          <View style={styles.submissionListGrid}>
            {posts.map((p) => (
              <View
                key={p.id}
                style={[
                  styles.submissionGridCell,
                  listCols === 2 && styles.submissionGridCell2,
                  listCols === 3 && styles.submissionGridCell3,
                  { borderColor: colors.border2, backgroundColor: colors.card },
                ]}
              >
                <View style={styles.submissionGridCellHead}>
                  <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 10 }} numberOfLines={1}>
                    {p.is_anonymous ? 'anonymous' : `@${usernames[p.user_id] ?? 'user'}`}
                  </Text>
                </View>
                <PostMediaTile
                  post={p}
                  style={styles.submissionGridMedia}
                  borderRadius={8}
                  compact={!(p.image_path || p.video_path)}
                />
                {postCaption(p) && (p.image_path || p.video_path) ? (
                  <Text numberOfLines={3} style={{ color: colors.text1, fontFamily: font.dm, marginTop: 6, fontSize: 12 }}>
                    {postCaption(p)}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 28 + insets.bottom, paddingTop: 10 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
        >
          {posts.map((p) => (
            <View key={p.id} style={[styles.card, { borderColor: colors.border2, backgroundColor: colors.card }]}>
              <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 10, marginBottom: 8 }}>
                {p.is_anonymous ? 'anonymous' : `@${usernames[p.user_id] ?? 'user'}`}
              </Text>
              {p.image_path || p.video_path ? (
                <PostMediaTile post={p} style={styles.media} borderRadius={10} />
              ) : null}
              {postCaption(p) ? (
                <Text style={{ color: colors.text2, fontFamily: font.dm, marginTop: 8 }}>{postCaption(p)}</Text>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { paddingHorizontal: 18, paddingTop: 12, flexDirection: 'row', alignItems: 'center' },
  hero: { marginHorizontal: 18, marginTop: 14, borderWidth: 1, borderRadius: 14, padding: 12 },
  categoryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  categoryChipEmoji: { fontSize: 13, lineHeight: 16 },
  categoryChipLabel: { fontSize: 10.5, lineHeight: 14 },
  heroTitle: { fontSize: 40, lineHeight: 46 },
  heroPeopleRow: { width: '100%' },
  metricsRow: { flexDirection: 'row', gap: 20 },
  metricItem: { alignItems: 'flex-start' },
  metricValue: { fontSize: 26, lineHeight: 28 },
  metricLabel: { fontSize: 10, letterSpacing: 0.9, textTransform: 'uppercase', marginTop: 2 },
  questBtn: { marginTop: 12, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  submissionListGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  submissionGridCell: { borderWidth: 1, borderRadius: 12, padding: 8, width: '100%' },
  submissionGridCell2: { width: '48.5%' },
  submissionGridCell3: { width: '31.5%' },
  submissionGridCellHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 6 },
  submissionGridMedia: { width: '100%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden' },
  card: { marginHorizontal: 18, marginTop: 12, borderWidth: 1, borderRadius: 14, padding: 10 },
  media: { width: '100%', aspectRatio: 4 / 3, borderRadius: 10, overflow: 'hidden' },
});
