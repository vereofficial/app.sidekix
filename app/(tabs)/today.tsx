import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { challengeTag, splitChallengeTitle } from '../../src/challenge';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/AppThemeContext';
import { useMyPosts } from '../../src/hooks/useMyPosts';
import { usePostCount } from '../../src/hooks/usePostCount';
import { usePostsForChallenge } from '../../src/hooks/usePostsForChallenge';
import { usePastChallenges } from '../../src/hooks/usePastChallenges';
import { useTodayChallenge } from '../../src/hooks/useTodayChallenge';
import { PostMediaTile } from '../../src/components/PostMediaTile';
import { SidekixTabState } from '../../src/components/SidekixTabState';
import { Wordmark } from '../../src/components/Wordmark';
import { upvotesLabel } from '../../src/lib/formatCount';
import { tryGetSupabase } from '../../src/lib/supabase';
import { font, getColors } from '../../src/theme';
import type { PostRow } from '../../src/types/database';

function formatTimeLeftMs(ms: number): string {
  if (ms <= 0) return '0h 0m left';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m left`;
}

function parseLocalYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map((n) => parseInt(n, 10));
  return new Date(y, (m || 1) - 1, d || 1);
}

/** e.g. "yesterday", "3 days ago", "Jan 5" — for past challenge rows. */
function formatRelativePastDay(dayYmd: string): string {
  const then = parseLocalYmd(dayYmd);
  then.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((today.getTime() - then.getTime()) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const scheme = resolvedScheme;
  const { user } = useAuth();
  const { challenge, loading: chLoad, error: chErr, refresh: refCh } = useTodayChallenge();
  const { count: postCount, refresh: refCount } = usePostCount(challenge?.id ?? null);
  const { posts: recent, loading: recLoad, refresh: refRecent } = usePostsForChallenge(
    challenge?.id ?? null,
    12,
    undefined,
    !chLoad,
  );
  const { posts: myPosts, loading: myLoad, refresh: refMyPosts } = useMyPosts(user?.id);
  const { pastChallenges, refresh: refPast } = usePastChallenges();
  useFocusEffect(
    useCallback(() => {
      void Promise.all([refCh(), refCount(), refRecent(), refPast(), refMyPosts()]);
    }, [refCh, refCount, refRecent, refPast, refMyPosts]),
  );

  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [stripNames, setStripNames] = useState<Record<string, string>>({});
  const [didHydrateMyPosts, setDidHydrateMyPosts] = useState(false);
  const [pastPostCounts, setPastPostCounts] = useState<Record<string, number>>({});
  /** Avoid full-screen spinner on every tab focus refetch when today has no challenge (refCh sets loading=true). */
  const challengeFetchCompletedOnceRef = useRef(false);
  const [challengeRetryPending, setChallengeRetryPending] = useState(false);

  useEffect(() => {
    if (!chLoad) challengeFetchCompletedOnceRef.current = true;
  }, [chLoad]);

  useEffect(() => {
    if (!chLoad && challengeRetryPending) setChallengeRetryPending(false);
  }, [chLoad, challengeRetryPending]);

  const msLeft = useMemo(() => {
    const e = new Date();
    e.setHours(23, 59, 59, 999);
    return e.getTime() - Date.now();
  }, [tick]);

  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (user?.id) setDidHydrateMyPosts(false);
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setDidHydrateMyPosts(true);
      return;
    }
    if (!myLoad) setDidHydrateMyPosts(true);
  }, [user?.id, myLoad]);

  const completedPastIds = useMemo(() => {
    return new Set(myPosts.map((p) => p.challenge_id));
  }, [myPosts]);

  /** Newest post per challenge (feed order is created_at desc). */
  const myPostByChallengeId = useMemo(() => {
    const m = new Map<string, PostRow>();
    for (const p of myPosts) {
      if (!m.has(p.challenge_id)) m.set(p.challenge_id, p);
    }
    return m;
  }, [myPosts]);

  const postedToday = useMemo(() => {
    if (!challenge) return false;
    return myPosts.some((p) => p.challenge_id === challenge.id);
  }, [challenge, myPosts]);

  const myPostToday: PostRow | null = useMemo(() => {
    if (!challenge) return null;
    return myPosts.find((p) => p.challenge_id === challenge.id) ?? null;
  }, [challenge, myPosts]);

  const firstPosterOnly = Boolean(postedToday && postCount === 1 && myPostToday);
  const canUploadToday = Boolean(challenge && !postedToday);
  const campusHasPostsOthers = !postedToday && postCount > 0;
  const emptyCampus = !postedToday && postCount === 0;

  const myVotesOnPost = useMemo(() => {
    if (!myPostToday) return 0;
    const hit = recent.find((p) => p.id === myPostToday.id);
    return hit?.vote_count ?? 0;
  }, [myPostToday, recent]);

  const captionPreview = (post: PostRow) => {
    const t = (post.body ?? post.caption ?? '').trim();
    return t || '—';
  };

  useEffect(() => {
    const load = async () => {
      const ids = [...new Set(recent.map((p) => p.user_id))];
      if (ids.length === 0) {
        setStripNames({});
        return;
      }
      const sb = tryGetSupabase();
      if (!sb) return;
      const { data } = await sb.from('profiles').select('id, username').in('id', ids);
      const m: Record<string, string> = {};
      (data ?? []).forEach((r: { id: string; username: string }) => {
        m[r.id] = r.username;
      });
      setStripNames(m);
    };
    void load();
  }, [recent]);

  const sublineCampus = useMemo(() => {
    if (postCount === 0) return "no one's posted yet. be first.";
    if (postCount < 10) {
      if (postCount === 1) return 'Someone went first — campus is still wide open.';
      if (postCount < 4) return 'A handful of posts so far — the feed is still wide open.';
      return 'A few posts so far — campus is warming up.';
    }
    return `${postCount} people have posted so far.`;
  }, [postCount]);

  const postedSubline = useMemo(() => {
    if (postCount <= 1) return "you're first on campus today.";
    if (postCount < 10) return 'Others are posting too — see how it plays out on the feed.';
    const others = postCount - 1;
    return `${others} other ${others === 1 ? 'person has' : 'people have'} posted today too.`;
  }, [postCount]);

  const showRecentSection = postCount > 0 && !firstPosterOnly && !campusHasPostsOthers;
  /** Recent calendar challenges before today; status = user posted or not. */
  const pastRowsToShow = useMemo(() => pastChallenges.slice(0, 8), [pastChallenges]);
  const showPastSection = pastRowsToShow.length > 0;

  useEffect(() => {
    const ids = pastRowsToShow.map((c) => c.id);
    if (ids.length === 0) {
      setPastPostCounts({});
      return;
    }
    const sb = tryGetSupabase();
    if (!sb) return;
    let cancelled = false;
    void (async () => {
      const { data } = await sb.from('posts').select('challenge_id').in('challenge_id', ids);
      if (cancelled) return;
      const m: Record<string, number> = {};
      (data ?? []).forEach((row: { challenge_id: string }) => {
        m[row.challenge_id] = (m[row.challenge_id] ?? 0) + 1;
      });
      setPastPostCounts(m);
    })();
    return () => {
      cancelled = true;
    };
  }, [pastRowsToShow]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refCh(), refCount(), refRecent(), refPast(), refMyPosts()]);
    setRefreshing(false);
  };

  const renderChallengeHeading = (centered: boolean) =>
    challenge ? (
      <>
        <Text
          style={[
            styles.challengeTag,
            { color: colors.text3, fontFamily: font.syne },
            centered && styles.challengeHeadingCenter,
          ]}
        >
          {challengeTag(challenge)}
        </Text>
        <Text
          style={[
            styles.challengeTitle,
            { color: colors.text1, fontFamily: font.syneExtra },
            centered && styles.challengeHeadingCenter,
          ]}
        >
          {(() => {
            const { before, after } = splitChallengeTitle(challenge);
            return (
              <>
                {before}
                <Text style={{ color: colors.accent, fontStyle: 'normal' }}>{challenge.emphasis}</Text>
                {after}
              </>
            );
          })()}
        </Text>
      </>
    ) : null;

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        <View style={styles.topRow}>
          <Wordmark colors={colors} />
          <View style={[styles.timerPill, { backgroundColor: colors.pillBg, borderColor: colors.border2 }]}>
            <View style={[styles.pillDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.timerText, { color: colors.accent, fontFamily: font.syne }]}>
              {formatTimeLeftMs(msLeft)}
            </Text>
          </View>
        </View>

        {/** Challenge spinner: first load + explicit try again — not on background refetch when empty (tab focus). */}
        {(chLoad &&
          (chErr != null || !challenge) &&
          (!challengeFetchCompletedOnceRef.current || challengeRetryPending)) ||
        (Boolean(challenge) && chErr == null && Boolean(user?.id) && !didHydrateMyPosts) ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 28 }} />
        ) : chErr ? (
          <SidekixTabState
            variant="today"
            reason="error"
            colors={colors}
            scheme={scheme}
            minHeight={Math.max(380, winH - insets.top - 120)}
            onRetry={() => {
              setChallengeRetryPending(true);
              void refCh();
            }}
          />
        ) : !challenge ? (
          <SidekixTabState
            variant="today"
            reason="no-challenge"
            colors={colors}
            scheme={scheme}
            minHeight={Math.max(380, winH - insets.top - 120)}
            onRetry={() => {
              setChallengeRetryPending(true);
              void refCh();
            }}
          />
        ) : postedToday && myPostToday ? (
          <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
            {renderChallengeHeading(false)}
            <Text style={[styles.challengeSub, { color: colors.text2, fontFamily: font.dm, marginTop: 8 }]}>
              {postedSubline}
            </Text>
            <Pressable
              onPress={() => router.push('/sharecard')}
              style={({ pressed }) => [styles.heroPostCard, { borderColor: colors.border2, opacity: pressed ? 0.95 : 1 }]}
            >
              <View style={styles.heroPostMedia}>
                <PostMediaTile post={myPostToday} style={StyleSheet.absoluteFillObject} borderRadius={16} />
                <LinearGradient colors={['transparent', 'rgba(0,0,0,0.75)']} style={styles.heroFade} />
                <View style={[styles.postedPill, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.postedPillText, { color: scheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.syne }]}>
                    ✓ posted
                  </Text>
                </View>
                <View style={styles.heroCaptionBlock}>
                  <Text style={[styles.heroCaption, { color: '#fff', fontFamily: font.dm }]} numberOfLines={2}>
                    {captionPreview(myPostToday)}
                  </Text>
                  <Text style={[styles.heroVotes, { color: colors.accent, fontFamily: font.syne }]}>
                    ▲ {upvotesLabel(myVotesOnPost)} so far
                  </Text>
                </View>
                <View style={styles.heroSharePill}>
                  <Text style={[styles.heroSharePillText, { fontFamily: font.syne }]}>share ↗</Text>
                </View>
              </View>
            </Pressable>
          </View>
        ) : (
          <View
            style={
              emptyCampus
                ? [styles.todayMainCenter, { minHeight: Math.max(360, winH - insets.top - 88) }]
                : undefined
            }
          >
            {emptyCampus ? (
              <View style={styles.emptyTodayWrap}>
                <View style={[styles.emptyTodayGlow, { backgroundColor: resolvedScheme === 'dark' ? '#D4FF3F18' : '#5a7a0014' }]} />
                <View style={styles.emptyTodayCenter}>
                  {renderChallengeHeading(true)}
                  <Text style={[styles.emptyTodayDeadline, { color: colors.text2, fontFamily: font.dm, marginTop: 14 }]}>
                    you have until midnight.
                  </Text>
                  {canUploadToday ? (
                    <Pressable
                      onPress={() => router.push('/upload')}
                      style={({ pressed }) => [
                        styles.emptyTodayCta,
                        { backgroundColor: colors.accent, opacity: pressed ? 0.92 : 1 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.emptyTodayCtaText,
                          { color: resolvedScheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.syne },
                        ]}
                      >
                        post your take →
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ) : (
              <View style={styles.hero}>
                {renderChallengeHeading(false)}
                <Text style={[styles.challengeSub, { color: colors.text2, fontFamily: font.dm, marginTop: 8 }]}>
                  {sublineCampus}
                </Text>
              </View>
            )}

            {!emptyCampus && campusHasPostsOthers && canUploadToday ? (
              <Pressable
                onPress={() => router.push('/upload')}
                style={({ pressed }) => [
                  styles.submitZone,
                  {
                    borderColor: colors.border2,
                    backgroundColor: colors.card,
                    opacity: pressed ? 0.95 : 1,
                  },
                ]}
              >
                <Text style={{ fontSize: 28 }}>📸</Text>
                <Text style={[styles.szTitle, { color: colors.text1, fontFamily: font.syne }]}>post your take</Text>
                <Text style={[styles.szSub, { color: colors.text3, fontFamily: font.dm }]}>tap to upload</Text>
              </Pressable>
            ) : null}

          </View>
        )}

        {campusHasPostsOthers && !recLoad ? (
          <View style={{ marginTop: 8 }}>
            <View style={styles.sectionRow}>
              <Text style={[styles.sectionTitle, { color: colors.text3, fontFamily: font.syne }]}>so far today</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripTall}>
              {recent.map((p) => (
                <View key={p.id} style={styles.pcTall}>
                  <PostMediaTile post={p} style={{ width: '100%', height: 112, borderRadius: 12 }} borderRadius={12} />
                  <Text style={[styles.stripHandle, { color: colors.text2, fontFamily: font.syne }]} numberOfLines={1}>
                    {p.is_anonymous ? 'anon' : `@${stripNames[p.user_id] ?? '…'}`}
                  </Text>
                </View>
              ))}
            </ScrollView>
          </View>
        ) : campusHasPostsOthers && recLoad ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 16 }} />
        ) : null}

        {showRecentSection ? (
          <>
            <View style={styles.sectionRow}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.text3, fontFamily: font.syne }]}>
                  {postCount < 10 ? 'Campus so far' : 'Recent submissions'}
                </Text>
              </View>
            </View>
            {recLoad ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} />
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={[styles.strip, !showPastSection && styles.stripExpanded]}
              >
                {recent.map((p) => (
                  <View key={p.id} style={[styles.pc, !showPastSection && styles.pcExpanded]}>
                    <PostMediaTile
                      post={p}
                      style={!showPastSection ? { width: 104, height: 104 } : { width: 72, height: 72 }}
                      borderRadius={!showPastSection ? 12 : 10}
                    />
                    <View style={styles.pvWrap}>
                      <Text style={[styles.pv, { color: colors.accent, fontFamily: font.syne }]}>▲ {p.vote_count}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </>
        ) : null}

        {showPastSection ? (
          <>
            <View style={[styles.sectionRow, { marginTop: 6 }]}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: scheme === 'light' ? '#A0A0A0' : colors.text3, fontFamily: font.syne },
                ]}
              >
                Past sidequests
              </Text>
            </View>
            {pastRowsToShow.map((c) => {
              const done = completedPastIds.has(c.id);
              const n = pastPostCounts[c.id] ?? 0;
              const myPost = myPostByChallengeId.get(c.id);
              return (
                <View
                  key={c.id}
                  style={[styles.pastCard, { backgroundColor: colors.card, borderColor: colors.border2 }]}
                >
                  {myPost ? (
                    <Pressable
                      onPress={() => router.push(`/submission/${myPost.id}`)}
                      style={({ pressed }) => [styles.pastThumbWrap, { opacity: pressed ? 0.92 : 1 }]}
                      accessibilityRole="button"
                      accessibilityLabel="View your submission"
                    >
                      <PostMediaTile
                        post={myPost}
                        style={styles.pastThumbFill}
                        borderRadius={14}
                        compact
                      />
                    </Pressable>
                  ) : (
                    <View
                      style={[
                        styles.pastThumbPlaceholder,
                        { borderColor: colors.border2, backgroundColor: colors.bg3 },
                      ]}
                    >
                      <Text style={{ color: colors.text3, fontFamily: font.syne, fontSize: 14 }}>—</Text>
                    </View>
                  )}
                  <View style={styles.pastTextCol}>
                    <Text style={[styles.pastCardTitle, { color: colors.text1 }]}>{c.title.toLowerCase()}</Text>
                    <Text
                      style={[
                        styles.pastCardMeta,
                        { color: scheme === 'light' ? '#A0A0A0' : colors.text3, fontFamily: font.dm },
                      ]}
                    >
                      {formatRelativePastDay(c.day)} · {n.toLocaleString('en-US')}{' '}
                      {n === 1 ? 'post' : 'posts'}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.pastStatus,
                      { color: done ? colors.accent : scheme === 'light' ? '#A0A0A0' : colors.text3, fontFamily: font.syne },
                    ]}
                    accessibilityLabel={done ? 'Completed' : 'Not completed'}
                  >
                    {done ? '✓' : '✕'}
                  </Text>
                </View>
              );
            })}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  todayMainCenter: { justifyContent: 'center', width: '100%' },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  pillDot: { width: 5, height: 5, borderRadius: 2.5 },
  timerText: { fontSize: 11, fontWeight: '700' },
  hero: { paddingHorizontal: 18, paddingTop: 18 },
  challengeTag: { fontSize: 10, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 7 },
  challengeTitle: { fontSize: 28, lineHeight: 32, letterSpacing: -0.35, marginBottom: 6 },
  challengeHeadingCenter: { textAlign: 'center', alignSelf: 'stretch' },
  challengeSub: { fontSize: 12, lineHeight: 17 },
  heroPostCard: { marginTop: 16, borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  heroPostMedia: { width: '100%', aspectRatio: 3 / 4, borderRadius: 16, overflow: 'hidden' },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '45%' },
  postedPill: { position: 'absolute', top: 12, left: 12, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  postedPillText: { fontSize: 11, fontWeight: '800' },
  heroCaptionBlock: { position: 'absolute', left: 12, right: 12, bottom: 12 },
  heroCaption: { fontSize: 14, lineHeight: 19 },
  heroVotes: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  heroSharePill: {
    position: 'absolute',
    top: 12,
    right: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  heroSharePillText: { fontSize: 11, color: '#fff', fontWeight: '800' },
  emptyTodayWrap: {
    marginTop: 4,
    paddingHorizontal: 22,
    paddingBottom: 12,
    position: 'relative',
    justifyContent: 'center',
    width: '100%',
  },
  emptyTodayGlow: {
    position: 'absolute',
    top: '18%',
    left: '8%',
    right: '8%',
    height: 240,
    borderRadius: 140,
  },
  emptyTodayCenter: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    alignItems: 'center',
    alignSelf: 'stretch',
    width: '100%',
    zIndex: 1,
  },
  emptyTodayDeadline: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  emptyTodayCta: {
    marginTop: 28,
    alignSelf: 'stretch',
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  emptyTodayCtaText: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  submitZone: {
    marginHorizontal: 18,
    marginTop: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 16,
    height: 155,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  szTitle: { fontSize: 13, fontWeight: '700' },
  szSub: { fontSize: 11 },
  sectionRow: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  strip: { paddingHorizontal: 18, gap: 7, flexDirection: 'row' },
  stripExpanded: { gap: 10, paddingBottom: 6 },
  stripTall: { paddingHorizontal: 18, gap: 10, flexDirection: 'row', paddingBottom: 4 },
  pc: { width: 72, height: 72, position: 'relative' },
  pcExpanded: { width: 104, height: 104 },
  pcTall: { width: 120 },
  stripHandle: { fontSize: 11, marginTop: 6, textAlign: 'center' },
  pvWrap: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  pv: { fontSize: 9, fontWeight: '700' },
  pastCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 18,
    marginBottom: 10,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  pastThumbWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
  },
  pastThumbFill: { width: 52, height: 52 },
  pastThumbPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Full wrap, no line clamp — matches PAST SIDEQUESTS mock (Syne bold, not Extra). */
  pastTextCol: { flex: 1, minWidth: 0, justifyContent: 'center', flexShrink: 1 },
  pastCardTitle: {
    fontSize: 15,
    lineHeight: 21,
    letterSpacing: -0.2,
    fontFamily: font.syne,
    fontWeight: '700',
  },
  pastCardMeta: { fontSize: 12, lineHeight: 17, marginTop: 5, textTransform: 'lowercase' },
  pastStatus: { fontSize: 15, width: 24, textAlign: 'center', fontWeight: '700' },
});
