import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PostMediaViewerModal } from '../../src/components/PostMediaViewerModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PeopleParticipationRow } from '../../src/components/PeopleParticipationRow';
import { PostMediaTile } from '../../src/components/PostMediaTile';
import { SidequestTextSubmissionCard } from '../../src/components/SidequestTextSubmissionCard';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/AppThemeContext';
import { useSidequestPosts } from '../../src/hooks/useSidequestPosts';
import { feedCategoryChipParts } from '../../src/lib/categoryDisplay';
import { feedV3TagSkin } from '../../src/lib/feedV3Tokens';
import { participantDisplayLabelsFromPosts } from '../../src/lib/participantDisplayLabels';
import { tryGetSupabase } from '../../src/lib/supabase';
import { font, getColors } from '../../src/theme';
import type { MediaViewerPost } from '../../src/types/viewerPost';
import type { SidequestPostRow, SidequestRow } from '../../src/types/database';

function sidequestPostToViewerPost(p: SidequestPostRow): MediaViewerPost {
  return {
    id: p.id,
    user_id: p.user_id,
    image_path: p.image_path,
    video_path: p.video_path,
    body: p.body,
  };
}

function detailPreviewColumns(count: number): 1 | 2 | 3 {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  return 3;
}

function hasSubmissionMedia(p: SidequestPostRow): boolean {
  return Boolean(p.image_path?.trim() || p.video_path?.trim());
}

type RatingStats = { avg_stars: number; rating_count: number };

