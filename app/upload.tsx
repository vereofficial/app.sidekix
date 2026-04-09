import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/AppThemeContext';
import { usePostedToday } from '../src/hooks/usePostedToday';
import { useTodayChallenge } from '../src/hooks/useTodayChallenge';
import { hapticHeavy, hapticSuccess } from '../src/lib/haptics';
import { tryGetSupabase } from '../src/lib/supabase';
import { MAX_POST_CAPTION_CHARS } from '../src/constants/postText';
import { readLocalUriAsArrayBuffer } from '../src/lib/readLocalMediaForUpload';
import { font, getColors } from '../src/theme';

const MAX_VIDEO_MS = 10_000;

type CaptureMode = 'camera' | 'photo' | 'video' | 'text';

export default function UploadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const scheme = resolvedScheme;
  const { user } = useAuth();
  const { challenge, refresh: refCh } = useTodayChallenge();
  const postedToday = usePostedToday(user?.id);
  const [anon, setAnon] = useState(false);
  const [showWin, setShowWin] = useState(false);
  const winScale = useRef(new Animated.Value(0)).current;
  const winOp = useRef(new Animated.Value(0)).current;
  const [mode, setMode] = useState<CaptureMode>('camera');
  const [localUri, setLocalUri] = useState<string | null>(null);
  /** Picker-reported MIME; avoids wrong `contentType` when uploading bytes. */
  const [localMime, setLocalMime] = useState<string | null>(null);
  const [textBody, setTextBody] = useState('');
  const [busy, setBusy] = useState(false);

  const setModeAndClear = (m: CaptureMode) => {
    setMode(m);
    setLocalUri(null);
    setLocalMime(null);
    if (m !== 'text') setTextBody('');
  };

  const pick = async (fromCamera: boolean, media: 'image' | 'video') => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', fromCamera ? 'Camera access is required.' : 'Library access is required.');
      return;
    }
    const fn = fromCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const res = await fn({
      mediaTypes: media === 'video' ? ImagePicker.MediaTypeOptions.Videos : ImagePicker.MediaTypeOptions.Images,
      videoMaxDuration: 10,
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    const a = res.assets[0];
    if (media === 'video' && a.duration != null && a.duration > MAX_VIDEO_MS) {
      Alert.alert('Video too long', 'Pick a clip that is 10 seconds or shorter.');
      return;
    }
    setLocalUri(a.uri);
    setLocalMime(a.mimeType ?? null);
  };

  const onPreviewPress = () => {
    if (mode === 'camera') void pick(true, 'image');
    else if (mode === 'photo') void pick(false, 'image');
    else if (mode === 'video') void pick(false, 'video');
  };

  const submit = async () => {
    const sb = tryGetSupabase();
    if (!sb || !user?.id || !challenge) {
      Alert.alert('Missing', 'Sign in and ensure today’s challenge exists.');
      return;
    }

    const textTrim = textBody.trim();
    if (mode === 'text') {
      if (textTrim.length < 1) {
        Alert.alert('Add text', 'Write something for your take.');
        return;
      }
    } else if (!localUri) {
      Alert.alert('Add media', 'Choose a photo or video first.');
      return;
    }

    Keyboard.dismiss();
    setBusy(true);
    try {
      const baseRow: {
        challenge_id: string;
        user_id: string;
        is_anonymous: boolean;
        image_path?: string | null;
        video_path?: string | null;
        caption?: string | null;
      } = {
        challenge_id: challenge.id,
        user_id: user.id,
        is_anonymous: anon,
      };

      if (mode === 'text') {
        // Use `caption` so older DBs without a `body` column still work (avoids PostgREST schema errors).
        baseRow.caption = textTrim.slice(0, MAX_POST_CAPTION_CHARS);
      } else {
        const uri = localUri;
        if (!uri) return;
        const isVid = mode === 'video';
        const ext = isVid ? 'mp4' : 'jpg';
        const path = `${user.id}/${Date.now()}.${ext}`;
        const body = await readLocalUriAsArrayBuffer(uri);
        const contentType =
          (localMime && localMime.length > 0 ? localMime : null) ?? (isVid ? 'video/mp4' : 'image/jpeg');
        const { error: upErr } = await sb.storage.from('post-media').upload(path, body, {
          contentType,
          upsert: true,
        });
        if (upErr) throw upErr;
        if (isVid) baseRow.video_path = path;
        else baseRow.image_path = path;
      }

      const { error: insErr } = await sb.from('posts').insert(baseRow);
      if (insErr) throw insErr;
      await refCh();
      hapticHeavy();
      void hapticSuccess();
      winScale.setValue(0.2);
      winOp.setValue(0);
      setShowWin(true);
      Animated.parallel([
        Animated.timing(winOp, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.spring(winScale, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }),
      ]).start();
    } catch (e: unknown) {
      let msg = 'Upload failed';
      if (e && typeof e === 'object' && 'message' in e && typeof (e as { message: unknown }).message === 'string') {
        msg = (e as { message: string }).message;
      } else if (e instanceof Error) {
        msg = e.message;
      }
      Alert.alert('Upload', msg);
    } finally {
      setBusy(false);
    }
  };

  const canSubmit =
    mode === 'text' ? textBody.trim().length > 0 : Boolean(localUri);

  const quote = challenge ? challenge.title : 'No challenge for today';

  if (postedToday && challenge) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <View style={styles.head}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ fontSize: 18, color: colors.text1 }}>←</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text1, fontFamily: font.syneExtra }]}>today&apos;s sidequest</Text>
        </View>
        <View style={{ paddingHorizontal: 28, paddingTop: 32, gap: 12 }}>
          <Text style={{ fontSize: 42, textAlign: 'center' }}>✓</Text>
          <Text style={[styles.doneTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>
            you&apos;re already in for today
          </Text>
          <Text style={[styles.doneSub, { color: colors.text2, fontFamily: font.dm }]}>
            one post per sidequest. Catch reactions on the feed, or check back tomorrow.
          </Text>
          <Pressable
            onPress={() => router.replace('/feed')}
            style={({ pressed }) => [
              styles.doneBtn,
              { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
            ]}
          >
            <Text style={[styles.doneBtnText, { color: scheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.syne }]}>
              see campus feed →
            </Text>
          </Pressable>
          <Pressable onPress={() => router.back()}>
            <Text style={{ textAlign: 'center', color: colors.text3, fontFamily: font.syne, marginTop: 8 }}>go back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const tabStyle = (m: CaptureMode) => [
    styles.tab,
    {
      borderColor: mode === m ? colors.accent : colors.border,
      backgroundColor: mode === m ? (scheme === 'dark' ? '#D4FF3F10' : '#5a7a0010') : colors.card,
    },
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 8 : 0}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.head}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={{ fontSize: 18, color: colors.text1 }}>←</Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text1, fontFamily: font.syneExtra }]}>today&apos;s post</Text>
        </View>
        <View style={[styles.strip, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.dot, { backgroundColor: colors.accent }]} />
          <Text style={[styles.stripText, { color: colors.text1, fontFamily: font.syne }]}>{quote}</Text>
        </View>
        <View style={styles.tabs}>
          <Pressable onPress={() => setModeAndClear('camera')} style={tabStyle('camera')}>
            <Text style={{ fontSize: 16, marginBottom: 2 }}>📷</Text>
            <Text style={[styles.tabLabel, { fontFamily: font.syne, color: mode === 'camera' ? colors.accent : colors.text3 }]}>
              CAMERA
            </Text>
          </Pressable>
          <Pressable onPress={() => setModeAndClear('photo')} style={tabStyle('photo')}>
            <Text style={{ fontSize: 16, marginBottom: 2 }}>🖼️</Text>
            <Text style={[styles.tabLabel, { fontFamily: font.syne, color: mode === 'photo' ? colors.accent : colors.text3 }]}>
              PHOTO
            </Text>
          </Pressable>
          <Pressable onPress={() => setModeAndClear('video')} style={tabStyle('video')}>
            <Text style={{ fontSize: 16, marginBottom: 2 }}>🎬</Text>
            <Text style={[styles.tabLabel, { fontFamily: font.syne, color: mode === 'video' ? colors.accent : colors.text3 }]}>
              VIDEO
            </Text>
          </Pressable>
          <Pressable onPress={() => setModeAndClear('text')} style={tabStyle('text')}>
            <Text style={{ fontSize: 16, marginBottom: 2 }}>✏️</Text>
            <Text style={[styles.tabLabel, { fontFamily: font.syne, color: mode === 'text' ? colors.accent : colors.text3 }]}>
              TEXT
            </Text>
          </Pressable>
        </View>

        {mode === 'text' ? (
          <View style={{ marginHorizontal: 18, marginTop: 14 }}>
            <TextInput
              value={textBody}
              onChangeText={(t) => setTextBody(t.slice(0, MAX_POST_CAPTION_CHARS))}
              placeholder="what did you find?"
              placeholderTextColor={colors.text3}
              multiline
              maxLength={MAX_POST_CAPTION_CHARS}
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
              style={[
                styles.textBox,
                {
                  borderColor: scheme === 'dark' ? 'rgba(212,255,63,0.35)' : 'rgba(90,122,0,0.35)',
                  backgroundColor: scheme === 'dark' ? '#101210' : '#f6f7f2',
                  color: colors.text1,
                  fontFamily: font.dm,
                },
              ]}
            />
            <Text style={[styles.charCount, { color: colors.text3, fontFamily: font.dm }]}>
              {textBody.length} / {MAX_POST_CAPTION_CHARS}
            </Text>
          </View>
        ) : (
          <>
            <Pressable
              onPress={onPreviewPress}
              style={[styles.preview, { borderColor: colors.border2, backgroundColor: colors.card }]}
            >
              {localUri ? (
                mode === 'video' ? (
                  <Text style={[styles.previewTitle, { color: colors.text1, fontFamily: font.syne }]}>video selected ✓</Text>
                ) : (
                  <Image source={{ uri: localUri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                )
              ) : (
                <>
                  <Text style={{ fontSize: 32 }}>{mode === 'video' ? '🎬' : '📷'}</Text>
                  <Text style={[styles.previewTitle, { color: colors.text1, fontFamily: font.syne }]}>
                    {mode === 'camera' ? 'take a photo' : mode === 'video' ? 'pick a video (max 10s)' : 'choose a photo'}
                  </Text>
                  <Text style={[styles.previewSub, { color: colors.text3, fontFamily: font.dm }]}>
                    {mode === 'camera' ? 'tap to open camera' : 'tap to open library'}
                  </Text>
                </>
              )}
            </Pressable>
            {mode === 'video' ? (
              <Pressable onPress={() => pick(true, 'video')} style={{ marginHorizontal: 18, marginTop: 8 }}>
                <Text style={{ color: colors.accent, fontFamily: font.syne, fontSize: 12, fontWeight: '700' }}>
                  or record with camera →
                </Text>
              </Pressable>
            ) : null}
          </>
        )}

        <View style={[styles.anonRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={{ fontSize: 18 }}>👤</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.atLabel, { color: colors.text1, fontFamily: font.syne }]}>post anonymously</Text>
            <Text style={[styles.atSub, { color: colors.text2, fontFamily: font.dm }]}>
              {anon ? 'shown as anon on the public feed' : 'your username shows on campus unless you toggle this on'}
            </Text>
          </View>
          <Pressable
            onPress={() => setAnon((a) => !a)}
            style={[
              styles.toggle,
              {
                backgroundColor: anon ? colors.accent : colors.bg3,
                borderColor: anon ? colors.accent : colors.border2,
                justifyContent: anon ? 'flex-end' : 'flex-start',
              },
            ]}
          >
            <View
              style={[
                styles.knob,
                { backgroundColor: anon ? (scheme === 'light' ? '#fff' : '#0A0A0A') : colors.text3 },
              ]}
            />
          </Pressable>
        </View>

        <Pressable
          onPress={submit}
          disabled={busy || !canSubmit}
          style={({ pressed }) => [
            { marginHorizontal: 18, marginTop: 14, borderRadius: 50, overflow: 'hidden', opacity: pressed || busy || !canSubmit ? 0.75 : 1 },
          ]}
        >
          <LinearGradient
            colors={scheme === 'dark' ? ['#D4FF3F', '#9fb82e'] : ['#5a7a00', '#7a9a20']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.submit}
          >
            {busy ? (
              <ActivityIndicator color={scheme === 'light' ? '#fff' : '#0a0a0a'} />
            ) : (
              <Text style={[styles.submitText, { color: scheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.syne }]}>
                post it →
              </Text>
            )}
          </LinearGradient>
        </Pressable>
      </ScrollView>
      <Modal visible={showWin} transparent animationType="none" statusBarTranslucent>
        <Animated.View style={[styles.winBackdrop, { opacity: winOp }]}>
          <Animated.View
            style={[
              styles.winCard,
              { backgroundColor: colors.card, borderColor: colors.border2, transform: [{ scale: winScale }] },
            ]}
          >
            <Text style={styles.winEmoji}>✓</Text>
            <Text style={[styles.winTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>you&apos;re on the board</Text>
            <Text style={[styles.winSub, { color: colors.text2, fontFamily: font.dm }]}>
              nice — campus will see it on the feed
            </Text>
            <Pressable
              onPress={() => {
                setShowWin(false);
                router.push('/sharecard');
              }}
              style={({ pressed }) => [
                styles.winShareBtn,
                {
                  borderColor: colors.accent,
                  backgroundColor: scheme === 'dark' ? 'rgba(212,255,63,0.12)' : 'rgba(90,122,0,0.1)',
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text style={[styles.winShareText, { color: colors.accent, fontFamily: font.syne }]}>
                share your rank →
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setShowWin(false);
                router.back();
              }}
              style={({ pressed }) => [styles.winDoneBtn, { opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.winDoneText, { color: colors.text1, fontFamily: font.dm }]}>done</Text>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingTop: 16 },
  title: { fontSize: 16, fontWeight: '800' },
  strip: {
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 11,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  stripText: { fontSize: 12, fontWeight: '700', flex: 1 },
  tabs: { flexDirection: 'row', gap: 5, paddingHorizontal: 18, paddingTop: 14 },
  tab: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingVertical: 8, alignItems: 'center' },
  tabLabel: { fontSize: 8, letterSpacing: 0.6, textTransform: 'uppercase', fontWeight: '700' },
  preview: {
    marginHorizontal: 18,
    marginTop: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 16,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    overflow: 'hidden',
  },
  previewTitle: { fontSize: 13, fontWeight: '700' },
  previewSub: { fontSize: 11 },
  textBox: {
    minHeight: 160,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  charCount: { fontSize: 11, marginTop: 8, textAlign: 'right' },
  anonRow: {
    marginHorizontal: 18,
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  atLabel: { fontSize: 13, fontWeight: '700' },
  atSub: { fontSize: 11, marginTop: 1 },
  toggle: {
    width: 42,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  knob: { width: 18, height: 18, borderRadius: 9 },
  submit: { paddingVertical: 15, alignItems: 'center' },
  submitText: { fontSize: 15, fontWeight: '800' },
  doneTitle: { fontSize: 22, lineHeight: 28, textAlign: 'center', letterSpacing: -0.3 },
  doneSub: { fontSize: 14, lineHeight: 21, textAlign: 'center' },
  doneBtn: { marginTop: 16, borderRadius: 50, paddingVertical: 15, alignItems: 'center' },
  doneBtnText: { fontSize: 15, fontWeight: '800' },
  winBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  winCard: {
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    maxWidth: 320,
  },
  winEmoji: { fontSize: 48, marginBottom: 8 },
  winTitle: { fontSize: 20, textAlign: 'center', letterSpacing: -0.3 },
  winSub: { fontSize: 13, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  winShareBtn: {
    marginTop: 18,
    borderRadius: 50,
    borderWidth: 1.5,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    width: '100%',
  },
  winShareText: { fontSize: 14, fontWeight: '800' },
  winDoneBtn: { marginTop: 10, paddingVertical: 8 },
  winDoneText: { fontSize: 14, textAlign: 'center' },
});
