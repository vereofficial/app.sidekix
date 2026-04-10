import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LeaderboardAvatar } from '../../src/components/LeaderboardAvatar';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/AppThemeContext';
import { useLeaderboard } from '../../src/hooks/useLeaderboard';
import { usePostedToday } from '../../src/hooks/usePostedToday';
import { mondayToSundayWeekProgress } from '../../src/lib/weekTimeline';
import { reactionsLabel } from '../../src/lib/formatCount';
import { font, getColors } from '../../src/theme';

const WEEKDAY_PAREN = ['sun', 'mon', 'tues', 'wed', 'thurs', 'fri', 'sat'] as const;

function weekdayParen(d: Date): string {
  return WEEKDAY_PAREN[d.getDay()];
}

export default function LeadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const scheme = resolvedScheme;
  const { user } = useAuth();
  const [scope, setScope] = useState<'week' | 'all'>('week');
  const { rows, loading, refresh } = useLeaderboard(scope);
  const [refreshing, setRefreshing] = useState(false);
  const todayParen = weekdayParen(new Date());
  const weekFillPct = Math.round(mondayToSundayWeekProgress() * 1000) / 10;
  const postedToday = usePostedToday(user?.id);

  const onPull = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const userOnBoard = Boolean(user?.id && rows.some((r) => r.user_id === user.id));
  /** Week view: at least 5 slots; once there are 5+ competitors, show 10 slots total. All-time: real rows only. */
  const totalSlots =
    scope === 'week' ? (rows.length >= 5 ? 10 : Math.max(5, rows.length)) : rows.length;
  const openSlots = Math.max(0, totalSlots - rows.length);
  const openSlotOpacity = (openIndex: number) => Math.max(0.07, 0.44 - openIndex * 0.038);

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
            {scope === 'week' ? 'Mon — Sun · tap a row to see their week' : 'All-time reaction totals'}
          </Text>
        </View>
        <View
          style={[
            styles.prize,
            {
              borderColor: colors.lightAccentBorder,
              backgroundColor: scheme === 'dark' ? '#1a1a1a' : '#f6f6f2',
            },
          ]}
        >
          <Text style={{ fontSize: 26 }}>🎁</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fpLabel, { color: colors.accent, fontFamily: font.syne }]}>1st place prize</Text>
            <Text style={[styles.fpValue, { color: colors.text1, fontFamily: font.syneExtra }]}>$20 gift card</Text>
            <Text style={[styles.fpSponsor, { color: colors.text3, fontFamily: font.dm }]}>
              most reactions by sunday midnight wins
            </Text>
            <View style={styles.prizeTrack}>
              <View
                style={[styles.prizeTrackFill, { backgroundColor: colors.accent, width: `${weekFillPct}%` as `${number}%` }]}
              />
            </View>
            <View style={styles.prizeTrackLabels}>
              <Text style={[styles.prizeTrackToday, { color: colors.accent, fontFamily: font.syne }]}>
                today ({todayParen})
              </Text>
              <Text style={[styles.prizeTrackSun, { color: colors.text3, fontFamily: font.dm }]}>sun</Text>
            </View>
          </View>
        </View>
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
                    rank === 1 && {
                      borderColor: scheme === 'dark' ? '#D4FF3F88' : '#5a7a0088',
                    },
                    isSelf && { borderColor: colors.accent },
                    scope === 'week' && pressed && { opacity: 0.92 },
                  ]}
                >
                  <Text
                    style={[
                      styles.rn,
                      { fontFamily: font.syneExtra, color: rank === 1 ? colors.accent : colors.text3 },
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
                        backgroundColor: colors.bg3,
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
                  <Text style={[styles.openRank, { color: colors.text3, fontFamily: font.syneExtra }]}>{rank}</Text>
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
            {scope === 'week' && user?.id && !userOnBoard && !postedToday ? (
              <Pressable
                onPress={() => router.push('/upload')}
                style={[styles.yourSlot, { borderColor: colors.border2, backgroundColor: colors.card }]}
              >
                <Text style={[styles.yourSlotTitle, { color: colors.text1, fontFamily: font.syne }]}>you · not posted yet</Text>
                <Text style={[styles.yourSlotSub, { color: colors.text3, fontFamily: font.dm }]}>
                  add today&apos;s post to show up here
                </Text>
              </Pressable>
            ) : null}
            {scope === 'week' && user?.id && postedToday && !userOnBoard ? (
              <View style={[styles.yourSlot, { borderColor: colors.border2, backgroundColor: colors.card }]}>
                <Text style={[styles.yourSlotTitle, { color: colors.text1, fontFamily: font.syne }]}>you · posted today</Text>
                <Text style={[styles.yourSlotSub, { color: colors.text3, fontFamily: font.dm }]}>
                  earn reactions on the feed to climb the board
                </Text>
              </View>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 10 },
  leadTitle: { fontSize: 22, letterSpacing: -0.35, marginBottom: 3 },
  leadSub: { fontSize: 12 },
  prize: { marginHorizontal: 18, marginBottom: 12, borderRadius: 16, borderWidth: 1, padding: 14, flexDirection: 'row', gap: 12 },
  fpLabel: { fontSize: 9, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 4 },
  fpValue: { fontSize: 17, fontWeight: '800' },
  fpSponsor: { fontSize: 11, marginTop: 4 },
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
  yourSlot: {
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  yourSlotTitle: { fontSize: 13, fontWeight: '700' },
  yourSlotSub: { fontSize: 11, marginTop: 3 },
});
