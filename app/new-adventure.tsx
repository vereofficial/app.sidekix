import { Video, ResizeMode } from 'expo-av';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/AppThemeContext';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { ADVENTURE_MAX_MEDIA_BYTES, ADVENTURE_MAX_VIDEO_MS } from '../src/lib/adventureMediaLimits';
import { prepareVideoForUpload } from '../src/lib/prepareVideoForUpload';
import { uploadPostMediaFromUri } from '../src/lib/uploadPostMedia';
import { MAX_TEXT_POST } from '../src/lib/textLimits';
import { useSavedSidequests } from '../src/hooks/useSavedSidequests';
import { tryGetSupabase } from '../src/lib/supabase';
import { font, getColors } from '../src/theme';
import type { SidequestRow } from '../src/types/database';

type AdventureTarget = {
  id: string;
  title: string;
  subtitle: string | null;
  source: 'sidequest' | 'legacy';
};

export default function NewAdventureScreen() {
  const router = useRouter();
  const { sidequestId: preselectedSidequestId, challengeId: preselectedChallengeId } = useLocalSearchParams<{
    sidequestId?: string;
    challengeId?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const scheme = resolvedScheme;
  const colors = getColors(resolvedScheme);
  const { user } = useAuth();
  const { savedIds, savedChallengeIds, toggleSaved, toggleSavedChallenge } = useSavedSidequests(user?.id);
  const [targets, setTargets] = useState<AdventureTarget[]>([]);
  const [targetSearch, setTargetSearch] = useState('');
  const [selectedTarget, setSelectedTarget] = useState<AdventureTarget | null>(null);
  const [body, setBody] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const [publishing, setPublishing] = useState(false);
  /** 0–1 while publishing; drives progress bar. */
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [publishLabel, setPublishLabel] = useState<string>('Posting…');
  const canPublish = useMemo(() => {
    if (!selectedTarget?.id) return false;
    const hasMedia = Boolean(mediaUri && mediaType);
    const hasText = body.trim().length > 0;
    return hasText || hasMedia;
  }, [selectedTarget?.id, body, mediaUri, mediaType]);
  const visibleTargets = useMemo(() => {
    const q = targetSearch.trim().toLowerCase();
    return q ? targets.filter((t) => `${t.title} ${t.subtitle ?? ''}`.toLowerCase().includes(q)) : targets;
  }, [targets, targetSearch]);

  const { width: windowW } = useWindowDimensions();
  const pickRowChipWidth = Math.max(
    108,
    (Math.min(560, windowW) - 18 * 2 - 10 * 2) / 3,
  );

  useEffect(() => {
    const load = async () => {
      const sb = tryGetSupabase();
      if (!sb) return;
      const [{ data: sqData }, { data: legacyData }] = await Promise.all([
        sb.from('sidequests').select('*').eq('approval_status', 'approved').order('created_at', { ascending: false }).limit(250),
        sb.from('challenges').select('id, title, subtitle').order('day', { ascending: false }).limit(250),
      ]);
      const sqRows = (sqData ?? []) as SidequestRow[];
      const nextTargets: AdventureTarget[] = [
        ...sqRows.map((r) => ({ id: r.id, title: r.title, subtitle: r.subtitle ?? null, source: 'sidequest' as const })),
        ...((legacyData ?? []) as { id: string; title: string; subtitle?: string | null }[]).map((r) => ({
          id: r.id,
          title: r.title,
          subtitle: r.subtitle ?? null,
          source: 'legacy' as const,
        })),
      ];
      setTargets(nextTargets);
      if (preselectedSidequestId) {
        const pre = nextTargets.find((r) => r.source === 'sidequest' && r.id === preselectedSidequestId);
        if (pre) setSelectedTarget(pre);
      } else if (preselectedChallengeId) {
        const pre = nextTargets.find((r) => r.source === 'legacy' && r.id === preselectedChallengeId);
        if (pre) setSelectedTarget(pre);
      }
    };
    void load();
  }, [preselectedSidequestId, preselectedChallengeId]);

  const pickMedia = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Photos', 'Photo library access is needed to attach media.');
        return;
      }
      const r = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.85,
        allowsMultipleSelection: false,
        videoMaxDuration: 30,
        ...(Platform.OS === 'ios'
          ? {
              /** Same strategy as `upload.tsx`: avoid Passthrough HEVC/MOV that fail read/upload for older library clips. */
              preferredAssetRepresentationMode:
                ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
              videoExportPreset: ImagePicker.VideoExportPreset.H264_1920x1080,
              videoQuality: ImagePicker.UIImagePickerControllerQualityType.High,
            }
          : {}),
      });
      if (r.canceled) return;
      const a = r.assets[0];
      if (!a?.uri) {
        Alert.alert('Photos', 'Could not read that item. If it is in iCloud, open Photos and let it download, then try again.');
        return;
      }
      const mime = (a.mimeType ?? '').toLowerCase();
      const isVideo =
        (a.type as string | undefined) === 'video' ||
        mime.startsWith('video') ||
        /\.(mp4|mov|webm|m4v)$/i.test(a.uri);

      if (isVideo && a.duration != null && a.duration > ADVENTURE_MAX_VIDEO_MS) {
        Alert.alert('Video too long', 'Adventure clips need to be 30 seconds or shorter. Trim in Photos or pick a shorter clip.');
        return;
      }
      if (a.fileSize != null && a.fileSize > ADVENTURE_MAX_MEDIA_BYTES) {
        Alert.alert(
          'File too large',
          `That file is over ${Math.round(ADVENTURE_MAX_MEDIA_BYTES / (1024 * 1024))} MB. Try a shorter video or smaller photo.`,
        );
        return;
      }

      let uri = a.uri;
      if (Platform.OS === 'ios' && LegacyFileSystem.cacheDirectory) {
        const cacheDir = LegacyFileSystem.cacheDirectory;
        const alreadyCached = uri.includes('/Caches/');
        if (!alreadyCached && isVideo) {
          const dest = `${cacheDir}pick-${Date.now()}.mp4`;
          try {
            await LegacyFileSystem.copyAsync({ from: uri, to: dest });
            const info = await LegacyFileSystem.getInfoAsync(dest);
            if (info.exists && 'size' in info && info.size > 0) uri = dest;
          } catch {
            /* keep picker uri; prepareVideoForUpload may still normalize */
          }
        }
      }

      if (isVideo || a.fileSize != null) {
        try {
          const info = await LegacyFileSystem.getInfoAsync(uri);
          if (info.exists && 'size' in info && info.size > ADVENTURE_MAX_MEDIA_BYTES) {
            Alert.alert(
              'File too large',
              `That file is over ${Math.round(ADVENTURE_MAX_MEDIA_BYTES / (1024 * 1024))} MB after export. Try a shorter clip.`,
            );
            return;
          }
        } catch {
          /* proceed */
        }
      }

      setMediaUri(uri);
      setMediaType(isVideo ? 'video' : 'image');
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isPh = /PHPhotos|Photos/i.test(msg);
      Alert.alert(
        'Photos',
        isPh
          ? "We couldn't read that photo or video. Try another one, or open the image in Photos first (iCloud) and retry."
          : 'Could not open the media library. Please try again.',
      );
    }
  };

  const publish = async () => {
    if (!user?.id) {
      Alert.alert('Sign in required', "You can't post until you sign in.");
      return;
    }
    if (!selectedTarget?.id) return;
    const sb = tryGetSupabase();
    if (!sb) return;

    setPublishing(true);
    setUploadProgress(0);
    setPublishLabel(mediaUri && mediaType ? 'Uploading…' : 'Posting…');
    try {
      let imagePath: string | null = null;
      let videoPath: string | null = null;
      if (mediaUri && mediaType) {
        try {
          const info = await LegacyFileSystem.getInfoAsync(mediaUri);
          if (info.exists && 'size' in info && info.size > ADVENTURE_MAX_MEDIA_BYTES) {
            Alert.alert(
              'File too large',
              `That file is over ${Math.round(ADVENTURE_MAX_MEDIA_BYTES / (1024 * 1024))} MB.`,
            );
            return;
          }
        } catch {
          /* continue */
        }

        const ext = mediaType === 'video' ? 'mp4' : 'jpg';
        const path = `${user.id}/sq-${Date.now()}.${ext}`;
        let readUri = mediaUri;
        let cleanup: (() => Promise<void>) | undefined;
        setUploadProgress(0.06);
        setPublishLabel('Preparing video…');
        if (mediaType === 'video') {
          const prepared = await prepareVideoForUpload(mediaUri);
          readUri = prepared.uri;
          cleanup = prepared.cleanup;
        }
        setUploadProgress(0.12);
        setPublishLabel('Uploading…');
        try {
          const effectiveContentType =
            mediaType === 'video' && readUri !== mediaUri ? 'video/mp4' : mediaType === 'video' ? 'video/mp4' : 'image/jpeg';
          const { pathForDb } = await uploadPostMediaFromUri({
            supabase: sb,
            userId: user.id,
            objectKey: path,
            fileUri: readUri,
            contentType: effectiveContentType,
            onProgress: (p) => setUploadProgress(0.12 + Math.min(1, Math.max(0, p)) * 0.76),
          });
          if (mediaType === 'video') videoPath = pathForDb;
          else imagePath = pathForDb;
        } finally {
          await cleanup?.();
        }
        setUploadProgress(0.9);
      } else {
        setUploadProgress(0.5);
      }

      setPublishLabel('Publishing…');

      const payload = {
        user_id: user.id,
        is_anonymous: anonymous,
        image_path: imagePath,
        video_path: videoPath,
      };
      const { error } =
        selectedTarget.source === 'legacy'
          ? await sb.from('posts').insert({
              ...payload,
              challenge_id: selectedTarget.id,
              caption: body.trim().slice(0, MAX_TEXT_POST),
            })
          : await sb.from('sidequest_posts').insert({
              ...payload,
              sidequest_id: selectedTarget.id,
              body: body.trim().slice(0, MAX_TEXT_POST),
            });
      if (error) {
        Alert.alert('Publish failed', error.message);
        return;
      }

      setUploadProgress(0.96);
      if (selectedTarget.source === 'sidequest' && savedIds.has(selectedTarget.id)) {
        await toggleSaved(selectedTarget.id);
      } else if (selectedTarget.source === 'legacy' && savedChallengeIds.has(selectedTarget.id)) {
        await toggleSavedChallenge(selectedTarget.id);
      }

      setUploadProgress(1);
      if (selectedTarget.source === 'sidequest') {
        router.replace({ pathname: '/rate-sidequest', params: { sidequestId: selectedTarget.id } });
      } else {
        router.replace('/(tabs)/feed');
      }
    } catch (e) {
      Alert.alert('Upload failed', e instanceof Error ? e.message : 'Could not upload media.');
    } finally {
      setPublishing(false);
      setUploadProgress(null);
    }
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.head}>
          <View style={styles.headSide}>
            <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back">
              <Text style={{ color: colors.text1, fontSize: 18 }}>←</Text>
            </Pressable>
          </View>
          <View style={styles.headCenter}>
            <View style={[styles.typePill, { backgroundColor: '#fff2ec' }]}>
              <Text style={{ color: '#c2580d', fontFamily: font.dmBold, fontSize: 11 }}>⚡ ADVENTURE</Text>
            </View>
          </View>
          <View style={[styles.headSide, styles.headSideEnd]}>
            <Pressable
              disabled={!canPublish || publishing}
              onPress={() => void publish()}
              style={[styles.postBtn, { backgroundColor: '#b84d11', opacity: canPublish && !publishing ? 1 : 0.5 }]}
            >
              {publishing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontFamily: font.dmBold, fontSize: 14 }}>post</Text>
              )}
            </Pressable>
          </View>
        </View>
        {publishing && uploadProgress != null ? (
          <View style={{ paddingHorizontal: 18, marginBottom: 8 }}>
            <View style={[styles.progressTrack, { backgroundColor: colors.bg3 }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.round(uploadProgress * 100)}%`,
                    backgroundColor: colors.accent,
                  },
                ]}
              />
            </View>
            <Text style={{ color: colors.text3, fontFamily: font.dm, fontSize: 11, marginTop: 6 }}>{publishLabel}</Text>
          </View>
        ) : null}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 18, gap: 12, paddingBottom: insets.bottom + 140 }}
        >
        <Pressable
          style={[styles.mediaDrop, { borderColor: colors.border2, backgroundColor: colors.card, opacity: publishing ? 0.55 : 1 }]}
          disabled={publishing}
          onPress={() => void pickMedia()}
        >
          {mediaUri && mediaType === 'image' ? (
            <Image source={{ uri: mediaUri }} style={styles.mediaPreview} contentFit="cover" />
          ) : mediaUri && mediaType === 'video' ? (
            <Video
              source={{ uri: mediaUri }}
              style={styles.mediaPreview}
              resizeMode={ResizeMode.COVER}
              shouldPlay={false}
              isMuted
              useNativeControls={false}
            />
          ) : (
            <Text style={{ color: colors.text3, fontFamily: font.dmBold, fontSize: 15 }}>📸</Text>
          )}
          {publishing && mediaUri ? (
            <View style={styles.uploadOverlay} pointerEvents="none">
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.uploadOverlayText}>{publishLabel}</Text>
            </View>
          ) : null}
          <Text style={{ color: colors.text2, fontFamily: font.dm, marginTop: mediaUri ? 10 : 6 }}>
            add photo or video{mediaUri ? '' : ' (optional)'}
          </Text>
          {mediaUri ? (
            <Text style={{ color: colors.text3, fontFamily: font.dm, marginTop: 4, fontSize: 12 }}>tap to replace</Text>
          ) : (
            <Text style={{ color: colors.text3, fontFamily: font.mono, marginTop: 4, fontSize: 10 }}>max 30 sec · 720p</Text>
          )}
        </Pressable>
        <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 11, letterSpacing: 1.4 }}>WHAT HAPPENED</Text>
        <TextInput
          placeholder={"where'd you go, what happened, was it worth it?"}
          placeholderTextColor={colors.text3}
          value={body}
          onChangeText={(t) => setBody(t.slice(0, MAX_TEXT_POST))}
          maxLength={MAX_TEXT_POST}
          multiline
          textAlignVertical="top"
          style={[styles.input, { color: colors.text1, borderColor: colors.border2, backgroundColor: colors.card, fontFamily: font.serifItalic }]}
        />
        <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 10 }}>{body.length} / {MAX_TEXT_POST}</Text>
        <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 11, letterSpacing: 1.4 }}>DID SOMEONE'S IDEA INSPIRE THIS?</Text>
        <View style={styles.searchRow}>
          <TextInput
            value={targetSearch}
            onChangeText={setTargetSearch}
            placeholder="search sidequests or add new one"
            placeholderTextColor={colors.text3}
            style={[styles.searchInput, { color: colors.text1, borderColor: colors.border2, backgroundColor: colors.card, fontFamily: font.dm }]}
            textAlignVertical="center"
            {...(Platform.OS === 'android' ? { includeFontPadding: false } : {})}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Suggest a new sidequest"
            onPress={() =>
              router.push({
                pathname: '/new-sidequest',
                params: targetSearch.trim() ? { draftTitle: targetSearch.trim() } : {},
              })
            }
            style={[styles.addNewBtn, { borderColor: colors.border2, backgroundColor: colors.card }]}
          >
            <Ionicons name="add" size={26} color={colors.accent} />
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.sidequestPickRow, { gap: 10, paddingRight: 26 }]}
        >
          {visibleTargets.map((target) => (
            <Pressable
              key={`${target.source}-${target.id}`}
              onPress={() => {
                if (selectedTarget?.id === target.id && selectedTarget?.source === target.source) {
                  setSelectedTarget(null);
                } else {
                  setSelectedTarget(target);
                }
              }}
              style={[
                styles.chip,
                { width: pickRowChipWidth, flexShrink: 0 },
                {
                  borderColor: colors.border2,
                  backgroundColor:
                    selectedTarget?.id === target.id && selectedTarget?.source === target.source ? colors.accentMuted : colors.card,
                },
              ]}
            >
              <Text style={{ color: colors.text1, fontFamily: font.dmBold, fontSize: 13 }}>
                {target.title}
              </Text>
              {target.subtitle ? (
                <Text style={{ color: colors.text3, fontFamily: font.dm, fontSize: 11, marginTop: 6 }} numberOfLines={2}>
                  {target.subtitle}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
        {visibleTargets.length > 3 ? (
          <Text style={{ color: colors.text3, fontFamily: font.dm, fontSize: 11, marginTop: 6 }}>
            Swipe sideways for more ideas
          </Text>
        ) : null}
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: anonymous }}
          accessibilityLabel="Post as anonymous"
          onPress={() => setAnonymous((x) => !x)}
          style={({ pressed }) => [
            styles.anonRow,
            {
              borderColor: colors.border2,
              backgroundColor: colors.card,
              opacity: pressed ? 0.92 : 1,
            },
          ]}
        >
          <Text style={{ fontSize: 20 }}>🕶️</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.anonTitle, { color: colors.text1, fontFamily: font.syne }]}>Post as anonymous</Text>
            <Text style={[styles.anonSub, { color: colors.text2, fontFamily: font.dm }]}>
              {anonymous
                ? 'Your username stays hidden on this adventure where supported.'
                : 'Turn on to hide your name on this post.'}
            </Text>
          </View>
          <View
            style={[
              styles.visSwitchTrack,
              {
                backgroundColor: anonymous ? colors.accent : colors.bg3,
                borderColor: anonymous ? colors.accent : colors.border2,
                justifyContent: anonymous ? 'flex-end' : 'flex-start',
              },
            ]}
          >
            <View
              style={[
                styles.visSwitchKnob,
                { backgroundColor: anonymous ? (scheme === 'light' ? '#fff' : '#0A0A0A') : colors.text3 },
              ]}
            />
          </View>
        </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: {
    paddingHorizontal: 18,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
    paddingBottom: 12,
  },
  headSide: { width: 88, justifyContent: 'center' },
  headSideEnd: { alignItems: 'flex-end' },
  headCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18 },
  typePill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  postBtn: { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  row: { gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    justifyContent: 'flex-start',
    minHeight: 100,
  },
  sidequestPickRow: {
    alignItems: 'stretch',
    paddingVertical: 2,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    paddingTop: Platform.OS === 'ios' ? 13 : 0,
    paddingBottom: Platform.OS === 'ios' ? 13 : 0,
    paddingVertical: Platform.OS === 'android' ? 0 : undefined,
  },
  addNewBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 18,
    minHeight: 120,
    textAlignVertical: 'top',
    lineHeight: 30,
  },
  mediaDrop: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  mediaPreview: { width: '100%', height: 200, borderRadius: 12, marginBottom: 4 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    width: '100%',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  uploadOverlayText: {
    color: '#fff',
    fontFamily: font.dmBold,
    fontSize: 13,
    marginTop: 10,
  },
  anonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginTop: 14,
  },
  anonTitle: { fontSize: 13, fontWeight: '700' },
  anonSub: { fontSize: 11, marginTop: 4, lineHeight: 15 },
  visSwitchTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  visSwitchKnob: { width: 20, height: 20, borderRadius: 10 },
  publish: { marginTop: 8, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
});
