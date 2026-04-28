import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { challengeTag, splitChallengeTitle } from '../../src/challenge';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/AppThemeContext';
import { PostMediaTile } from '../../src/components/PostMediaTile';
import { PostMediaViewerModal } from '../../src/components/PostMediaViewerModal';
import { SidekixTabState } from '../../src/components/SidekixTabState';
import { useFollows } from '../../src/hooks/useFollows';
import { useFriendRequests } from '../../src/hooks/useFriendRequests';
import { usePostsForChallenge } from '../../src/hooks/usePostsForChallenge';
import { useSidequestFeed } from '../../src/hooks/useSidequestFeed';
import { useTodayChallenge } from '../../src/hooks/useTodayChallenge';
import { usePostedToday } from '../../src/hooks/usePostedToday';
import { postsFeedCountLine } from '../../src/lib/formatCount';
import { getHomeFeedMode, setHomeFeedMode } from '../../src/lib/homeFeedPreference';
import { hapticLight } from '../../src/lib/haptics';
import { sharePostLink } from '../../src/lib/sharePost';
import { tryGetSupabase } from '../../src/lib/supabase';
import type { PostRow, ProfileRow } from '../../src/types/database';
import { font, getColors } from '../../src/theme';

const TABLET_CONTENT_MAX = 560;

const FRIEND_AVATAR_BG = ['#6B4E3D', '#2D7A7A', '#6B4FA3', '#B85C5C', '#4A6FA5'];
const SIDEQUEST_CATEGORIES = ['food/drink', 'outdoor', 'social', 'trend', 'creative', 'chaotic'] as const;

function friendDisplayFirst(u: string): string {
  const base = (u.split('_')[0] || u).toLowerCase();
  return base || u;
}

