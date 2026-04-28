import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme, type ThemePreference } from '../../src/context/AppThemeContext';
import { useMyPosts } from '../../src/hooks/useMyPosts';
import { useReadableStorageUrl } from '../../src/hooks/useReadableStorageUrl';
import { getHomeFeedMode, setHomeFeedMode, type HomeFeedMode } from '../../src/lib/homeFeedPreference';
import { localCalendarYmd } from '../../src/lib/calendarDate';
import { readLocalUriAsArrayBuffer } from '../../src/lib/readLocalMediaForUpload';
import { computeSidequestPostStreak } from '../../src/lib/sidequestPeriod';
import { tryGetSupabase } from '../../src/lib/supabase';
import { PostMediaTile } from '../../src/components/PostMediaTile';
import { statSidequestsKey, statReactionsKey } from '../../src/lib/formatCount';
import { hapticLight } from '../../src/lib/haptics';
import { font, getColors } from '../../src/theme';

const TABLET_CONTENT_MAX = 640;
const SUBMISSIONS_GRID_GAP = 8;

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: winH, width: winW } = useWindowDimensions();
  const { resolvedScheme, preference, setPreference } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const scheme = resolvedScheme;
  const { user, profile, signOut, deleteAccount, setFriendsOnly, saveProfile, refreshProfile } = useAuth();
  const { posts, loading, refresh } = useMyPosts(user?.id);
  const contentW = Math.min(winW, TABLET_CONTENT_MAX);
  const submissionTileSize =
    posts.length >= 3
      ? Math.max(100, Math.floor((contentW - 36 - SUBMISSIONS_GRID_GAP * 2) / 3))
      : 140;
  const { displayUri: savedAvatarUrl, onLoadError: onAvatarError } = useReadableStorageUrl(
    profile?.avatar_path ?? null,
  );
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState(profile?.username ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarMime, setAvatarMime] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [stats, setStats] = useState({ sidequests: 0, reactions: 0, won: 0, streak: 0 });
  const [homeModePref, setHomeModePref] = useState<HomeFeedMode>('feed');
  const [calendarCursor, setCalendarCursor] = useState(() => new Date());
  const [selectedYmd, setSelectedYmd] = useState(() => localCalendarYmd());

  useEffect(() => {
    setDraft(profile?.username ?? '');
  }, [profile?.username]);

  useEffect(() => {
    setAvatarUri(null);
  }, [profile?.avatar_path]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const m = await getHomeFeedMode(user?.id ?? null);
      if (!cancelled) setHomeModePref(m);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const loadStats = async () => {
      const sb = tryGetSupabase();
      if (!sb || !user?.id) {
        setStats({ sidequests: 0, reactions: 0, won: 0, streak: 0 });
        return;
      }
      const challengeIds = [...new Set(posts.map((p) => p.challenge_id))];
      const sidequests = challengeIds.length;
      let reactions = 0;
      let won = 0;
      let streak = 0;

      if (posts.length > 0) {
        const { data: myVotes } = await sb.from('votes').select('post_id').in(
          'post_id',
          posts.map((p) => p.id),
        );
        reactions = (myVotes ?? []).length;
      }

      if (challengeIds.length > 0) {
        const { data: challengePosts } = await sb
          .from('posts')
          .select('id,user_id,challenge_id')
          .in('challenge_id', challengeIds);
        const cp = (challengePosts ?? []) as { id: string; user_id: string; challenge_id: string }[];
        if (cp.length > 0) {
          const { data: allVotes } = await sb.from('votes').select('post_id').in(
            'post_id',
            cp.map((p) => p.id),
          );
          const voteCount = new Map<string, number>();
          (allVotes ?? []).forEach((v: { post_id: string }) => {
            voteCount.set(v.post_id, (voteCount.get(v.post_id) ?? 0) + 1);
          });
          const bestByChallenge = new Map<string, { userId: string; score: number }>();
          cp.forEach((p) => {
            const score = voteCount.get(p.id) ?? 0;
            const prev = bestByChallenge.get(p.challenge_id);
            if (!prev || score > prev.score) {
              bestByChallenge.set(p.challenge_id, { userId: p.user_id, score });
            }
          });
          won = [...bestByChallenge.values()].filter((r) => r.userId === user.id).length;
        }

        const { data: chDayRows } = await sb.from('challenges').select('day').in('id', challengeIds);
        const postedChallengeDays = new Set((chDayRows ?? []).map((r: { day: string }) => r.day));
        streak = computeSidequestPostStreak(postedChallengeDays);
      }
      setStats({ sidequests, reactions, won, streak });
    };
    void loadStats();
  }, [posts, user?.id]);

  const onPull = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshProfile()]);
    setRefreshing(false);
  };

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErr('Photo library access is required to change your profile image.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!res.canceled && res.assets[0]) {
      setErr(null);
      const a = res.assets[0];
      setAvatarUri(a.uri);
      setAvatarMime(a.mimeType ?? null);
    }
  };

  const persistUsername = async () => {
    setErr(null);
    setBusy(true);
    let uploadedAvatarPath: string | null | undefined = profile?.avatar_path ?? null;
    if (avatarUri && user?.id) {
      const sb = tryGetSupabase();
      if (!sb) {
        setBusy(false);
        setErr('Supabase not configured');
        return;
      }
      const path = `${user.id}/avatar-${Date.now()}.jpg`;
      try {
        const body = await readLocalUriAsArrayBuffer(avatarUri);
        const contentType = (avatarMime && avatarMime.length > 0 ? avatarMime : null) ?? 'image/jpeg';
        const { error: upErr } = await sb.storage.from('post-media').upload(path, body, {
          contentType,
          upsert: true,
        });
        if (upErr) {
          setBusy(false);
          setErr(upErr.message);
          return;
        }
        uploadedAvatarPath = path;
      } catch (e) {
        setBusy(false);
        setErr(e instanceof Error ? e.message : 'Could not read your photo.');
        return;
      }
    }
    const { error } = await saveProfile(draft.trim(), profile?.display_emoji ?? '🌵', uploadedAvatarPath);
    setBusy(false);
    if (error) setErr(error);
    else {
      setAvatarUri(null);
      setAvatarMime(null);
      setSheet(false);
    }
  };

  const cyclePref = (p: ThemePreference) => setPreference(p);

  const monthMeta = useMemo(() => {
    const d = new Date(calendarCursor);
    d.setDate(1);
    const startDow = d.getDay();
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const ymds: string[] = [];
    for (let i = 0; i < daysInMonth; i++) {
      const cur = new Date(d);
      cur.setDate(d.getDate() + i);
      ymds.push(localCalendarYmd(cur));
    }
    return {
      label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
      startDow,
      daysInMonth,
      ymds,
    };
  }, [calendarCursor]);

  const postsByYmd = useMemo(() => {
    const map = new Map<string, typeof posts>();
    posts.forEach((p) => {
      const ymd = localCalendarYmd(new Date(p.created_at));
      const cur = map.get(ymd) ?? [];
      cur.push(p);
      map.set(ymd, cur);
    });
    return map;
  }, [posts]);

  const selectedDayPosts = useMemo(() => postsByYmd.get(selectedYmd) ?? [], [postsByYmd, selectedYmd]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24, alignItems: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPull} tintColor={colors.accent} />}
      >
        <View style={{ width: '100%', maxWidth: TABLET_CONTENT_MAX }}>
        <View style={styles.header}>
          <View style={styles.top}>
            <Pressable onPress={() => setSheet(true)}>
              <View style={[styles.avatar, { borderColor: colors.border2 }]}>
                {avatarUri || savedAvatarUrl ? (
                  <Image
                    source={{ uri: avatarUri ?? savedAvatarUrl! }}
                    style={StyleSheet.absoluteFillObject}
                    contentFit="cover"
                    onError={onAvatarError}
                  />
                ) : (
                  <Text style={{ fontSize: 22 }}>{profile?.display_emoji ?? '🌵'}</Text>
                )}
              </View>
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={[styles.profName, { color: colors.text1, fontFamily: font.syneExtra }]}>
                {profile?.username ?? '…'}
              </Text>
              <Pressable onPress={() => setSheet(true)}>
                <Text style={[styles.profEdit, { color: colors.accent, fontFamily: font.syne }]}>edit profile</Text>
              </Pressable>
            </View>
          </View>
          <View style={[styles.statsRow, { borderColor: colors.border2, backgroundColor: colors.card }]}>
            <View style={[styles.statCell, { borderRightWidth: 1, borderRightColor: colors.border2 }]}>
              <Text style={[styles.statValue, { color: colors.text1, fontFamily: font.syneExtra }]}>
                {stats.sidequests.toLocaleString()}
              </Text>
              <Text style={[styles.statKey, { color: colors.text3, fontFamily: font.syne }]}>
                {statSidequestsKey(stats.sidequests)}
              </Text>
            </View>
            <View style={[styles.statCell, { borderRightWidth: 1, borderRightColor: colors.border2 }]}>
              <Text style={[styles.statValue, { color: colors.accent, fontFamily: font.syneExtra }]}>
                {stats.reactions.toLocaleString()}
              </Text>
              <Text style={[styles.statKey, { color: colors.text3, fontFamily: font.syne }]}>
                {statReactionsKey(stats.reactions)}
              </Text>
            </View>
            <View style={styles.statCell}>
              <Text style={[styles.statValue, { color: colors.text1, fontFamily: font.syneExtra }]}>{`${stats.won}X`}</Text>
              <Text style={[styles.statKey, { color: colors.text3, fontFamily: font.syne }]}>WON</Text>
            </View>
          </View>

          <View style={[styles.streakRow, { borderColor: colors.border2, backgroundColor: colors.card }]}>
            <Text style={styles.streakEmoji}>🔥</Text>
            <Text style={[styles.streakHint, { color: colors.text3, fontFamily: font.dm }]}>
              {stats.streak > 0 ? 'post each sidequest to keep it going' : 'post to start your streak'}
            </Text>
            <View style={[styles.streakPill, { backgroundColor: colors.accent }]}>
              <Text
                style={[
                  styles.streakPillText,
                  { color: scheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.syneExtra },
                ]}
              >
                {stats.streak}
              </Text>
            </View>
          </View>

          <Text style={[styles.sectionLabel, { color: colors.text3, fontFamily: font.syne }]}>appearance</Text>
          <View style={[styles.themeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {(['system', 'light', 'dark'] as const).map((p) => (
              <Pressable
                key={p}
                onPress={() => {
                  hapticLight();
                  cyclePref(p);
                }}
                style={[
                  styles.themeChip,
                  preference === p && { backgroundColor: colors.accent },
                  { borderColor: colors.border2 },
                ]}
              >
                <Text
                  style={[
                    styles.themeChipText,
                    { fontFamily: font.syne },
                    { color: preference === p ? (scheme === 'light' ? '#fff' : '#0a0a0a') : colors.text2 },
                  ]}
                >
                  {p}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.sectionLabel, { color: colors.text3, fontFamily: font.syne, marginTop: 14 }]}>default home</Text>
          <View style={[styles.themeRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {(['feed', 'recent'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => {
                  hapticLight();
                  setHomeModePref(m);
                  void setHomeFeedMode(user?.id ?? null, m);
                }}
                style={[styles.themeChip, homeModePref === m && { backgroundColor: colors.accent }, { borderColor: colors.border2 }]}
              >
                <Text
                  style={[
                    styles.themeChipText,
                    { fontFamily: font.syne },
                    { color: homeModePref === m ? (scheme === 'light' ? '#fff' : '#0a0a0a') : colors.text2 },
                  ]}
                >
                  {m}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => setAccountOpen(true)}
            style={[styles.accountBtn, { borderColor: colors.border2, backgroundColor: colors.card }]}
          >
            <Text style={{ color: colors.text2, fontFamily: font.syne, fontWeight: '700' }}>account</Text>
          </Pressable>
        </View>

        <View style={[styles.sh, { marginTop: 8 }]}>
          <Text style={[styles.sectionTitle, { color: colors.text3, fontFamily: font.syne }]}>calendar</Text>
        </View>
        <View style={[styles.calendarWrap, { borderColor: colors.border2, backgroundColor: colors.card }]}>
          <View style={styles.calendarHead}>
            <Pressable
              onPress={() => {
                const d = new Date(calendarCursor);
                d.setMonth(d.getMonth() - 1);
                setCalendarCursor(d);
              }}
            >
              <Text style={{ color: colors.text2, fontFamily: font.syne }}>←</Text>
            </Pressable>
            <Text style={{ color: colors.text1, fontFamily: font.syneExtra }}>{monthMeta.label}</Text>
            <Pressable
              onPress={() => {
                const d = new Date(calendarCursor);
                d.setMonth(d.getMonth() + 1);
                setCalendarCursor(d);
              }}
            >
              <Text style={{ color: colors.text2, fontFamily: font.syne }}>→</Text>
            </Pressable>
          </View>
          <View style={styles.calendarGrid}>
            {Array.from({ length: monthMeta.startDow }).map((_, i) => (
              <View key={`blank-${i}`} style={styles.calendarCell} />
            ))}
            {monthMeta.ymds.map((ymd, idx) => {
              const hasPosts = (postsByYmd.get(ymd)?.length ?? 0) > 0;
              const isSelected = selectedYmd === ymd;
              return (
                <Pressable
                  key={ymd}
                  onPress={() => setSelectedYmd(ymd)}
                  style={[
                    styles.calendarCell,
                    isSelected && { backgroundColor: colors.accentMuted, borderRadius: 8 },
                  ]}
                >
                  <Text style={{ color: colors.text1, fontFamily: font.dm, fontSize: 12 }}>{idx + 1}</Text>
                  {hasPosts ? <View style={[styles.calendarDot, { backgroundColor: colors.accent }]} /> : null}
                </Pressable>
              );
            })}
          </View>
          <View style={[styles.calendarSelected, { borderTopColor: colors.border2 }]}>
            <Text style={{ color: colors.text2, fontFamily: font.syne, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7 }}>
              {selectedYmd}
            </Text>
            <Text style={{ color: colors.text1, fontFamily: font.dm, marginTop: 4 }}>
              {selectedDayPosts.length === 0
                ? 'no sidequests completed'
                : `${selectedDayPosts.length} ${selectedDayPosts.length === 1 ? 'sidequest' : 'sidequests'} completed`}
            </Text>
          </View>
        </View>

        <View style={styles.sh}>
          <Text style={[styles.sectionTitle, { color: colors.text3, fontFamily: font.syne }]}>your submissions</Text>
        </View>
        {loading ? (
          <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} />
        ) : posts.length === 0 ? (
          <View style={[styles.submissionsEmptyFlex, { minHeight: Math.max(220, winH - insets.top - 420) }]}>
            <View style={styles.submissionsEmptyInner}>
              <Text style={[styles.submissionsEmptyTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>
                nothing here yet
              </Text>
              <Text style={[styles.submissionsEmptySub, { color: colors.text2, fontFamily: font.dm }]}>
                all of your posts show up here. peek at what everyone&apos;s doing in the meantime.
              </Text>
              <Pressable onPress={() => router.push('/feed')}>
                <Text style={[styles.submissionsEmptyCta, { color: colors.accent, fontFamily: font.syne }]}>
                  see campus feed →
                </Text>
              </Pressable>
            </View>
          </View>
        ) : posts.length < 3 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.submissionsRow}
          >
            {posts.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/submission/${p.id}`)}
                style={[styles.cellLarge, { borderColor: colors.border2 }]}
              >
                <PostMediaTile post={p} style={styles.submissionThumbFill} borderRadius={12} />
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View
            style={[
              styles.grid,
              {
                paddingHorizontal: 18,
                columnGap: SUBMISSIONS_GRID_GAP,
                rowGap: SUBMISSIONS_GRID_GAP,
                justifyContent: 'flex-start',
              },
            ]}
          >
            {posts.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/submission/${p.id}`)}
                style={[
                  styles.submissionCell,
                  {
                    width: submissionTileSize,
                    height: submissionTileSize,
                    borderColor: colors.border2,
                  },
                ]}
              >
                <PostMediaTile post={p} style={styles.submissionThumbFill} borderRadius={6} />
              </Pressable>
            ))}
          </View>
        )}
        </View>
      </ScrollView>

      <Modal visible={accountOpen} animationType="slide" transparent onRequestClose={() => setAccountOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={styles.sheetBackdropDim} onPress={() => setAccountOpen(false)} />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={0}
            style={{ width: '100%' }}
          >
            <View
              style={[styles.sheet, { backgroundColor: colors.bg2, paddingBottom: Math.max(insets.bottom, 20) }]}
              onStartShouldSetResponder={() => true}
            >
              <Text style={[styles.sheetTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>account</Text>
              <View style={[styles.accountSheetRow, styles.accountFriendsBlock, { borderColor: colors.border2 }]}>
                <View style={{ flex: 1, paddingRight: 10 }}>
                  <Text style={{ color: colors.text1, fontFamily: font.syne, fontWeight: '700' }}>friends only</Text>
                  <Text style={{ color: colors.text3, fontFamily: font.dm, fontSize: 11, marginTop: 5, lineHeight: 15 }}>
                    When on, only people who follow you can see your posts and your profile.
                  </Text>
                </View>
                <Switch
                  value={Boolean(profile?.friends_only)}
                  onValueChange={(v) => {
                    void (async () => {
                      const { error } = await setFriendsOnly(v);
                      if (error) Alert.alert('Could not update', error);
                    })();
                  }}
                  trackColor={{
                    false: colors.bg3,
                    true: scheme === 'dark' ? 'rgba(212,255,63,0.35)' : 'rgba(90,122,0,0.35)',
                  }}
                  thumbColor={profile?.friends_only ? colors.accent : colors.text3}
                  ios_backgroundColor={colors.border2}
                />
              </View>
              <Pressable
                onPress={async () => {
                  setAccountOpen(false);
                  await signOut();
                  router.replace('/');
                }}
                style={[styles.accountSheetRow, { borderColor: colors.border2 }]}
              >
                <Text style={{ color: colors.text1, fontFamily: font.syne }}>sign out</Text>
              </Pressable>
              <Pressable
                disabled={deleteBusy || busy}
                onPress={() => {
                  Alert.alert(
                    'Delete account',
                    'This permanently deletes your Sidekix account and data you added in the app. This cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete account',
                        style: 'destructive',
                        onPress: () => {
                          void (async () => {
                            setAccountOpen(false);
                            setErr(null);
                            setDeleteBusy(true);
                            const { error } = await deleteAccount();
                            setDeleteBusy(false);
                            if (error) {
                              Alert.alert('Could not delete account', error);
                              return;
                            }
                            router.replace('/');
                          })();
                        },
                      },
                    ],
                  );
                }}
                style={[styles.accountSheetRow, styles.accountSheetDanger, { borderColor: 'rgba(255,80,80,0.35)' }]}
              >
                <Text style={{ color: '#f66', fontFamily: font.syne, fontWeight: '700' }}>delete account</Text>
              </Pressable>
              <Pressable onPress={() => setAccountOpen(false)}>
                <Text style={{ textAlign: 'center', color: colors.text2, fontFamily: font.syne, paddingVertical: 12 }}>
                  close
                </Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

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
              onStartShouldSetResponder={() => true}
            >
            <Text style={[styles.sheetTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>edit profile</Text>
            <Text style={[styles.fieldLabel, { color: colors.text3, fontFamily: font.syne }]}>USERNAME</Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              style={[
                styles.sheetInput,
                { backgroundColor: colors.bg3, borderColor: colors.border2, color: colors.text1, fontFamily: font.dm },
              ]}
            />
            {err ? <Text style={{ color: '#f66', fontFamily: font.dm, marginBottom: 8 }}>{err}</Text> : null}
            <Pressable onPress={pickAvatar} style={[styles.sheetAvatarBtn, { borderColor: colors.border2 }]}>
              <Text style={{ color: colors.text1, fontFamily: font.syne }}>change profile image</Text>
            </Pressable>
            {(avatarUri || profile?.avatar_path) && (
              <Pressable
                onPress={() => setAvatarUri(null)}
                style={[styles.sheetAvatarBtn, { borderColor: colors.border2, marginTop: 8, marginBottom: 18 }]}
              >
                <Text style={{ color: colors.text2, fontFamily: font.syne }}>use current image</Text>
              </Pressable>
            )}
            <Pressable
              onPress={persistUsername}
              disabled={busy}
              style={({ pressed }) => [
                styles.sheetPrimary,
                { backgroundColor: colors.accent, opacity: pressed || busy ? 0.85 : 1 },
              ]}
            >
              {busy ? (
                <ActivityIndicator color={scheme === 'light' ? '#fff' : '#0a0a0a'} />
              ) : (
                <Text style={{ fontFamily: font.syne, fontWeight: '800', color: scheme === 'light' ? '#fff' : '#0a0a0a' }}>
                  save →
                </Text>
              )}
            </Pressable>
            <Pressable onPress={() => setSheet(false)}>
              <Text style={{ textAlign: 'center', color: colors.text2, fontFamily: font.syne, paddingVertical: 8 }}>cancel</Text>
            </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 13, marginBottom: 16 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#D4FF3F',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  profName: { fontSize: 15, letterSpacing: -0.2 },
  profEdit: { fontSize: 10, letterSpacing: 0.6, marginTop: 3, fontWeight: '700' },
  statsRow: { borderWidth: 1, borderRadius: 12, flexDirection: 'row', marginBottom: 10, overflow: 'hidden' },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 },
  statValue: { fontSize: 17, marginBottom: 3, fontWeight: '800' },
  statKey: { fontSize: 9, letterSpacing: 0.7, textTransform: 'uppercase' },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    gap: 10,
  },
  streakEmoji: { fontSize: 22 },
  streakHint: { flex: 1, fontSize: 13, lineHeight: 18, textTransform: 'lowercase' },
  streakPill: {
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: 16,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakPillText: { fontSize: 16, fontWeight: '800' },
  sectionLabel: { fontSize: 10, letterSpacing: 1, marginBottom: 8 },
  themeRow: { flexDirection: 'row', gap: 8, borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 14 },
  themeChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  themeChipText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  accountBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginBottom: 22,
  },
  accountSheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  accountSheetDanger: {
    marginTop: 4,
  },
  accountFriendsBlock: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  sh: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 8 },
  sectionTitle: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
  calendarWrap: {
    marginHorizontal: 18,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
  },
  calendarHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 2,
  },
  calendarSelected: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  submissionsRow: {
    paddingHorizontal: 18,
    gap: 10,
    paddingBottom: 4,
  },
  cellLarge: {
    width: 140,
    height: 140,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  submissionThumbFill: { width: '100%', height: '100%' },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  submissionCell: {
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  empty: { paddingHorizontal: 18, paddingVertical: 12, fontSize: 13 },
  submissionsEmptyFlex: { justifyContent: 'center', paddingHorizontal: 22 },
  submissionsEmptyInner: { alignItems: 'center', paddingVertical: 12, marginTop: -24 },
  submissionsEmptyTitle: { fontSize: 17, marginBottom: 8, letterSpacing: -0.2, textAlign: 'center' },
  submissionsEmptySub: { fontSize: 13, lineHeight: 20, marginBottom: 14, textAlign: 'center' },
  submissionsEmptyCta: { fontSize: 13, letterSpacing: 0.4, fontWeight: '700', textAlign: 'center' },
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
  sheetTitle: { fontSize: 17, fontWeight: '800', marginBottom: 16 },
  fieldLabel: { fontSize: 10, letterSpacing: 1, marginBottom: 6 },
  sheetInput: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14, marginBottom: 10, fontSize: 14 },
  sheetAvatarBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 14 },
  sheetPrimary: { borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
});