export default function SidequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const scheme = resolvedScheme;
  const colors = getColors(resolvedScheme);
  const { user, isAdmin } = useAuth();
  const [viewerPost, setViewerPost] = useState<MediaViewerPost | null>(null);
  const [sidequest, setSidequest] = useState<SidequestRow | null>(null);
  const { posts, usernames, loading, refresh } = useSidequestPosts(id);
  const completedCount = posts.length;
  const participantLabels = useMemo(() => participantDisplayLabelsFromPosts(posts, usernames), [posts, usernames]);
  const avatarRing = colors.card;
  /** Compact “buzz” score from participation count — not user-submitted ratings. */
  const activityScore =
    completedCount === 0 ? 0 : Number(Math.min(5, 3.8 + Math.log10(completedCount + 1)).toFixed(1));
  const mediaPosts = useMemo(() => posts.filter(hasSubmissionMedia), [posts]);
  const listCols = detailPreviewColumns(mediaPosts.length);
  const userHasPosted = Boolean(user?.id && posts.some((p) => p.user_id === user.id));
  const [ratingStats, setRatingStats] = useState<RatingStats | null>(null);
  const [myRatingStars, setMyRatingStars] = useState<number | null>(null);

  const loadRatingStats = useCallback(async () => {
    const sb = tryGetSupabase();
    if (!sb || !id) return;
    const { data, error } = await sb.rpc('get_sidequest_rating_stats', { p_sidequest_id: id });
    if (error || data == null) {
      setRatingStats(null);
      return;
    }
    const raw = data as { avg_stars?: unknown; rating_count?: unknown };
    const avg = Number(raw.avg_stars);
    const n = Number(raw.rating_count);
    if (!Number.isFinite(avg) || !Number.isFinite(n)) {
      setRatingStats(null);
      return;
    }
    setRatingStats({ avg_stars: avg, rating_count: n });
  }, [id]);

  useEffect(() => {
    const load = async () => {
      const sb = tryGetSupabase();
      if (!sb || !id) return;
      const { data } = await sb.from('sidequests').select('*').eq('id', id).maybeSingle();
      setSidequest((data ?? null) as SidequestRow | null);
    };
    void load();
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void loadRatingStats();
      void (async () => {
        const sb = tryGetSupabase();
        if (!sb || !user?.id || !id) {
          setMyRatingStars(null);
          return;
        }
        const { data } = await sb
          .from('sidequest_experience_ratings')
          .select('stars')
          .eq('user_id', user.id)
          .eq('sidequest_id', id)
          .maybeSingle();
        const row = data as { stars?: number } | null;
        setMyRatingStars(typeof row?.stars === 'number' ? row.stars : null);
      })();
    }, [loadRatingStats, user?.id, id]),
  );

  const removeAdventure = async (postId: string) => {
    const sb = tryGetSupabase();
    if (!sb) return;
    const { error } = await sb.from('sidequest_posts').delete().eq('id', postId);
    if (!error) await refresh();
  };

  const viewerCanDelete =
    Boolean(viewerPost) && (isAdmin || user?.id === viewerPost?.user_id);

  const closeViewer = () => setViewerPost(null);

  const deleteViewerPost = async () => {
    if (!viewerPost) return;
    await removeAdventure(viewerPost.id);
    closeViewer();
  };
  const onBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/feed');
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 28 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={{ color: colors.text1, fontSize: 18 }}>←</Text>
          </Pressable>
        </View>
        {sidequest ? (
          <View style={[styles.hero, { borderColor: colors.border2, backgroundColor: colors.card }]}>
            {(sidequest.categories?.length ?? 0) > 0 ? (
              <View style={styles.categoryRow}>
                {(sidequest.categories ?? []).slice(0, 6).map((c, i) => {
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
            <Text style={[styles.heroTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>{sidequest.title}</Text>
            <Text style={{ color: colors.text2, fontFamily: font.dm, marginTop: 8 }}>
              {sidequest.subtitle?.trim() || 'Pick a spot, do the quest, post what happened.'}
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
                  {activityScore.toFixed(1)}
                </Text>
                <Text style={[styles.metricLabel, { color: colors.text3, fontFamily: font.mono }]}>activity</Text>
              </View>
              {ratingStats && ratingStats.rating_count > 0 ? (
                <View style={styles.metricItem}>
                  <Text style={[styles.metricValue, { color: colors.text1, fontFamily: font.dmBold }]}>
                    {ratingStats.avg_stars.toFixed(1)}
                  </Text>
                  <Text style={[styles.metricLabel, { color: colors.text3, fontFamily: font.mono }]}>idea rating</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ color: colors.text3, fontFamily: font.dm, fontSize: 11, marginTop: 4, lineHeight: 15 }}>
              Activity is how often people complete this prompt.
              {ratingStats && ratingStats.rating_count > 0
                ? ` Idea rating is the average star score from adventurers after they post (${ratingStats.rating_count} ${
                    ratingStats.rating_count === 1 ? 'rating' : 'ratings'
                  }).`
                : ' Idea ratings show up here after adventurers save a star rating when they post.'}
            </Text>
            {userHasPosted ? (
              <View
                style={[
                  styles.questBtn,
                  {
                    backgroundColor: colors.bg3,
                    borderWidth: 1,
                    borderColor: colors.border2,
                    marginTop: 12,
                  },
                ]}
              >
                <Text style={{ color: colors.text1, fontFamily: font.dmBold, fontSize: 16, textAlign: 'center' }}>
                  You’re in ✓
                </Text>
                <Text
                  style={{
                    color: colors.text2,
                    fontFamily: font.dm,
                    fontSize: 12,
                    textAlign: 'center',
                    marginTop: 6,
                    lineHeight: 17,
                  }}
                >
                  You already posted an adventure for this sidequest.
                </Text>
                {myRatingStars == null ? (
                  <Pressable
                    onPress={() => router.push({ pathname: '/rate-sidequest', params: { sidequestId: id } })}
                    style={{ marginTop: 14 }}
                  >
                    <Text style={{ color: colors.accent, fontFamily: font.dmBold, fontSize: 14, textAlign: 'center' }}>
                      Rate this idea ★
                    </Text>
                  </Pressable>
                ) : (
                  <Text
                    style={{
                      color: colors.text3,
                      fontFamily: font.dm,
                      fontSize: 12,
                      textAlign: 'center',
                      marginTop: 10,
                    }}
                  >
                    You rated this idea {myRatingStars}★ — thanks.
                  </Text>
                )}
              </View>
            ) : (
              <Pressable
                onPress={() => router.push({ pathname: '/new-adventure', params: { sidequestId: id } })}
                style={[styles.questBtn, { backgroundColor: colors.accent }]}
              >
                <Text
                  style={{ color: resolvedScheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.dmBold, fontSize: 16 }}
                >
                  I did this quest ✓
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
        ) : (
          <View style={[styles.submissionsSection, { paddingHorizontal: 18, paddingTop: 10 }]}>
            <View style={styles.submissionListGrid}>
              {posts.map((p) => {
                const textOnly = !hasSubmissionMedia(p);
                if (textOnly) {
                  const displayName = p.is_anonymous ? 'anonymous' : usernames[p.user_id] ?? 'user';
                  return (
                    <View key={p.id} style={styles.submissionFullBleed}>
                      <SidequestTextSubmissionCard
                        post={p}
                        displayName={displayName}
                        colors={colors}
                        scheme={scheme}
                        canRemove={Boolean(isAdmin || user?.id === p.user_id)}
                        onRemove={
                          isAdmin || user?.id === p.user_id ? () => void removeAdventure(p.id) : undefined
                        }
                      />
                    </View>
                  );
                }
                return (
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
                      {(isAdmin || user?.id === p.user_id) ? (
                        <Pressable onPress={() => void removeAdventure(p.id)} hitSlop={6}>
                          <Text style={{ color: '#f66', fontFamily: font.dmBold, fontSize: 10 }}>remove</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="View photo or video fullscreen"
                      onPress={() => setViewerPost(sidequestPostToViewerPost(p))}
                      style={styles.submissionGridMedia}
                    >
                      <PostMediaTile
                        post={{
                          ...p,
                          challenge_id: 'sidequest',
                          caption: p.body,
                          text_style: null,
                        }}
                        style={StyleSheet.absoluteFillObject}
                        borderRadius={8}
                      />
                    </Pressable>
                    {p.body?.trim() ? (
                      <Text
                        numberOfLines={4}
                        style={{ color: colors.text1, fontFamily: font.dm, marginTop: 8, fontSize: 13, lineHeight: 19 }}
                      >
                        {p.body}
                      </Text>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>
      <PostMediaViewerModal
        post={viewerPost}
        visible={viewerPost !== null}
        onClose={closeViewer}
        canDelete={viewerCanDelete}
        onDelete={viewerCanDelete ? deleteViewerPost : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  topBar: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 8, flexDirection: 'row', alignItems: 'center' },
  hero: { marginHorizontal: 18, marginTop: 0, borderWidth: 1, borderRadius: 14, padding: 12 },
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
  submissionsSection: {},
  submissionFullBleed: { width: '100%' },
  submissionListGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  submissionGridCell: { borderWidth: 1, borderRadius: 12, padding: 8, width: '100%' },
  submissionGridCell2: { width: '48.5%' },
  submissionGridCell3: { width: '31.5%' },
  submissionGridCellHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 6 },
  submissionGridMedia: { width: '100%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden' },
});