export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const scheme = resolvedScheme;
  const { user } = useAuth();
  const { challenge, loading: chLoad, refresh: refCh } = useTodayChallenge();
  const { posts, myVoteIds, loading, error: postsErr, refresh } = usePostsForChallenge(
    challenge?.id ?? null,
    undefined,
    user?.id,
    Boolean(challenge?.id),
  );
  const { followingIds, followerIds, refresh: refFollows } = useFollows();
  const { incoming, outgoingIds, refresh: refFriendReq } = useFriendRequests(user?.id);
  const [homeMode, setHomeMode] = useState<'feed' | 'recent'>('feed');
  const [activeCats, setActiveCats] = useState<string[]>([]);
  const { rows: sidequests, loading: sidequestsLoading, refresh: refreshSidequests } = useSidequestFeed(activeCats);
  const postedToday = usePostedToday(user?.id);
  const [mode, setMode] = useState<'campus' | 'friends'>('campus');
  const [sheet, setSheet] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<ProfileRow[]>([]);
  const [friendProfiles, setFriendProfiles] = useState<ProfileRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [usernames, setUsernames] = useState<Record<string, string>>({});
  const [viewerPost, setViewerPost] = useState<PostRow | null>(null);

  useEffect(() => {
    void refFollows(user?.id);
  }, [user?.id, refFollows]);

  useEffect(() => {
    if (sheet) void refFriendReq();
  }, [sheet, refFriendReq]);

  useEffect(() => {
    if (mode === 'friends') void refFriendReq();
  }, [mode, refFriendReq]);

  const mutualFriendIds = useMemo(
    () => followingIds.filter((id) => followerIds.includes(id)),
    [followingIds, followerIds],
  );

  useEffect(() => {
    const loadFriends = async () => {
      const sb = tryGetSupabase();
      if (!sb || mutualFriendIds.length === 0) {
        setFriendProfiles([]);
        return;
      }
      const { data } = await sb.from('profiles').select('*').in('id', mutualFriendIds).limit(30);
      setFriendProfiles((data ?? []) as ProfileRow[]);
    };
    void loadFriends();
  }, [mutualFriendIds]);

  useEffect(() => {
    const load = async () => {
      const ids = [...new Set(posts.map((p) => p.user_id))];
      if (ids.length === 0) return;
      const sb = tryGetSupabase();
      if (!sb) return;
      const { data } = await sb.from('profiles').select('id, username').in('id', ids);
      const m: Record<string, string> = {};
      (data ?? []).forEach((r: { id: string; username: string }) => {
        m[r.id] = r.username;
      });
      setUsernames(m);
    };
    void load();
  }, [posts]);

  const visible = useMemo(() => {
    if (mode === 'campus') return posts;
    return posts.filter((p) => mutualFriendIds.includes(p.user_id));
  }, [mode, posts, mutualFriendIds]);

  const sparseCampusFeed = mode === 'campus' && visible.length > 0 && visible.length <= 3;
  /** Few posts today — hide exact reaction totals on tiles (same rule as Today / past sidequests). */
  const hidePublicCounts = posts.length < 10;
  const campusFeedCountLine = postsFeedCountLine(posts.length);

  const friendsPendingLine = useMemo(() => {
    if (friendProfiles.length === 0) return '';
    const first = friendDisplayFirst(friendProfiles[0]?.username ?? 'your friends');
    if (friendProfiles.length === 1) return `${first} hasn't posted yet.`;
    return `${first} and ${friendProfiles.length - 1} others haven't posted yet.`;
  }, [friendProfiles]);

  const toggleCategory = (category: string) =>
    setActiveCats((prev) => (prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]));

  useEffect(() => {
    let cancelled = false;
    const loadMode = async () => {
      const m = await getHomeFeedMode(user?.id ?? null);
      if (!cancelled) setHomeMode(m);
    };
    void loadMode();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const chooseHomeMode = (next: 'feed' | 'recent') => {
    setHomeMode(next);
    void setHomeFeedMode(user?.id ?? null, next);
  };

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
      refresh();
    },
    [user?.id, refresh],
  );

  const onPull = async () => {
    setRefreshing(true);
    await Promise.all([refCh(), refresh(), refFollows(user?.id), refFriendReq(), refreshSidequests()]);
    setRefreshing(false);
  };

  const runSearch = async () => {
    const sb = tryGetSupabase();
    const q = search.trim().replace(/^@+/, '');
    if (!sb || !user?.id) return;
    if (!q) {
      Alert.alert('Search', 'Enter a username to search.');
      return;
    }
    Keyboard.dismiss();
    // Use RPC so friends-only profiles still appear for username search (RLS hides them when you don’t follow).
    const { data, error } = await sb.rpc('search_profiles_for_add_friends', {
      p_query: q,
      p_exclude: user.id,
    });
    if (error) {
      Alert.alert('Search', error.message);
      return;
    }
    setResults((data ?? []) as ProfileRow[]);
  };

  const requestFollow = async (targetId: string) => {
    const sb = tryGetSupabase();
    if (!sb || !user?.id) return;
    if (mutualFriendIds.includes(targetId)) return;
    if (outgoingIds.includes(targetId)) {
      Alert.alert('Follow request', 'You already have a pending request with this person.');
      return;
    }
    const { data: existing } = await sb
      .from('friend_requests')
      .select('id, status')
      .eq('requester_id', user.id)
      .eq('addressee_id', targetId)
      .maybeSingle();
    const row = existing as { id: string; status: string } | null;
    if (row?.status === 'pending') {
      Alert.alert('Follow request', 'You already have a pending request with this person.');
      return;
    }
    if (row?.status === 'accepted') {
      if (mutualFriendIds.includes(targetId)) {
        await refFollows(user.id);
        return;
      }
      // Row still "accepted" but follows were removed (e.g. unfriend) — delete so we can send a new request.
      const { error: delErr } = await sb.from('friend_requests').delete().eq('id', row.id);
      if (delErr) {
        Alert.alert('Follow request', delErr.message);
        return;
      }
    } else if (row?.status === 'declined') {
      const { error: delErr } = await sb.from('friend_requests').delete().eq('id', row.id);
      if (delErr) {
        Alert.alert('Follow request', delErr.message);
        return;
      }
    }

    const { error } = await sb.from('friend_requests').insert({
      requester_id: user.id,
      addressee_id: targetId,
      status: 'pending',
    });
    if (error) {
      if ((error as { code?: string }).code === '23505') {
        Alert.alert('Follow request', 'You already have a pending request with this person.');
      } else {
        Alert.alert('Follow request', error.message);
      }
      return;
    }
    await refFriendReq();
  };

  const acceptIncomingRequest = async (requestId: string) => {
    const sb = tryGetSupabase();
    if (!sb || !user?.id) return;
    const { error } = await sb
      .from('friend_requests')
      .update({ status: 'accepted', updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('addressee_id', user.id)
      .eq('status', 'pending');
    if (error) {
      Alert.alert('Follow request', error.message);
      return;
    }
    await Promise.all([refFriendReq(), refFollows(user.id)]);
  };

  const declineIncomingRequest = async (requestId: string) => {
    const sb = tryGetSupabase();
    if (!sb || !user?.id) return;
    const { error } = await sb
      .from('friend_requests')
      .update({ status: 'declined', updated_at: new Date().toISOString() })
      .eq('id', requestId)
      .eq('addressee_id', user.id)
      .eq('status', 'pending');
    if (error) {
      Alert.alert('Follow request', error.message);
      return;
    }
    await refFriendReq();
  };

  const removeFriend = (targetId: string, username: string) => {
    Alert.alert(
      'Remove friend',
      `Remove @${username}? Neither of you will follow each other anymore — you won’t see each other’s posts in Friends until you’re mutual again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const sb = tryGetSupabase();
              if (!sb || !user?.id) return;
              const { error } = await sb.rpc('remove_friendship', { other_id: targetId });
              if (error) {
                Alert.alert('Could not remove', error.message);
                return;
              }
              await Promise.all([refFollows(user.id), refresh()]);
            })();
          },
        },
      ],
    );
  };

  const renderPeopleYouFollow = () =>
    friendProfiles.map((f, idx) => (
      <View
        key={f.id}
        style={[
          styles.friendManageRow,
          { borderColor: scheme === 'dark' ? '#2a2a2a' : colors.border, backgroundColor: colors.card },
        ]}
      >
        <View
          style={[styles.friendAvatar, { backgroundColor: FRIEND_AVATAR_BG[idx % FRIEND_AVATAR_BG.length] }]}
        >
          <Text style={styles.friendInitial}>{(f.username || '?').charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={[styles.friendName, { color: colors.text1, fontFamily: font.syne, flex: 1 }]} numberOfLines={1}>
          @{f.username}
        </Text>
        <Pressable
          onPress={() => removeFriend(f.id, f.username)}
          hitSlop={8}
          style={({ pressed }) => [styles.removeFriendBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={{ fontFamily: font.syne, fontSize: 10, color: colors.text3, fontWeight: '700' }}>remove</Text>
        </Pressable>
      </View>
    ));

  const renderIncomingRequestRows = () =>
    incoming.map((req) => (
      <View
        key={req.id}
        style={[styles.incomingRow, styles.friendsTabIncomingRow, { borderColor: colors.border2, backgroundColor: colors.card }]}
      >
        <Text style={{ fontFamily: font.syne, color: colors.text1, flex: 1 }} numberOfLines={1}>
          @{req.profile?.username ?? 'user'}
        </Text>
        <Text style={{ fontFamily: font.dm, fontSize: 10, color: colors.text3, marginRight: 6 }}>wants to follow you</Text>
        <Pressable
          onPress={() => void declineIncomingRequest(req.id)}
          style={[styles.incomingPill, { borderColor: colors.border2 }]}
        >
          <Text style={{ fontFamily: font.syne, fontSize: 10, color: colors.text2 }}>decline</Text>
        </Pressable>
        <Pressable
          onPress={() => void acceptIncomingRequest(req.id)}
          style={[styles.incomingPill, { backgroundColor: colors.accent, borderColor: colors.accent }]}
        >
          <Text
            style={{
              fontFamily: font.syne,
              fontSize: 10,
              color: scheme === 'light' ? '#fff' : '#0a0a0a',
            }}
          >
            accept
          </Text>
        </Pressable>
      </View>
    ));

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24, alignItems: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPull} tintColor={colors.accent} />}
      >
        <View style={{ width: '100%', maxWidth: TABLET_CONTENT_MAX }}>
        <View style={styles.feedHeader}>
          <View style={styles.titleRow}>
            <Text style={[styles.feedTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>SIDEKIX</Text>
            <View style={[styles.toggleWrap, { backgroundColor: colors.pillBg }]}>
              <Pressable onPress={() => chooseHomeMode('feed')} style={[styles.tb, homeMode === 'feed' && { backgroundColor: colors.accent }]}>
                <Text
                  style={[
                    styles.tbText,
                    { fontFamily: font.syne },
                    { color: homeMode === 'feed' ? (scheme === 'light' ? '#fff' : '#0A0A0A') : colors.text3 },
                  ]}
                >
                  Feed
                </Text>
              </Pressable>
              <Pressable onPress={() => chooseHomeMode('recent')} style={[styles.tb, homeMode === 'recent' && { backgroundColor: colors.accent }]}>
                <Text
                  style={[
                    styles.tbText,
                    { fontFamily: font.syne },
                    { color: homeMode === 'recent' ? (scheme === 'light' ? '#fff' : '#0A0A0A') : colors.text3 },
                  ]}
                >
                  Recent
                </Text>
              </Pressable>
            </View>
          </View>
          {homeMode === 'recent' ? (
            <View style={[styles.toggleWrap, { backgroundColor: colors.pillBg, marginTop: 10 }]}>
              <Pressable onPress={() => setMode('campus')} style={[styles.tb, mode === 'campus' && { backgroundColor: colors.accent }]}>
                <Text
                  style={[
                    styles.tbText,
                    { fontFamily: font.syne },
                    { color: mode === 'campus' ? (scheme === 'light' ? '#fff' : '#0A0A0A') : colors.text3 },
                  ]}
                >
                  Campus
                </Text>
              </Pressable>
              <Pressable onPress={() => setMode('friends')} style={[styles.tb, mode === 'friends' && { backgroundColor: colors.accent }]}>
                <Text
                  style={[
                    styles.tbText,
                    { fontFamily: font.syne },
                    { color: mode === 'friends' ? (scheme === 'light' ? '#fff' : '#0A0A0A') : colors.text3 },
                  ]}
                >
                  Friends
                </Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        {homeMode === 'feed' ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catFilterRow}>
              {SIDEQUEST_CATEGORIES.map((cat) => (
                <Pressable
                  key={cat}
                  onPress={() => toggleCategory(cat)}
                  style={[
                    styles.catFilterChip,
                    { borderColor: colors.border2, backgroundColor: activeCats.includes(cat) ? colors.accentMuted : colors.card },
                  ]}
                >
                  <Text style={{ color: colors.text2, fontFamily: font.syne, fontSize: 11 }}>{cat}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {sidequestsLoading ? (
              <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
            ) : (
              <View style={styles.sidequestListWrap}>
                {sidequests.map((sq) => (
                  <Pressable
                    key={sq.id}
                    onPress={() => router.push(`/sidequest/${sq.id}`)}
                    style={({ pressed }) => [
                      styles.sidequestCard,
                      { borderColor: colors.border2, backgroundColor: colors.card, opacity: pressed ? 0.94 : 1 },
                    ]}
                  >
                    <View style={styles.sidequestHead}>
                      <Text style={{ color: colors.text3, fontFamily: font.syne, fontSize: 10 }}>
                        created by {sq.creator_username === 'anonymous' ? 'anonymous' : `@${sq.creator_username}`}
                      </Text>
                      <Text style={{ color: colors.text3 }}>→</Text>
                    </View>
                    <Text style={[styles.sidequestTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>{sq.title}</Text>
                    <View style={styles.sidequestTags}>
                      {(sq.categories ?? []).slice(0, 3).map((c) => (
                        <View key={c} style={[styles.sidequestTag, { borderColor: colors.border2, backgroundColor: colors.bg3 }]}>
                          <Text style={{ color: colors.text2, fontSize: 10, fontFamily: font.syne }}>{c}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={styles.previewRow}>
                      {sq.preview_posts.map((p) => (
                        <View key={p.id} style={styles.previewTile}>
                          <PostMediaTile
                            post={{
                              ...p,
                              challenge_id: 'sidequest',
                              caption: p.body,
                              text_style: null,
                            }}
                            style={styles.previewTile}
                            borderRadius={8}
                          />
                        </View>
                      ))}
                    </View>
                    <Text style={{ color: colors.text3, fontFamily: font.dm, fontSize: 12, marginTop: 6 }}>
                      {sq.completion_count} {sq.completion_count === 1 ? 'adventure' : 'adventures'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : null}

        {homeMode === 'recent' && mode === 'friends' && user?.id && incoming.length > 0 ? (
          <View style={styles.friendsTabTop}>
            <View style={styles.friendsTabSection}>
              <Text style={[styles.friendsTabSectionLabel, { color: colors.text3, fontFamily: font.syne }]}>
                follow requests
              </Text>
              {renderIncomingRequestRows()}
            </View>
          </View>
        ) : null}

        {homeMode === 'recent' ? (
          !challenge ? (
          chLoad ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
          ) : mode === 'friends' ? (
            <>
              {mutualFriendIds.length === 0 && incoming.length === 0 ? (
                <View style={[styles.friendsEmptyWrap, styles.friendsEmptyNoFriends]}>
                  <View style={[styles.addCard, { borderColor: colors.border2, backgroundColor: colors.card }]}>
                    <Text style={styles.addIcon}>👥</Text>
                    <Text style={[styles.addTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>
                      add friends to see their posts
                    </Text>
                    <Text style={[styles.addSub, { color: colors.text2, fontFamily: font.dm }]}>
                      you both need to follow each other (send a request and they accept, or vice versa) before posts show
                      here.
                    </Text>
                    <Pressable
                      onPress={() => setSheet(true)}
                      style={({ pressed }) => [
                        styles.addFriendsCta,
                        { backgroundColor: colors.accent, opacity: pressed ? 0.92 : 1 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.addFriendsCtaText,
                          { color: scheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.syne },
                        ]}
                      >
                        add friends
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              <SidekixTabState
                variant="feed"
                reason="no-challenge"
                colors={colors}
                scheme={scheme}
                minHeight={Math.max(360, winH - insets.top - 380)}
                onRetry={() => void refCh()}
              />
            </>
          ) : (
            <SidekixTabState
              variant="feed"
              reason="no-challenge"
              colors={colors}
              scheme={scheme}
              minHeight={Math.max(400, winH - insets.top - 120)}
              onRetry={() => void refCh()}
            />
          )
        ) : chLoad ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
        ) : loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
        ) : postsErr ? (
          <SidekixTabState
            variant="feed"
            reason="error"
            colors={colors}
            scheme={scheme}
            minHeight={Math.max(420, winH - insets.top - 100)}
            onRetry={() => void refresh()}
          />
        ) : (
          <>
            {!(mode === 'campus' && visible.length === 0) ? (
              <View style={styles.promptPad}>
                <View style={[styles.prompt, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.fpd, { backgroundColor: colors.accent }]} />
                  <Text style={[styles.fpt, { color: colors.text1, fontFamily: font.syne }]}>
                    {challengeTag(challenge)} ·{' '}
                    {(() => {
                      const { before, after } = splitChallengeTitle(challenge);
                      return (
                        <>
                          {before}
                          <Text style={{ color: colors.accent }}>{challenge.emphasis}</Text>
                          {after}
                        </>
                      );
                    })()}
                  </Text>
                  {campusFeedCountLine != null ? (
                    <Text style={[styles.fpc, { color: colors.text3, fontFamily: font.dm }]}>
                      {campusFeedCountLine}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
            {visible.length === 0 ? (
              mode === 'campus' ? (
                <View style={[styles.campusEmptyCenter, { minHeight: Math.max(400, winH - insets.top - 100) }]}>
                  <View style={styles.emptyHero}>
                    <View style={[styles.emptyIconWrap, { backgroundColor: scheme === 'dark' ? '#2A2218' : '#f0ebe3' }]}>
                      <Text style={styles.emptyIcon}>⚡</Text>
                    </View>
                    <Text style={[styles.emptyHeroTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>
                      no one&apos;s gone{'\n'}first yet.
                    </Text>
                    <Text style={[styles.emptyHeroSub, { color: colors.text2, fontFamily: font.dm }]}>
                      this sidequest just went live — your post could be the first thing people see.
                    </Text>
                    <Pressable
                      onPress={() => challenge && router.push('/upload')}
                      style={({ pressed }) => [
                        styles.emptyHeroCtaBtn,
                        { backgroundColor: colors.accent, opacity: pressed ? 0.92 : 1 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.emptyHeroCtaBtnText,
                          { color: scheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.syne },
                        ]}
                      >
                        add your take →
                      </Text>
                    </Pressable>
                  </View>
                </View>
              ) : friendProfiles.length > 0 ? (
                <View style={styles.friendsEmptyWrap}>
                  <Text style={[styles.waitingLabel, { color: colors.text3, fontFamily: font.syne }]}>waiting on</Text>
                  <Text style={[styles.friendsLine, { color: colors.text2, fontFamily: font.dm }]}>{friendsPendingLine}</Text>
                </View>
              ) : (
                <View style={[styles.friendsEmptyWrap, styles.friendsEmptyNoFriends]}>
                  <View style={[styles.addCard, { borderColor: colors.border2, backgroundColor: colors.card }]}>
                    <Text style={styles.addIcon}>👥</Text>
                    <Text style={[styles.addTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>
                      add friends to see their posts
                    </Text>
                    <Text style={[styles.addSub, { color: colors.text2, fontFamily: font.dm }]}>
                      once your friends post, you&apos;ll see their takes here
                    </Text>
                    <Pressable
                      onPress={() => setSheet(true)}
                      style={({ pressed }) => [
                        styles.addFriendsCta,
                        { backgroundColor: colors.accent, opacity: pressed ? 0.92 : 1 },
                      ]}
                    >
                      <Text style={[styles.addFriendsCtaText, { color: scheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.syne }]}>
                        add friends
                      </Text>
                    </Pressable>
                  </View>
                  <Pressable
                    onPress={() => setMode('campus')}
                    style={[styles.redirectCard, { borderColor: colors.accent, backgroundColor: colors.card }]}
                  >
                    <Text style={[styles.redirectTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>
                      see what campus is posting
                    </Text>
                    <Text style={[styles.redirectSub, { color: colors.text2, fontFamily: font.dm }]}>
                      see everyone&apos;s takes while you wait on your friends
                    </Text>
                    <Text style={[styles.redirectCta, { color: colors.accent, fontFamily: font.syne }]}>see campus feed →</Text>
                  </Pressable>
                </View>
              )
            ) : (
              <View style={[styles.grid, sparseCampusFeed && styles.gridSparse]}>
                {visible.map((c) => {
                  const voted = myVoteIds.has(c.id);
                  return (
                    <View key={c.id} style={[styles.card, sparseCampusFeed && styles.cardSparse]}>
                      <View style={{ width: '100%', aspectRatio: 3 / 4, borderRadius: 12, overflow: 'hidden' }}>
                        <Pressable onPress={() => setViewerPost(c)} style={StyleSheet.absoluteFillObject}>
                          <PostMediaTile post={c} style={StyleSheet.absoluteFillObject} borderRadius={12} />
                          <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.82)']}
                            style={styles.cardFade}
                          />
                        </Pressable>
                        <Pressable
                          onPress={() => void sharePostLink(c.id)}
                          style={styles.sharePill}
                          hitSlop={6}
                          accessibilityLabel="Share link to this post"
                        >
                          <Text style={styles.sharePillText}>↗</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => onVote(c.id, voted)}
                          style={[
                            styles.reactionBtn,
                            voted && {
                              backgroundColor: scheme === 'dark' ? 'rgba(212,255,63,0.18)' : 'rgba(212,255,63,0.96)',
                              borderColor: scheme === 'dark' ? 'rgba(212,255,63,0.45)' : '#8EAF16',
                              borderWidth: 1,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.fuArrow,
                              { color: voted ? (scheme === 'light' ? '#253100' : colors.accent) : 'rgba(255,255,255,0.5)' },
                            ]}
                          >
                            ▲
                          </Text>
                          {!hidePublicCounts ? (
                            <Text
                              style={[
                                styles.fuCount,
                                {
                                  color: voted
                                    ? scheme === 'light'
                                      ? '#253100'
                                      : colors.accent
                                    : 'rgba(255,255,255,0.5)',
                                  fontFamily: font.syne,
                                },
                              ]}
                            >
                              {c.vote_count}
                            </Text>
                          ) : null}
                        </Pressable>
                        <View style={styles.fco}>
                          <Text style={[styles.fcu, { fontFamily: font.syne }, c.is_anonymous && { color: '#aaa' }]}>
                            {c.is_anonymous ? 'anon' : `@${usernames[c.user_id] ?? 'user'}`}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
            {mode === 'friends' && visible.length > 0 ? (
              <View style={styles.friendsFeedFooter}>
                <Text style={[styles.friendsFeedFooterText, { color: colors.text2, fontFamily: font.dm }]}>
                  follow people to see their posts here
                </Text>
                <Pressable
                  onPress={() => setSheet(true)}
                  style={({ pressed }) => [
                    styles.friendsFeedFooterBtn,
                    { borderColor: colors.accent, opacity: pressed ? 0.85 : 1 },
                  ]}
                >
                  <Text
                    style={[
                      styles.friendsFeedFooterBtnText,
                      { color: colors.accent, fontFamily: font.syne },
                    ]}
                  >
                    add friends
                  </Text>
                </Pressable>
              </View>
            ) : null}
            {sparseCampusFeed ? (
              <View style={[styles.sparseFoot, { borderColor: colors.border2, backgroundColor: colors.card }]}>
                <Text style={[styles.sparseFootText, { color: colors.text2, fontFamily: font.dm }]}>
                  {posts.length <= 1
                    ? postedToday
                      ? 'Campus is still waking up — cheer people on with reactions.'
                      : 'Campus is quiet — your post could set the tone.'
                    : postedToday
                      ? 'Still early — hang out and vote for your favorites.'
                      : 'Still early — add a take or see what lands next.'}
                </Text>
                <Pressable
                  onPress={() => (postedToday ? router.push('/today') : router.push('/upload'))}
                  style={({ pressed }) => [
                    styles.sparseFootBtn,
                    { borderColor: colors.accent, opacity: pressed ? 0.88 : 1 },
                  ]}
                >
                  <Text style={[styles.sparseFootBtnText, { color: colors.accent, fontFamily: font.syne }]}>
                    {postedToday ? 'back to today →' : 'add your take →'}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </>
        )
        ) : null}
        {homeMode === 'recent' && mode === 'friends' && user?.id && mutualFriendIds.length > 0 ? (
          <View
            style={[
              styles.friendsTabBottom,
              {
                borderTopColor: colors.border2,
                borderTopWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <Text style={[styles.friendsTabSectionLabel, { color: colors.text3, fontFamily: font.syne }]}>
              friends
            </Text>
            {renderPeopleYouFollow()}
          </View>
        ) : null}
        </View>
      </ScrollView>

      <Pressable
        onPress={() => router.push('/post-choice')}
        style={({ pressed }) => [
          styles.fabPost,
          { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1, bottom: Math.max(insets.bottom, 12) + 8 },
        ]}
      >
        <Text style={{ color: resolvedScheme === 'light' ? '#fff' : '#0A0A0A', fontSize: 22, fontFamily: font.syneExtra }}>+</Text>
      </Pressable>

      <Modal visible={sheet} animationType="slide" transparent onRequestClose={() => setSheet(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={styles.sheetBackdropDim} onPress={() => setSheet(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
            style={{ width: '100%' }}
          >
            <View
              style={[styles.sheet, { backgroundColor: colors.bg2, paddingBottom: Math.max(insets.bottom, 20) }]}
            >
            <Text style={[styles.sheetTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>add friends</Text>
            <Text style={[styles.sheetSub, { color: colors.text2, fontFamily: font.dm }]}>
              search by username
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="username"
                placeholderTextColor={colors.text3}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={() => void runSearch()}
                style={[
                  styles.sheetInput,
                  { flex: 1, backgroundColor: colors.bg3, borderColor: colors.border2, color: colors.text1, fontFamily: font.dm },
                ]}
              />
              <Pressable
                onPress={() => void runSearch()}
                style={[styles.searchGo, { backgroundColor: colors.accent }]}
              >
                <Text style={{ fontFamily: font.syne, color: scheme === 'light' ? '#fff' : '#0a0a0a' }}>go</Text>
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 280 }} keyboardShouldPersistTaps="handled">
              {results.map((r) => {
                const isMutual = mutualFriendIds.includes(r.id);
                const isPending = outgoingIds.includes(r.id);
                return (
                  <View key={r.id} style={[styles.contact, { borderBottomColor: colors.border }]}>
                    <Text style={{ fontFamily: font.syne, color: colors.text1, flex: 1 }}>@{r.username}</Text>
                    {isMutual ? (
                      <View style={[styles.addBtn, { backgroundColor: colors.bg3, opacity: 0.85 }]}>
                        <Text style={{ fontFamily: font.syne, fontSize: 10, color: colors.text3 }}>friends</Text>
                      </View>
                    ) : isPending ? (
                      <View style={[styles.addBtn, { backgroundColor: colors.bg3, opacity: 0.85 }]}>
                        <Text style={{ fontFamily: font.syne, fontSize: 10, color: colors.text3 }}>requested</Text>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => void requestFollow(r.id)}
                        hitSlop={8}
                        style={[styles.addBtn, styles.addBtnHit, { backgroundColor: colors.accent }]}
                      >
                        <Text
                          style={{ fontFamily: font.syne, fontSize: 10, color: scheme === 'light' ? '#fff' : '#0a0a0a' }}
                        >
                          request
                        </Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </ScrollView>
            <Pressable onPress={() => setSheet(false)} style={{ marginTop: 12 }}>
              <Text style={{ textAlign: 'center', color: colors.text2, fontFamily: font.syne }}>done</Text>
            </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <PostMediaViewerModal post={viewerPost} visible={Boolean(viewerPost)} onClose={() => setViewerPost(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  feedHeader: { paddingHorizontal: 18, paddingTop: 12 },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  feedTitle: { fontSize: 23, letterSpacing: -0.35 },
  catFilterRow: { paddingHorizontal: 18, gap: 8, paddingBottom: 8 },
  catFilterChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  sidequestListWrap: { paddingHorizontal: 18, paddingBottom: 16, gap: 10 },
  sidequestCard: { borderWidth: 1, borderRadius: 14, padding: 12 },
  sidequestHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sidequestTitle: { fontSize: 18, lineHeight: 24, marginTop: 6 },
  sidequestTags: { marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sidequestTag: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  previewRow: { marginTop: 10, flexDirection: 'row', gap: 6 },
  previewTile: { width: 54, height: 54, borderRadius: 8, overflow: 'hidden' },
  toggleWrap: { flexDirection: 'row', borderRadius: 20, padding: 3 },
  tb: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 16 },
  tbText: { fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: '700' },
  friendsTabTop: { paddingHorizontal: 18, paddingBottom: 8, width: '100%' },
  friendsTabBottom: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 12, width: '100%' },
  friendsTabSection: { width: '100%' },
  friendsTabSectionLabel: {
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  friendsTabIncomingRow: {
    marginBottom: 8,
    flexWrap: 'wrap',
  },
  friendManageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 10,
    marginBottom: 8,
  },
  removeFriendBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  friendsFeedFooter: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 22,
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  friendsFeedFooterText: { fontSize: 12, lineHeight: 18, textAlign: 'center', maxWidth: 300 },
  friendsFeedFooterBtn: {
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderWidth: 1,
  },
  friendsFeedFooterBtnText: { fontSize: 12, fontWeight: '800' },
  promptPad: { paddingHorizontal: 18, paddingVertical: 10 },
  prompt: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 13 },
  fpd: { width: 5, height: 5, borderRadius: 2.5 },
  fpt: { flex: 1, fontSize: 11, fontWeight: '700' },
  fpc: { fontSize: 11 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 18,
    gap: 7,
    justifyContent: 'space-between',
  },
  gridSparse: {
    flexDirection: 'column',
    flexWrap: 'nowrap',
    alignItems: 'stretch',
    gap: 14,
  },
  card: { width: '48%', borderRadius: 12, overflow: 'hidden', position: 'relative', marginBottom: 7 },
  cardSparse: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    marginBottom: 0,
  },
  sparseFoot: {
    marginHorizontal: 18,
    marginTop: 6,
    marginBottom: 8,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  sparseFootText: { fontSize: 12, lineHeight: 17, textAlign: 'center' },
  sparseFootBtn: {
    alignSelf: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  sparseFootBtnText: { fontSize: 12, fontWeight: '800' },
  cardFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '55%' },
  sharePill: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sharePillText: { fontSize: 12, color: '#fff', fontWeight: '800' },
  reactionBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 7,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    gap: 1,
  },
  fuArrow: { fontSize: 11 },
  fuCount: { fontSize: 10, fontWeight: '700' },
  fco: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 9, paddingTop: 12, paddingBottom: 8 },
  fcu: { fontSize: 11, fontWeight: '700', color: '#fff' },
  campusEmptyCenter: { justifyContent: 'center', paddingHorizontal: 0, width: '100%' },
  emptyHero: {
    paddingHorizontal: 22,
    paddingTop: 0,
    paddingBottom: 28,
    alignItems: 'center',
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyIcon: { fontSize: 26 },
  emptyHeroTitle: { fontSize: 26, lineHeight: 30, marginBottom: 12, textAlign: 'center', maxWidth: 320 },
  emptyHeroSub: { fontSize: 13, lineHeight: 20, textAlign: 'center', maxWidth: 300 },
  emptyHeroCtaBtn: {
    marginTop: 28,
    alignSelf: 'stretch',
    maxWidth: 340,
    width: '100%',
    borderRadius: 50,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  emptyHeroCtaBtnText: { fontSize: 15, fontWeight: '800', textAlign: 'center' },
  friendsEmptyWrap: { paddingHorizontal: 18, gap: 10 },
  friendsEmptyNoFriends: { paddingTop: 8 },
  waitingLabel: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 },
  friendRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, gap: 12 },
  friendAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  friendInitial: { color: '#fff', fontSize: 17, fontWeight: '700', fontFamily: font.syneExtra },
  friendName: { flex: 1, fontSize: 13 },
  pendingDot: { width: 8, height: 8, borderRadius: 4 },
  friendsLine: { fontSize: 12, lineHeight: 18, marginTop: 4, marginBottom: 4 },
  redirectCard: { borderWidth: 1, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 14, marginTop: 6 },
  redirectTitle: { fontSize: 16, lineHeight: 20, marginBottom: 4 },
  redirectSub: { fontSize: 12, lineHeight: 17 },
  redirectCta: { fontSize: 12, marginTop: 8, letterSpacing: 0.5 },
  addCard: { borderWidth: 1, borderRadius: 14, paddingVertical: 18, paddingHorizontal: 16, marginBottom: 2, alignItems: 'center' },
  addIcon: { fontSize: 22, marginBottom: 10 },
  addTitle: { fontSize: 18, lineHeight: 22, marginBottom: 8, textAlign: 'center', maxWidth: 300 },
  addSub: { fontSize: 13, lineHeight: 19, marginBottom: 16, textAlign: 'center', maxWidth: 300 },
  addFriendsCta: { alignSelf: 'stretch', borderRadius: 50, paddingVertical: 14, paddingHorizontal: 24 },
  addFriendsCtaText: { fontSize: 14, fontWeight: '800', textAlign: 'center' },
  sheetBackdropDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 36,
  },
  sheetTitle: { fontSize: 17, fontWeight: '800', marginBottom: 6 },
  sheetSub: { fontSize: 12, lineHeight: 18, marginBottom: 16 },
  sheetInput: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, fontSize: 14 },
  searchGo: {
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contact: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, gap: 10 },
  addBtn: { borderRadius: 20, paddingVertical: 5, paddingHorizontal: 12 },
  addBtnHit: { minHeight: 36, minWidth: 72, justifyContent: 'center', alignItems: 'center' },
  incomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  incomingPill: {
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
  },
  fabPost: {
    position: 'absolute',
    right: 16,
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
