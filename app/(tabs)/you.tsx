import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme, type ThemePreference } from '../../src/context/AppThemeContext';
import { Wordmark } from '../../src/components/Wordmark';
import { MyPostsJournal } from '../../src/components/MyPostsJournal';
import { useJournalPosts } from '../../src/hooks/useJournalPosts';
import { useMyPosts } from '../../src/hooks/useMyPosts';
import { useReadableStorageUrl } from '../../src/hooks/useReadableStorageUrl';
import { tryGetSupabase } from '../../src/lib/supabase';
import { uploadPostMediaFromUri } from '../../src/lib/uploadPostMedia';
import { hapticLight } from '../../src/lib/haptics';
import { font, getColors } from '../../src/theme';

export default function YouScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme, preference, setPreference } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const scheme = resolvedScheme;
  const { user, profile, signOut, deleteAccount, saveProfile, refreshProfile } = useAuth();
  const { posts, refresh } = useMyPosts(user?.id);
  const { entries: journalEntries, refresh: refreshJournal } = useJournalPosts(user?.id);
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
  const [stats, setStats] = useState({ sidequests: 0, ideas: 0, credited: 0 });
  const [settingsOpen, setSettingsOpen] = useState(false);

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
        setStats({ sidequests: 0, ideas: 0, credited: 0 });
        return;
      }
      const challengeIds = [...new Set(posts.map((p) => p.challenge_id))];
      const sidequests = challengeIds.length;
      let ideas = 0;
      let credited = 0;
      const { count: ideasCount } = await sb
        .from('sidequests')
        .select('id', { count: 'exact', head: true })
        .eq('creator_id', user.id);
      ideas = ideasCount ?? 0;

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
          credited = [...bestByChallenge.values()].filter((r) => r.userId === user.id).length;
        }
      }
      setStats({ sidequests, ideas, credited });
    };
    void loadStats();
  }, [posts, user?.id]);

  const onPull = async () => {
    setRefreshing(true);
    await Promise.all([refresh(), refreshJournal(), refreshProfile()]);
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
        const contentType = (avatarMime && avatarMime.length > 0 ? avatarMime : null) ?? 'image/jpeg';
        const { pathForDb } = await uploadPostMediaFromUri({
          supabase: sb,
          userId: user.id,
          objectKey: path,
          fileUri: avatarUri,
          contentType,
        });
        uploadedAvatarPath = pathForDb;
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

  const challengesLabel = stats.sidequests === 1 ? 'CHALLENGE' : 'CHALLENGES';
  const ideasLabel = stats.ideas === 1 ? 'IDEA' : 'IDEAS';
  const impactTint =
    scheme === 'light'
      ? {
          bg: 'rgba(90, 122, 0, 0.09)',
          border: 'rgba(90, 122, 0, 0.22)',
          title: colors.accent,
          body: colors.text1,
        }
      : {
          bg: 'rgba(212, 255, 63, 0.08)',
          border: 'rgba(212, 255, 63, 0.22)',
          title: colors.accent,
          body: colors.text1,
        };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPull} tintColor={colors.accent} />}
      >
        <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center' }}>
          <View style={styles.header}>
            <View style={styles.wordmarkRow}>
              <View style={{ width: 44 }} />
              <View style={styles.wordmarkCenter}>
                <Wordmark colors={colors} size={23} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Settings"
                hitSlop={12}
                onPress={() => setSettingsOpen(true)}
                style={styles.gearBtn}
              >
                <Ionicons name="settings-outline" size={24} color={colors.text2} />
              </Pressable>
            </View>
            <View style={[styles.headerDivider, { backgroundColor: colors.border2 }]} />

            <View style={[styles.top, { paddingHorizontal: 18 }]}>
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
          </View>
        </View>

        <View style={[styles.statsRow, { borderColor: colors.border2, backgroundColor: colors.card }]}>
          <View style={[styles.statCell, { borderRightWidth: 1, borderRightColor: colors.border2 }]}>
            <Text style={[styles.statValue, { color: colors.accent, fontFamily: font.syneExtra }]}>
              {stats.sidequests.toLocaleString()}
            </Text>
            <Text style={[styles.statKey, { color: colors.text3, fontFamily: font.syne }]}>{challengesLabel}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={[styles.statValue, { color: colors.lightAccent, fontFamily: font.syneExtra }]}>
              {stats.ideas.toLocaleString()}
            </Text>
            <Text style={[styles.statKey, { color: colors.text3, fontFamily: font.syne }]}>{ideasLabel}</Text>
          </View>
        </View>

        <View style={{ width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 18 }}>
          <View
            style={[
              styles.impactCard,
              {
                borderColor: impactTint.border,
                backgroundColor: impactTint.bg,
              },
            ]}
          >
            <Text style={[styles.impactTitle, { color: impactTint.title, fontFamily: font.syne }]}>
              🏆 your impact
            </Text>
            <Text style={[styles.impactBody, { color: impactTint.body, fontFamily: font.dm }]}>
              {stats.credited === 0
                ? 'No one has done your ideas yet — your first one is next.'
                : `${stats.credited.toLocaleString()} ${
                    stats.credited === 1 ? 'person went' : 'people went'
                  } on real adventures because of your ideas.`}
            </Text>
          </View>

          <MyPostsJournal entries={journalEntries} colors={colors} />
        </View>
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

      <Modal visible={settingsOpen} animationType="slide" transparent onRequestClose={() => setSettingsOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Pressable style={styles.sheetBackdropDim} onPress={() => setSettingsOpen(false)} />
          <View
            style={[
              styles.settingsSheet,
              { backgroundColor: colors.bg2, paddingBottom: Math.max(insets.bottom, 20), borderColor: colors.border2 },
            ]}
          >
            <View style={styles.settingsSheetHandle} />
            <Text style={[styles.settingsSheetTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>settings</Text>
            <Text style={[styles.fieldLabel, { color: colors.text3, fontFamily: font.syne, marginTop: 4 }]}>APPEARANCE</Text>
            <View style={[styles.themeRow, { backgroundColor: colors.bg3, borderColor: colors.border2, marginBottom: 16 }]}>
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
                setSettingsOpen(false);
                await signOut();
                router.replace('/');
              }}
              style={[styles.accountSheetRow, { borderColor: colors.border2, backgroundColor: colors.card }]}
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
                          setErr(null);
                          setDeleteBusy(true);
                          const { error } = await deleteAccount();
                          setDeleteBusy(false);
                          if (error) {
                            Alert.alert('Could not delete account', error);
                            return;
                          }
                          setSettingsOpen(false);
                          router.replace('/');
                        })();
                      },
                    },
                  ],
                );
              }}
              style={[
                styles.accountSheetRow,
                styles.accountSheetDanger,
                { borderColor: 'rgba(255,80,80,0.35)', backgroundColor: colors.card },
              ]}
            >
              <Text style={{ color: '#f66', fontFamily: font.syne, fontWeight: '700' }}>delete account</Text>
            </Pressable>
            <Pressable onPress={() => setSettingsOpen(false)} style={{ paddingVertical: 12 }}>
              <Text style={{ textAlign: 'center', color: colors.text2, fontFamily: font.syne }}>close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  header: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 8 },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  wordmarkCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  gearBtn: { width: 44, alignItems: 'flex-end', justifyContent: 'center', paddingVertical: 4 },
  headerDivider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: 16,
  },
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
  statsRow: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderRadius: 0,
    flexDirection: 'row',
    marginBottom: 14,
    overflow: 'hidden',
  },
  statCell: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 4 },
  statValue: { fontSize: 17, marginBottom: 3, fontWeight: '800' },
  statKey: { fontSize: 9, letterSpacing: 0.7, textTransform: 'uppercase' },
  impactCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 18,
  },
  impactTitle: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  impactBody: { fontSize: 14, lineHeight: 21 },
  sectionLabel: { fontSize: 10, letterSpacing: 1, marginBottom: 8 },
  themeRow: { flexDirection: 'row', gap: 8, borderRadius: 12, borderWidth: 1, padding: 10, marginBottom: 14 },
  themeChip: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  themeChipText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  fieldLabel: { fontSize: 10, letterSpacing: 1, marginBottom: 6 },
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
  settingsSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  settingsSheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.35)',
    marginBottom: 14,
  },
  settingsSheetTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12 },
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
  sheetInput: { borderWidth: 1.5, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14, marginBottom: 10, fontSize: 14 },
  sheetAvatarBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 14 },
  sheetPrimary: { borderRadius: 50, paddingVertical: 14, alignItems: 'center', marginBottom: 8 },
});
