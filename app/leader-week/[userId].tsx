import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
import { PostMediaTile } from '../../src/components/PostMediaTile';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/AppThemeContext';
import { useTodayChallenge } from '../../src/hooks/useTodayChallenge';
import { useUserWeekPosts } from '../../src/hooks/useUserWeekPosts';
import { hapticLight } from '../../src/lib/haptics';
import { tryGetSupabase } from '../../src/lib/supabase';
import { font, getColors } from '../../src/theme';

function dayLabel(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso.includes('T') ? iso : `${iso}T12:00:00`);
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

export default function LeaderWeekUserScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const scheme = resolvedScheme;
  const { user } = useAuth();
  const { challenge } = useTodayChallenge();
  const { posts, myVoteIds, loading, refresh } = useUserWeekPosts(
    userId ?? null,
    challenge?.id ?? null,
    user?.id ?? null,
  );
  const [refreshing, setRefreshing] = useState(false);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!userId) return;
      const sb = tryGetSupabase();
      if (!sb) return;
      const { data } = await sb.from('profiles').select('username').eq('id', userId).maybeSingle();
      setUsername((data as { username?: string } | null)?.username ?? null);
    };
    void load();
  }, [userId]);

  const isSelf = Boolean(user?.id && userId && user.id === userId);
  const visible = posts.filter((p) => isSelf || !p.is_anonymous || p.is_today_challenge);

  const onVote = useCallback(
    async (postId: string, currently: boolean) => {
      const sb = tryGetSupabase();
      if (!sb || !user?.id) return;
      hapticLight();
      if (currently) {
        await sb.from('votes').delete().eq('post_id', postId).eq('voter_id', user.id);
      } else {
        await sb.from('votes').insert({ post_id: postId, voter_id: user.id });
      }
      await refresh();
    },
    [user?.id, refresh],
  );

  const onPull = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontSize: 18, color: colors.text1 }}>←</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text1, fontFamily: font.syneExtra }]} numberOfLines={1}>
          @{username ?? '…'}
        </Text>
        <View style={{ width: 24 }} />
      </View>
      <Text style={[styles.sub, { color: colors.text3, fontFamily: font.dm }]}>
        this week · you can only upvote today&apos;s post{!isSelf ? '' : ' (others can on yours)'}
      </Text>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 28 }} />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: 32, paddingHorizontal: 18, gap: 18, paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPull} tintColor={colors.accent} />}
        >
          {visible.length === 0 ? (
            <Text style={{ color: colors.text3, fontFamily: font.dm, marginTop: 12 }}>
              Nothing to show yet — older anonymous posts aren&apos;t listed for others.
            </Text>
          ) : (
            visible.map((p) => {
              const canVote = Boolean(
                p.is_today_challenge && user?.id && user.id !== p.user_id,
              );
              const voted = myVoteIds.has(p.id);
              return (
                <View
                  key={p.id}
                  style={[styles.card, { borderColor: colors.border2, backgroundColor: colors.card }]}
                >
                  <View style={styles.cardHead}>
                    <Text style={[styles.dayLine, { color: colors.text3, fontFamily: font.syne }]}>
                      {p.is_today_challenge ? 'today' : dayLabel(p.challenge_day)}
                    </Text>
                    {p.is_anonymous ? (
                      <Text style={[styles.anon, { color: colors.text3, fontFamily: font.dm }]}>anon</Text>
                    ) : null}
                  </View>
                  <Text
                    style={[styles.challengeLine, { color: colors.text2, fontFamily: font.dm }]}
                    numberOfLines={2}
                  >
                    {p.challenge_title}
                  </Text>
                  <View style={styles.mediaBox}>
                    <PostMediaTile post={p} style={styles.mediaFill} borderRadius={14} />
                  </View>
                  <View style={styles.row}>
                    <Text style={[styles.vc, { color: colors.text2, fontFamily: font.dm }]}>
                      ▲ {p.vote_count} {p.is_today_challenge ? 'this sidequest' : 'that day'}
                    </Text>
                    {canVote ? (
                      <Pressable
                        onPress={() => void onVote(p.id, voted)}
                        style={[
                          styles.voteBtn,
                          {
                            borderColor: voted
                              ? scheme === 'dark'
                                ? 'rgba(212,255,63,0.45)'
                                : 'rgba(90,122,0,0.35)'
                              : colors.border2,
                            backgroundColor: voted
                              ? scheme === 'dark'
                                ? 'rgba(212,255,63,0.12)'
                                : 'rgba(90,122,0,0.1)'
                              : colors.bg3,
                          },
                        ]}
                      >
                        <Text style={{ fontSize: 12, color: voted ? colors.accent : colors.text2, fontFamily: font.syne }}>
                          {voted ? '▲ voted' : '▲ upvote'}
                        </Text>
                      </Pressable>
                    ) : p.is_today_challenge && user?.id === p.user_id ? (
                      <Text style={{ fontSize: 11, color: colors.text3, fontFamily: font.dm }}>your post today</Text>
                    ) : !p.is_today_challenge ? (
                      <Text style={{ fontSize: 11, color: colors.text3, fontFamily: font.dm }}>past day · view only</Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
  },
  title: { fontSize: 16, fontWeight: '800', flex: 1, textAlign: 'center' },
  sub: { paddingHorizontal: 18, marginTop: 6, fontSize: 12, lineHeight: 17 },
  scroll: { flex: 1 },
  card: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 8 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dayLine: { fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' },
  anon: { fontSize: 11 },
  challengeLine: { fontSize: 12, lineHeight: 16 },
  mediaBox: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 4,
  },
  mediaFill: { width: '100%', height: '100%' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    gap: 12,
  },
  vc: { fontSize: 12, flex: 1 },
  voteBtn: {
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
});
