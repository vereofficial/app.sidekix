import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../src/context/AuthContext';
import { useAppTheme } from '../src/context/AppThemeContext';
import { prepareVideoForUpload } from '../src/lib/prepareVideoForUpload';
import { readLocalUriAsArrayBuffer } from '../src/lib/readLocalMediaForUpload';
import { tryGetSupabase } from '../src/lib/supabase';
import { font, getColors } from '../src/theme';
import type { SidequestRow } from '../src/types/database';

export default function NewAdventureScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const { user } = useAuth();
  const [sidequests, setSidequests] = useState<SidequestRow[]>([]);
  const [sidequestId, setSidequestId] = useState<string | null>(null);
  const [body, setBody] = useState('');
  const [mediaUri, setMediaUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);
  const [anonymous, setAnonymous] = useState(false);
  const canPublish = useMemo(() => Boolean(sidequestId) && body.trim().length > 0, [sidequestId, body]);

  useEffect(() => {
    const load = async () => {
      const sb = tryGetSupabase();
      if (!sb) return;
      const { data } = await sb.from('sidequests').select('*').order('created_at', { ascending: false }).limit(30);
      setSidequests((data ?? []) as SidequestRow[]);
    };
    void load();
  }, []);

  const pickMedia = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.9 });
    if (r.canceled) return;
    const a = r.assets[0];
    const isVideo = (a.type ?? '').toLowerCase() === 'video';
    setMediaUri(a.uri);
    setMediaType(isVideo ? 'video' : 'image');
  };

  const publish = async () => {
    if (!user?.id) {
      Alert.alert('Sign in required', "You can't post until you sign in.");
      return;
    }
    if (!sidequestId) return;
    const sb = tryGetSupabase();
    if (!sb) return;

    let imagePath: string | null = null;
    let videoPath: string | null = null;
    if (mediaUri && mediaType) {
      const ext = mediaType === 'video' ? 'mp4' : 'jpg';
      const path = `${user.id}/sq-${Date.now()}.${ext}`;
      let readUri = mediaUri;
      let cleanup: (() => Promise<void>) | undefined;
      if (mediaType === 'video') {
        const prepared = await prepareVideoForUpload(mediaUri);
        readUri = prepared.uri;
        cleanup = prepared.cleanup;
      }
      try {
        const buf = await readLocalUriAsArrayBuffer(readUri);
        const { error: upErr } = await sb.storage.from('post-media').upload(path, buf, {
          contentType: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
          upsert: true,
        });
        if (upErr) throw upErr;
      } finally {
        await cleanup?.();
      }
      if (mediaType === 'video') videoPath = path;
      else imagePath = path;
    }

    const { error } = await sb.from('sidequest_posts').insert({
      sidequest_id: sidequestId,
      user_id: user.id,
      body: body.trim(),
      image_path: imagePath,
      video_path: videoPath,
      is_anonymous: anonymous,
    });
    if (error) {
      Alert.alert('Publish failed', error.message);
      return;
    }
    router.replace('/(tabs)/home');
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()}><Text style={{ color: colors.text1, fontSize: 18 }}>← back</Text></Pressable>
        <View style={[styles.typePill, { backgroundColor: '#fff2ec' }]}>
          <Text style={{ color: '#c2580d', fontFamily: font.dmBold, fontSize: 11 }}>⚡ ADVENTURE</Text>
        </View>
        <Pressable disabled={!canPublish} onPress={() => void publish()} style={[styles.postBtn, { backgroundColor: '#b84d11', opacity: canPublish ? 1 : 0.5 }]}>
          <Text style={{ color: '#fff', fontFamily: font.dmBold, fontSize: 14 }}>post</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
        <Pressable style={[styles.mediaDrop, { borderColor: colors.border2, backgroundColor: colors.card }]} onPress={() => void pickMedia()}>
          <Text style={{ color: colors.text3, fontFamily: font.dmBold, fontSize: 15 }}>📸</Text>
          <Text style={{ color: colors.text2, fontFamily: font.dm, marginTop: 6 }}>
            {mediaUri ? 'change photo or video' : 'add photo or video (optional)'}
          </Text>
          <Text style={{ color: colors.text3, fontFamily: font.mono, marginTop: 4, fontSize: 10 }}>max 30 sec · 720p</Text>
        </Pressable>
        <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 11, letterSpacing: 1.4 }}>WHAT HAPPENED</Text>
        <TextInput
          placeholder="where'd you go, what happened, was it worth it?"
          placeholderTextColor={colors.text3}
          value={body}
          onChangeText={setBody}
          multiline
          style={[styles.input, { color: colors.text1, borderColor: colors.border2, backgroundColor: colors.card, fontFamily: font.serifItalic }]}
        />
        <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 11, letterSpacing: 1.4 }}>DID SOMEONE'S IDEA INSPIRE THIS?</Text>
        <Text style={{ color: colors.text2, fontFamily: font.mono, fontSize: 11 }}>choose sidequest</Text>
        <View style={styles.row}>
          {sidequests.map((s) => (
            <Pressable
              key={s.id}
              onPress={() => setSidequestId(s.id)}
              style={[styles.chip, { borderColor: colors.border2, backgroundColor: sidequestId === s.id ? colors.accentMuted : colors.card }]}
            >
              <Text style={{ color: colors.text2, fontFamily: font.dm, fontSize: 12 }} numberOfLines={1}>{s.title}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ color: colors.text3, fontFamily: font.mono, fontSize: 11, letterSpacing: 1.4 }}>VISIBILITY</Text>
        <Pressable onPress={() => setAnonymous((x) => !x)}><Text style={{ color: colors.text2, fontFamily: font.dm }}>journal only: {anonymous ? 'yes' : 'no'}</Text></Pressable>
        <View style={[styles.noteBox, { borderColor: colors.border2, backgroundColor: colors.card }]}>
          <Text style={{ color: '#2f6a48', fontFamily: font.dmBold }}>🗂 journal only option</Text>
          <Text style={{ color: colors.text1, fontFamily: font.dm, marginTop: 6, lineHeight: 20 }}>
            Keep adventures private in your personal sidequest journal. Great for ones just for you.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { paddingHorizontal: 18, paddingTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#ddd', paddingBottom: 12 },
  title: { fontSize: 18 },
  typePill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  postBtn: { borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  row: { gap: 8 },
  chip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 18, minHeight: 120, textAlignVertical: 'top', lineHeight: 30 },
  mediaDrop: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 16, paddingVertical: 26, paddingHorizontal: 12, alignItems: 'center' },
  noteBox: { borderWidth: 1, borderRadius: 14, padding: 14, marginTop: 6 },
  publish: { marginTop: 8, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
});
