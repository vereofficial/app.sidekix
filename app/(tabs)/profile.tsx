import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme, type ThemePreference } from '../../src/context/AppThemeContext';
import { useMyPosts } from '../../src/hooks/useMyPosts';
import { useReadableStorageUrl } from '../../src/hooks/useReadableStorageUrl';
import { readLocalUriAsArrayBuffer } from '../../src/lib/readLocalMediaForUpload';
import { localCalendarYmd } from '../../src/lib/calendarDate';
import { tryGetSupabase } from '../../src/lib/supabase';
import { PostMediaTile } from '../../src/components/PostMediaTile';
import { statSidequestsKey, statReactionsKey } from '../../src/lib/formatCount';
import { hapticLight } from '../../src/lib/haptics';
import { font, getColors } from '../../src/theme';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: winH } = useWindowDimensions();
  const { resolvedScheme, preference, setPreference } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const scheme = resolvedScheme;
  const { user, profile, signOut, saveProfile, refreshProfile } = useAuth();
  const { posts, loading, refresh } = useMyPosts(user?.id);
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
  const [stats, setStats] = useState({ sidequests: 0, reactions: 0, won: 0, streak: 0 });

  useEffect(() => {
    setDraft(profile?.username ?? '');
  }, [profile?.username]);

  useEffect(() => {
    setAvatarUri(null);
  }, [profile?.avatar_path]);

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

        const { data: daysRows } = await sb.from('challenges').select('id,day').in('id', challengeIds);
        const daySet = new Set((daysRows ?? []).map((r: { day: string }) => r.day));
        const d = new Date();
        let run = 0;
        while (run < 365) {
          const day = localCalendarYmd(d);
          if (!daySet.has(day)) break;
          run += 1;
          d.setDate(d.getDate() - 1);
        }
        streak = run;
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

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPull} tintColor={colors.accent} />}
      >
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
              {stats.streak > 0 ? 'post today to keep it going' : 'post to start your streak'}
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

          <Pressable
            onPress={async () => {
              await signOut();
              router.replace('/');
            }}
            style={[styles.signOut, { borderColor: colors.border2 }]}
          >
            <Text style={{ color: colors.text2, fontFamily: font.syne, fontWeight: '700' }}>sign out</Text>
          </Pressable>
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
          <View style={styles.grid}>
            {posts.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => router.push(`/submission/${p.id}`)}
                style={styles.cell}
              >
                <PostMediaTile post={p} style={styles.submissionThumbFill} borderRadius={6} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

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
  signOut: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 22 },
  sh: { paddingHorizontal: 18, paddingTop: 4, paddingBottom: 8 },
  sectionTitle: { fontSize: 10, letterSpacing: 1.2, textTransform: 'uppercase' },
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
    paddingHorizontal: 18,
    gap: 3,
    justifyContent: 'space-between',
  },
  cell: {
    width: '32%',
    aspectRatio: 1,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 3,
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
