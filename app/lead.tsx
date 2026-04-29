import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LeaderboardAvatar } from '../src/components/LeaderboardAvatar';
import { SundayLeadTeaserModal } from '../src/components/SundayLeadTeaserModal';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/AppThemeContext';
import {
  MIN_DISTINCT_REACTIONS_FOR_PRIZE,
  MIN_LEADERBOARD_USERS_FOR_PRIZE_POOL,
} from '../src/constants/weeklyPrize';
import { useLeaderboard } from '../src/hooks/useLeaderboard';
import { useWeeklyReactionsGiven } from '../src/hooks/useWeeklyReactionsGiven';
import { openSidekixInstagramDm } from '../src/lib/openSidekixInstagramDm';
import { ordinalPlace } from '../src/lib/ordinalRank';
import { hasShownSundayLeadTeaser, markSundayLeadTeaserShown } from '../src/lib/sundayLeadTeaser';
import { mondayYmdOfWeekContaining } from '../src/lib/week';
import { mondayToSundayWeekProgress } from '../src/lib/weekTimeline';
import { reactionsLabel } from '../src/lib/formatCount';
import { font, getColors } from '../src/theme';

/** Weekly board: always show at least ranks 1–5 (filled + open); expand toward 10 as people join. */
const WEEK_LEADERBOARD_MIN_SLOTS = 5;
const WEEK_LEADERBOARD_MAX_SLOTS = 10;

