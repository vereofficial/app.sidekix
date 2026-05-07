import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PeopleParticipationRow } from '../../src/components/PeopleParticipationRow';
import { PostMediaTile } from '../../src/components/PostMediaTile';
import { PostMediaViewerModal } from '../../src/components/PostMediaViewerModal';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/AppThemeContext';
import { useLegacyChallengePosts } from '../../src/hooks/useLegacyChallengePosts';
import { feedCategoryChipParts } from '../../src/lib/categoryDisplay';
import { feedV3TagSkin } from '../../src/lib/feedV3Tokens';
import { participantDisplayLabelsFromPosts } from '../../src/lib/participantDisplayLabels';
import { tryGetSupabase } from '../../src/lib/supabase';
import type { ChallengeRow, PostRow } from '../../src/types/database';
import type { MediaViewerPost } from '../../src/types/viewerPost';
import { font, getColors } from '../../src/theme';

function legacyPostToViewerPost(p: PostRow): MediaViewerPost {
  return {
    id: p.id,
    user_id: p.user_id,
    image_path: p.image_path,
    video_path: p.video_path,
    body: p.body,
    caption: p.caption,
  };
}

function detailPreviewColumns(count: number): 1 | 2 | 3 {
  if (count <= 1) return 1;
  if (count <= 4) return 2;
  return 3;
}

export default function LegacyChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { resolvedScheme } = useAppTheme();
  const scheme = resolvedScheme;
  const colors = getColors(resolvedScheme);
  const { posts, usernames, loading, refresh } = useLegacyChallengePosts(id);
  const [challenge, setChallenge] = useState<ChallengeRow | null>(null);
  const participantLabels = useMemo(() => participantDisplayLabelsFromPosts(posts, usernames), [posts, usernames]);
  const completedCount = posts.length;
  const avatarRing = colors.card;
  const userHasPosted = Boolean(user?.id && posts.some((p) => p.user_id === user.id));

  const mediaPosts = useMemo(
    () => posts.filter((p) => Boolean(p.image_path?.trim() || p.video_path?.trim())),
    [posts],
  );
  const listCols = detailPreviewColumns(mediaPosts.length);
  const useSubmissionGrid = posts.length > 2;

  const [heroTitleFontSize, setHeroTitleFontSize] = useState(40);
  const [viewerPost, setViewerPost] = useState<MediaViewerPost | null>(null);

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

  useEffect(() => {
    setHeroTitleFontSize(40);
  }, [challenge?.id, challenge?.title]);

  const onBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/feed');
  };

  const postCaption = (p: (typeof posts)[0]) => (p.caption ?? p.body ?? '').trim();

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 28 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />}
      >
        <View style={styles.topBar}>
          <Pressable onPress={onBack} hitSlop={12}>
            <Text style={{ color: colors.text1, fontSize: 18 }}>←</Text>
          </Pressable>
        </View>

        {!challenge ? (
          <View style={{ marginHorizontal: 18, marginTop: 20, alignItems: 'center' }}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
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
            <Text
              style={[
                styles.heroTitle,
                {
                  color: colors.text1,
                  fontFamily: font.syneExtra,
                  fontSize: heroTitleFontSize,
                  lineHeight: heroTitleFontSize + 6,
                },
              ]}
              onTextLayout={(e) => {
                const lineCount = e.nativeEvent.lines.length;
                if (lineCount > 3 && heroTitleFontSize > 24) {
                  setHeroTitleFontSize((prev) => Math.max(24, prev - 2));
                }
              }}
            >
              {challenge.title}
            </Text>
            <Text style={{ color: colors.text2, fontFamily: font.dm, marginTop: 8 }}>
              {challenge.subtitle?.trim() || 'Pick a spot, do the quest, post what happened.'}
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

            {userHasPosted ? (
              <View
                style={[
                  styles.postedPill,
                  {
                    backgroundColor: colors.bg3,
                    borderColor: colors.border2,
                    marginTop: 12,
                  },
                ]}
                accessibilityRole="text"
                accessibilityLabel="Posted"
              >
                <Text style={{ color: colors.text1, fontFamily: font.dmBold, fontSize: 15, textAlign: 'center' }}>
                  Posted ✓
                </Text>
              </View>
            ) : (
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
            )}
          </View>
        )}

        {loading && posts.length === 0 ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
        ) : useSubmissionGrid ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 10 }}>
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
                  {p.image_path || p.video_path ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="View photo or video fullscreen"
                      onPress={() => setViewerPost(legacyPostToViewerPost(p))}
                      style={styles.submissionGridMedia}
                    >
                      <PostMediaTile
                        post={p}
                        style={StyleSheet.absoluteFillObject}
                        borderRadius={8}
                        compact={false}
                      />
                    </Pressable>
                  ) : (
                    <PostMediaTile
                      post={p}
                      style={styles.submissionGridMedia}
                      borderRadius={8}
                      compact
                    />
                  )}
                  {postCaption(p) && (p.image_path || p.video_path) ? (
                    <Text numberOfLines={3} style={{ color: colors.text1, fontFamily: font.dm, marginTop: 6, fontSize: 12 }}>
                      {postCaption(p)}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={{ paddingTop: 10 }}>
            {posts.map((p) => (
              <View
                key={p.id}
                style={[styles.card, { borderColor: colors.border2, backgroundColor: colors.card, marginHorizontal: 18 }]}
              >
                <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 10, marginBottom: 8 }}>
                  {p.is_anonymous ? 'anonymous' : `@${usernames[p.user_id] ?? 'user'}`}
                </Text>
                {p.image_path || p.video_path ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="View photo or video fullscreen"
                    onPress={() => setViewerPost(legacyPostToViewerPost(p))}
                  >
                    <PostMediaTile post={p} style={styles.media} borderRadius={10} />
                  </Pressable>
                ) : null}
                {postCaption(p) ? (
                  <Text style={{ color: colors.text2, fontFamily: font.dm, marginTop: 8 }}>{postCaption(p)}</Text>
                ) : null}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <PostMediaViewerModal
        post={viewerPost}
        visible={viewerPost !== null}
        onClose={() => setViewerPost(null)}
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
  postedPill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  questBtn: { marginTop: 12, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
  submissionListGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  submissionGridCell: { borderWidth: 1, borderRadius: 12, padding: 8, width: '100%' },
  submissionGridCell2: { width: '48.5%' },
  submissionGridCell3: { width: '31.5%' },
  submissionGridCellHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 6 },
  submissionGridMedia: { width: '100%', aspectRatio: 1, borderRadius: 8, overflow: 'hidden' },
  card: { marginTop: 12, borderWidth: 1, borderRadius: 14, padding: 10 },
  media: { width: '100%', aspectRatio: 4 / 3, borderRadius: 10, overflow: 'hidden' },
});
