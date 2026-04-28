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
    router.replace('/(tabs)/feed');
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()}><Text style={{ color: colors.text1, fontSize: 18 }}>←</Text></Pressable>
        <Text style={[styles.title, { color: colors.text1, fontFamily: font.syneExtra }]}>I went on an adventure</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
        <Text style={{ color: colors.text2, fontFamily: font.syne, fontSize: 11 }}>choose sidequest</Text>
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
        <TextInput
          placeholder="what happened?"
          placeholderTextColor={colors.text3}
          value={body}
          onChangeText={setBody}
          multiline
          style={[styles.input, { color: colors.text1, borderColor: colors.border2, backgroundColor: colors.card, fontFamily: font.dm }]}
        />
        <Pressable style={[styles.mediaBtn, { borderColor: colors.border2 }]} onPress={() => void pickMedia()}>
          <Text style={{ color: colors.text2, fontFamily: font.syne }}>{mediaUri ? 'change media' : 'add media (optional)'}</Text>
        </Pressable>
        <Pressable onPress={() => setAnonymous((x) => !x)}><Text style={{ color: colors.text2, fontFamily: font.dm }}>post as anonymous: {anonymous ? 'yes' : 'no'}</Text></Pressable>
        <Pressable
          disabled={!canPublish}
          onPress={() => void publish()}
          style={[styles.publish, { backgroundColor: canPublish ? colors.accent : colors.bg3 }]}
        >
          <Text style={{ color: canPublish ? (resolvedScheme === 'light' ? '#fff' : '#0A0A0A') : colors.text3, fontFamily: font.syne }}>publish</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { paddingHorizontal: 18, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: 18 },
  row: { gap: 8 },
  chip: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15, minHeight: 120, textAlignVertical: 'top' },
  mediaBtn: { borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  publish: { marginTop: 8, borderRadius: 999, paddingVertical: 14, alignItems: 'center' },
});