export default function LeadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const scheme = resolvedScheme;
  const { user, profile } = useAuth();
  const [scope, setScope] = useState<'week' | 'all'>('week');
  const { rows, loading, refresh, myRank, weekCompetitorCount, weekPostCount, selfLeaderRow } = useLeaderboard(
    scope,
    user?.id,
  );
  const { distinctPostsReacted, loading: reactionsWeekLoad, refresh: refreshWeeklyReactions } =
    useWeeklyReactionsGiven(user?.id);
  const [refreshing, setRefreshing] = useState(false);
  const [prizeInfoOpen, setPrizeInfoOpen] = useState(false);
  const [sundayTeaserOpen, setSundayTeaserOpen] = useState(false);
  const weekFillPct = Math.round(mondayToSundayWeekProgress() * 1000) / 10;
  const dayOfWeek = useMemo(() => new Date().getDay(), []);
  /** Mon–Sat (1–6); Sunday is 0. */
  const isMondayThroughSaturday = dayOfWeek >= 1 && dayOfWeek <= 6;

  const onPull = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshWeeklyReactions()]);
    setRefreshing(false);
  };

  const prizePoolOpen = scope !== 'week' || weekCompetitorCount >= MIN_LEADERBOARD_USERS_FOR_PRIZE_POOL;
  const reactionsRuleApplies = scope === 'week' && weekPostCount > 3;
  const minRequiredReactions = reactionsRuleApplies ? MIN_DISTINCT_REACTIONS_FOR_PRIZE : 0;
  const prizeEligible =
    !user?.id || scope !== 'week' ? true : prizePoolOpen && distinctPostsReacted >= minRequiredReactions;
  const reactionsRemaining = Math.max(0, minRequiredReactions - distinctPostsReacted);
  const firstButNotEligible =
    scope === 'week' &&
    Boolean(user?.id) &&
    myRank === 1 &&
    !reactionsWeekLoad &&
    !prizeEligible &&
    prizePoolOpen;

  const totalSlots =
    scope === 'week'
      ? Math.min(WEEK_LEADERBOARD_MAX_SLOTS, Math.max(WEEK_LEADERBOARD_MIN_SLOTS, rows.length))
      : WEEK_LEADERBOARD_MAX_SLOTS;
  const openSlots = Math.max(0, totalSlots - rows.length);
  const openSlotOpacity = (openIndex: number) => Math.max(0.07, 0.44 - openIndex * 0.038);

  /** Rank motivation: only for top 10; none if rank > 10 or no placement. */
  const showRankMotivation =
    scope === 'week' && Boolean(user?.id) && myRank != null && myRank <= 10 && prizePoolOpen;

  const rankMotivationText =
    myRank === 1
      ? isMondayThroughSaturday
        ? "You're 1st! Great work. Hold your spot through Sunday night to lock in the $20."
        : "You're 1st! Last day. Keep the lead until midnight to win the $20."
      : myRank != null && myRank >= 2 && myRank <= 10
        ? `You're ${ordinalPlace(myRank)}! Earn reactions on the feed to chase first place and the $20.`
        : '';

  const hasPrizeBannerContent =
    scope === 'week' &&
    Boolean(user?.id) &&
    (!prizePoolOpen ||
      (prizePoolOpen && reactionsRuleApplies && !prizeEligible) ||
      (prizePoolOpen && reactionsRuleApplies && prizeEligible && myRank != null && myRank > 10) ||
      (showRankMotivation && rankMotivationText.length > 0));

  /** Logged-in user is not in the visible top 10 (or has no weekly post yet). */
  const showOffLeaderboardSlot = Boolean(user?.id) && (myRank == null || myRank > WEEK_LEADERBOARD_MAX_SLOTS);

  useEffect(() => {
    if (scope !== 'week' || loading || reactionsWeekLoad || !user?.id) return;
    if (myRank !== 1) return;
    const d = new Date();
    if (d.getDay() !== 0 || d.getHours() < 18) return;
    const weekKey = mondayYmdOfWeekContaining(d);
    let cancelled = false;
    void (async () => {
      const shown = await hasShownSundayLeadTeaser(weekKey);
      if (cancelled || shown) return;
      setSundayTeaserOpen(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [scope, loading, reactionsWeekLoad, user?.id, myRank]);

  const closeSundayTeaser = useCallback(async () => {
    setSundayTeaserOpen(false);
    await markSundayLeadTeaserShown(mondayYmdOfWeekContaining());
  }, []);

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPull} tintColor={colors.accent} />}
      >
        <View style={styles.header}>
          <Text style={[styles.leadTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>
            {scope === 'week' ? 'This Week' : 'All time'}
          </Text>
          <Text style={[styles.leadSub, { color: colors.text3, fontFamily: font.dm }]}>
            {scope === 'week' ? 'This week · tap a row to see their week' : 'All-time reaction totals'}
          </Text>
        </View>
        <Pressable
          onPress={() => setPrizeInfoOpen(true)}
          style={({ pressed }) => [
            styles.prize,
            {
              borderColor: colors.lightAccentBorder,
              backgroundColor: scheme === 'dark' ? '#1a1a1a' : '#f6f6f2',
              opacity: pressed ? 0.94 : 1,
            },
          ]}
        >
          <Text style={{ fontSize: 26 }}>🎁</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fpLabel, { color: colors.accent, fontFamily: font.syne }]}>1st place prize</Text>
            <Text style={[styles.fpValue, { color: colors.text1, fontFamily: font.syneExtra }]}>$20 gift card</Text>
            <Text style={[styles.fpSponsor, { color: colors.text3, fontFamily: font.dm }]}>
              {!prizePoolOpen
                ? `Prize unlocks once ${MIN_LEADERBOARD_USERS_FOR_PRIZE_POOL} people are on this week's leaderboard (${weekCompetitorCount}/${MIN_LEADERBOARD_USERS_FOR_PRIZE_POOL})`
                : reactionsRuleApplies
                  ? `Most reactions by Sunday night wins — stay prize-eligible by reacting to ${MIN_DISTINCT_REACTIONS_FOR_PRIZE} different posts this week (not your own).`
                  : 'Most reactions by Sunday night wins. The qualify rule turns on once this week has more than 3 posts on the board.'}
            </Text>
            {scope === 'week' && prizePoolOpen ? (
              <Text style={[styles.fpReactWhy, { color: colors.text3, fontFamily: font.dm }]}>
                Reactions move the weekly board. Cheering on others keeps the feed alive — which helps your take get seen too.
              </Text>
            ) : null}
            <View style={styles.prizeTrack}>
              <View
                style={[styles.prizeTrackFill, { backgroundColor: colors.accent, width: `${weekFillPct}%` as `${number}%` }]}
              />
            </View>
            <View style={styles.prizeTrackLabels}>
              <Text style={[styles.prizeTrackToday, { color: colors.accent, fontFamily: font.syne }]}>mon</Text>
              <Text style={[styles.prizeTrackSun, { color: colors.text3, fontFamily: font.dm }]}>sun</Text>
            </View>
          </View>
        </Pressable>
        {scope === 'week' && user?.id && !reactionsWeekLoad && hasPrizeBannerContent ? (
          <View
            style={[
              styles.prizeRuleBanner,
              {
                borderColor: colors.border2,
                backgroundColor: scheme === 'dark' ? '#141414' : colors.card,
              },
            ]}
          >
            {!prizePoolOpen ? (
              <Text style={[styles.prizeRuleLine, { color: colors.text2, fontFamily: font.dm }]}>
                Prize pool unlocks after {MIN_LEADERBOARD_USERS_FOR_PRIZE_POOL} people are on this week&apos;s board (
                {weekCompetitorCount}/{MIN_LEADERBOARD_USERS_FOR_PRIZE_POOL}).
              </Text>
            ) : null}
            {prizePoolOpen && reactionsRuleApplies && !prizeEligible ? (
              <Text style={[styles.prizeRuleLine, { color: colors.text2, fontFamily: font.dm }]}>
                {firstButNotEligible
                  ? `You’re #1 but need ${reactionsRemaining} more reaction${reactionsRemaining === 1 ? '' : 's'} on posts that aren’t yours to qualify.`
                  : `Qualify: react to ${MIN_DISTINCT_REACTIONS_FOR_PRIZE} different posts (not your own) this week (${distinctPostsReacted}/${MIN_DISTINCT_REACTIONS_FOR_PRIZE}).`}
              </Text>
            ) : null}
            {prizePoolOpen && reactionsRuleApplies && prizeEligible && myRank != null && myRank > 10 ? (
              <Text style={[styles.prizeRuleLine, { color: colors.text2, fontFamily: font.dm }]}>
                You’re eligible for the prize based on reactions given.
              </Text>
            ) : null}
            {showRankMotivation && rankMotivationText ? (
              <Text style={[styles.prizeRuleEmphasis, { color: colors.text1, fontFamily: font.dm }]}>
                {rankMotivationText}
              </Text>
            ) : null}
          </View>
        ) : null}
        <View style={[styles.scopeToggle, { backgroundColor: colors.pillBg }]}>
          <Pressable
            onPress={() => setScope('week')}
            style={[styles.scopeBtn, scope === 'week' && { backgroundColor: colors.card }]}
          >
            <Text
              style={[
                styles.scopeBtnText,
                { fontFamily: font.syne },
                { color: scope === 'week' ? colors.text1 : colors.text3 },
              ]}
            >
              THIS WEEK
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setScope('all')}
            style={[styles.scopeBtn, scope === 'all' && { backgroundColor: colors.card }]}
          >
            <Text
              style={[
                styles.scopeBtnText,
                { fontFamily: font.syne },
                { color: scope === 'all' ? colors.text1 : colors.text3 },
              ]}
            >
              ALL TIME
            </Text>
          </Pressable>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
        ) : (
          <View style={{ paddingHorizontal: 18, gap: 7, paddingTop: 8 }}>
            {rows.map((row, idx) => {
              const rank = idx + 1;
              const isSelf = row.user_id === user?.id;
              return (
                <Pressable
                  key={row.user_id}
                  disabled={scope !== 'week'}
                  onPress={() => router.push(`/leader-week/${row.user_id}`)}
                  style={({ pressed }) => [
                    styles.item,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    isSelf && { borderColor: colors.accent, borderWidth: 1.5 },
                    scope === 'week' && pressed && { opacity: 0.92 },
                  ]}
                >
                  <Text
                    style={[
                      styles.rn,
                      {
                        fontFamily: font.syneExtra,
                        color: rank <= 3 ? colors.text1 : colors.text3,
                      },
                    ]}
                  >
                    {rank}
                  </Text>
                  <LeaderboardAvatar username={row.username} avatarPath={row.avatar_path} size={52} radius={12} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text numberOfLines={1} style={{ color: colors.text1, fontFamily: font.syne, fontSize: 14, fontWeight: '700' }}>
                      @{row.username}
                    </Text>
                    <Text numberOfLines={1} style={{ color: colors.text3, fontFamily: font.dm, fontSize: 12, marginTop: 2 }}>
                      {scope === 'week' ? `${reactionsLabel(row.vote_total)} this week` : reactionsLabel(row.vote_total)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.voteStat,
                      {
                        borderColor: colors.border2,
                        backgroundColor: scheme === 'dark' ? 'rgba(0,0,0,0.2)' : colors.bg3,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 10, color: colors.text3 }}>▲</Text>
                    <Text
                      style={{
                        fontFamily: font.syne,
                        fontSize: 11,
                        fontWeight: '700',
                        color: colors.text2,
                      }}
                    >
                      {row.vote_total}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            {Array.from({ length: openSlots }).map((_, i) => {
              const rank = rows.length + i + 1;
              return (
                <View
                  key={`open-${rank}`}
                  style={[
                    styles.openSlot,
                    {
                      borderColor: scheme === 'dark' ? '#2c2c2c' : colors.border2,
                      backgroundColor: scheme === 'dark' ? '#121212' : colors.card,
                      opacity: openSlotOpacity(i),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.openRank,
                      {
                        fontFamily: font.syneExtra,
                        color: rank <= 3 ? colors.text1 : colors.text3,
                      },
                    ]}
                  >
                    {rank}
                  </Text>
                  <View style={[styles.openThumb, { backgroundColor: colors.bg3 }]} />
                  <Text style={[styles.openLabelText, { color: colors.text3, fontFamily: font.syne }]}>open</Text>
                </View>
              );
            })}
            {openSlots > 0 ? (
              <Text style={[styles.openLabel, { color: colors.text2, fontFamily: font.dm }]}>
                {openSlots} {openSlots === 1 ? 'spot is' : 'spots are'} still open.
              </Text>
            ) : null}
            {showOffLeaderboardSlot ? (
              <View style={styles.offLeaderWrap}>
                <View style={styles.offLeaderDots}>
                  {[0, 1, 2].map((i) => (
                    <View key={i} style={[styles.offLeaderDot, { backgroundColor: colors.accent }]} />
                  ))}
                </View>
                {myRank != null && myRank > WEEK_LEADERBOARD_MAX_SLOTS && selfLeaderRow && user?.id ? (
                  <Pressable
                    onPress={() => router.push(`/leader-week/${user.id}`)}
                    style={({ pressed }) => [
                      styles.item,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.accent,
                        borderWidth: 1.5,
                        opacity: pressed ? 0.92 : 1,
                      },
                    ]}
                  >
                    <Text style={[styles.rn, { fontFamily: font.syneExtra, color: colors.text3 }]}>{myRank}</Text>
                    <LeaderboardAvatar
                      username={selfLeaderRow.username}
                      avatarPath={selfLeaderRow.avatar_path}
                      size={52}
                      radius={12}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={{ color: colors.text1, fontFamily: font.syne, fontSize: 14, fontWeight: '700' }}
                      >
                        You&apos;re {ordinalPlace(myRank)}!
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{ color: colors.text3, fontFamily: font.dm, fontSize: 12, marginTop: 2 }}
                      >
                        @{selfLeaderRow.username} · {reactionsLabel(selfLeaderRow.vote_total)} this week
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.voteStat,
                        {
                          borderColor: colors.border2,
                          backgroundColor: scheme === 'dark' ? 'rgba(0,0,0,0.2)' : colors.bg3,
                        },
                      ]}
                    >
                      <Text style={{ fontSize: 10, color: colors.text3 }}>▲</Text>
                      <Text
                        style={{
                          fontFamily: font.syne,
                          fontSize: 11,
                          fontWeight: '700',
                          color: colors.text2,
                        }}
                      >
                        {selfLeaderRow.vote_total}
                      </Text>
                    </View>
                  </Pressable>
                ) : (
                  <View style={[styles.item, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Text style={[styles.rn, { fontFamily: font.syneExtra, color: colors.text3 }]}>—</Text>
                    <LeaderboardAvatar
                      username={profile?.username ?? 'you'}
                      avatarPath={profile?.avatar_path ?? null}
                      size={52}
                      radius={12}
                    />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={{ color: colors.text1, fontFamily: font.syne, fontSize: 14, fontWeight: '700' }}
                      >
                        Not ranked yet
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={{ color: colors.text3, fontFamily: font.dm, fontSize: 12, marginTop: 2 }}
                      >
                        Post this week to show up on the board.
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => router.push('/upload')}
                      style={({ pressed }) => [
                        styles.offLeaderMiniCta,
                        { borderColor: colors.accent, opacity: pressed ? 0.88 : 1 },
                      ]}
                    >
                      <Text style={[styles.offLeaderMiniCtaText, { color: colors.accent, fontFamily: font.syne }]}>
                        post →
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>

      <Modal visible={prizeInfoOpen} transparent animationType="fade" onRequestClose={() => setPrizeInfoOpen(false)}>
        <View style={styles.prizeModalRoot}>
          <Pressable style={styles.prizeModalBackdrop} onPress={() => setPrizeInfoOpen(false)} />
          <ScrollView
            style={[styles.prizeModalScroll, { zIndex: 1 }]}
            contentContainerStyle={styles.prizeModalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={[styles.prizeModalCard, { backgroundColor: colors.bg2, borderColor: colors.border2 }]}>
              <Text style={[styles.prizeModalTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>Prize payout</Text>
              <Text style={[styles.prizeModalIntro, { color: colors.text3, fontFamily: font.dm }]}>
                $20 gift card for most reactions this week. Reactions are how you climb — and a busier feed
                means more people scroll to your post as well.
              </Text>

              <View style={[styles.prizeModalSection, { borderTopColor: colors.border2 }]}>
                <Text style={[styles.prizeModalSectionTitle, { color: colors.accent, fontFamily: font.syne }]}>Pool</Text>
                <Text style={[styles.prizeModalBullet, { color: colors.text2, fontFamily: font.dm }]}>
                  • Unlocks when {MIN_LEADERBOARD_USERS_FOR_PRIZE_POOL} people are on the weekly board.
                </Text>
              </View>

              <View style={[styles.prizeModalSection, { borderTopColor: colors.border2 }]}>
                <Text style={[styles.prizeModalSectionTitle, { color: colors.accent, fontFamily: font.syne }]}>Qualify</Text>
                <Text style={[styles.prizeModalBullet, { color: colors.text2, fontFamily: font.dm }]}>
                  {`• If this week has more than 3 posts on the weekly board: react to at least ${MIN_DISTINCT_REACTIONS_FOR_PRIZE} different posts (not your own) this week to stay prize-eligible.`}
                </Text>
                <Text style={[styles.prizeModalBullet, { color: colors.text2, fontFamily: font.dm }]}>
                  • If the week has 3 or fewer board posts, that reaction rule doesn&apos;t apply yet — still react to
                  help campus and your own visibility.
                </Text>
              </View>

              <View style={[styles.prizeModalSection, { borderTopColor: colors.border2 }]}>
                <Text style={[styles.prizeModalSectionTitle, { color: colors.accent, fontFamily: font.syne }]}>Win &amp; get paid</Text>
                <Text style={[styles.prizeModalBullet, { color: colors.text2, fontFamily: font.dm }]}>
                  • Finish first in reactions by Sunday night.
                </Text>
                <Text style={[styles.prizeModalBullet, { color: colors.text2, fontFamily: font.dm }]}>
                  • DM @sidekix.app on Instagram with proof; we Venmo after we verify.
                </Text>
              </View>

              <Pressable
                onPress={() => void openSidekixInstagramDm()}
                style={({ pressed }) => [
                  styles.prizeModalPrimaryBtn,
                  { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Text style={[styles.prizeModalPrimaryText, { color: scheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.syne }]}>
                  Open Instagram DM
                </Text>
              </Pressable>
              <Pressable onPress={() => setPrizeInfoOpen(false)} style={styles.prizeModalCloseBtn}>
                <Text style={[styles.prizeModalCloseText, { color: colors.text3, fontFamily: font.syne }]}>close</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <SundayLeadTeaserModal
        visible={sundayTeaserOpen}
        prizeEligible={prizeEligible}
        onClose={() => void closeSundayTeaser()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10 },
  leadTitle: { fontSize: 22, letterSpacing: -0.35, marginBottom: 3 },
  leadSub: { fontSize: 12 },
  prize: { marginHorizontal: 18, marginBottom: 10, borderRadius: 16, borderWidth: 1, padding: 14, flexDirection: 'row', gap: 12 },
  prizeRuleBanner: {
    marginHorizontal: 18,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  prizeRuleLine: { fontSize: 12, lineHeight: 18 },
  prizeRuleEmphasis: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  fpLabel: { fontSize: 9, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 4 },
  fpValue: { fontSize: 17, fontWeight: '800' },
  fpSponsor: { fontSize: 11, marginTop: 4 },
  fpReactWhy: { fontSize: 11, lineHeight: 16, marginTop: 8 },
  prizeTrack: {
    marginTop: 10,
    height: 3,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.25)',
    overflow: 'hidden',
  },
  prizeTrackFill: { height: '100%', borderRadius: 2, minWidth: 2 },
  prizeTrackLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  prizeTrackToday: { fontSize: 10, letterSpacing: 0.8 },
  prizeTrackSun: { fontSize: 10 },
  scopeToggle: {
    marginHorizontal: 18,
    flexDirection: 'row',
    borderRadius: 20,
    padding: 3,
    marginBottom: 8,
  },
  scopeBtn: { flex: 1, paddingVertical: 7, borderRadius: 17, alignItems: 'center' },
  scopeBtnText: { fontSize: 10, letterSpacing: 0.8, fontWeight: '700' },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, paddingVertical: 11, paddingHorizontal: 12 },
  openSlot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  openThumb: { width: 52, height: 52, borderRadius: 12 },
  openRank: { width: 24, textAlign: 'center', fontSize: 14, fontWeight: '800' },
  openLabelText: { flex: 1, fontSize: 13, fontWeight: '700', textAlign: 'center', letterSpacing: 0.6 },
  openLabel: { fontSize: 12, marginTop: 4, paddingHorizontal: 2 },
  rn: { width: 24, textAlign: 'center', fontSize: 14, fontWeight: '800' },
  voteStat: {
    flexDirection: 'column',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 2,
    minWidth: 36,
  },
  offLeaderWrap: { marginTop: 16, gap: 10 },
  offLeaderDots: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 2 },
  offLeaderDot: { width: 6, height: 6, borderRadius: 3, opacity: 0.85 },
  offLeaderMiniCta: {
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  offLeaderMiniCtaText: { fontSize: 12, fontWeight: '700' },
  prizeModalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  prizeModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  prizeModalScroll: { maxHeight: '88%' },
  prizeModalScrollContent: { paddingVertical: 24, flexGrow: 1, justifyContent: 'center' },
  prizeModalCard: {
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  prizeModalTitle: { fontSize: 18, marginBottom: 6 },
  prizeModalIntro: { fontSize: 13, lineHeight: 19, marginBottom: 14 },
  prizeModalSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginBottom: 12,
    gap: 8,
  },
  prizeModalSectionTitle: { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 2 },
  prizeModalBullet: { fontSize: 13, lineHeight: 19 },
  prizeModalPrimaryBtn: {
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  prizeModalPrimaryText: { fontSize: 13, fontWeight: '800', textAlign: 'center' },
  prizeModalCloseBtn: { alignSelf: 'center', marginTop: 12, paddingHorizontal: 10, paddingVertical: 4 },
  prizeModalCloseText: { fontSize: 12, letterSpacing: 0.5 },
});
