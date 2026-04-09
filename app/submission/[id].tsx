import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PostMediaTile } from '../../src/components/PostMediaTile';
import { useAuth } from '../../src/context/AuthContext';
import { useAppTheme } from '../../src/context/AppThemeContext';
import { copyPostLink, sharePostLink } from '../../src/lib/sharePost';
import { postShareUrl } from '../../src/constants/shareLinks';
import { tryGetSupabase } from '../../src/lib/supabase';
import { font, getColors } from '../../src/theme';
import type { PostRow } from '../../src/types/database';

export default function SubmissionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const { user } = useAuth();
  const [post, setPost] = useState<PostRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id || !user?.id) {
        setLoading(false);
        setErr('Not found');
        return;
      }
      const sb = tryGetSupabase();
      if (!sb) {
        setErr('Offline');
        setLoading(false);
        return;
      }
      const { data, error } = await sb.from('posts').select('*').eq('id', id).eq('user_id', user.id).maybeSingle();
      if (error || !data) {
        setErr(error?.message ?? 'Not found');
        setPost(null);
      } else {
        setPost(data as PostRow);
        setErr(null);
      }
      setLoading(false);
    };
    void load();
  }, [id, user?.id]);

  const cap = (post?.body ?? post?.caption ?? '').trim();

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text style={{ fontSize: 18, color: colors.text1 }}>←</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text1, fontFamily: font.syneExtra }]}>your take</Text>
        <View style={{ width: 24 }} />
      </View>
      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
      ) : err || !post ? (
        <Text style={[styles.err, { color: colors.text3, fontFamily: font.dm }]}>{err ?? 'Not found'}</Text>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, { borderColor: colors.border2 }]}>
            <PostMediaTile post={post} style={styles.heroMedia} borderRadius={16} />
          </View>
          {cap ? (
            <Text style={[styles.caption, { color: colors.text1, fontFamily: font.dm }]}>{cap}</Text>
          ) : null}
          <View style={styles.shareBlock}>
            <Text style={[styles.shareHint, { color: colors.text3, fontFamily: font.dm }]}>
              Share link (iMessage preview when share.joinsidekix.com page is live):
            </Text>
            <Text selectable style={[styles.shareUrl, { color: colors.text2, fontFamily: font.dm }]}>
              {postShareUrl(post.id)}
            </Text>
            <View style={styles.shareRow}>
              <Pressable
                onPress={() => void sharePostLink(post.id)}
                style={({ pressed }) => [
                  styles.shareBtn,
                  { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <Text
                  style={[
                    styles.shareBtnText,
                    { color: resolvedScheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.syne },
                  ]}
                >
                  share…
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void copyPostLink(post.id)}
                style={({ pressed }) => [
                  styles.shareBtnOutline,
                  { borderColor: colors.border2, opacity: pressed ? 0.88 : 1 },
                ]}
              >
                <Text style={[styles.shareBtnText, { color: colors.text1, fontFamily: font.syne }]}>copy</Text>
              </Pressable>
            </View>
          </View>
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
    paddingBottom: 8,
  },
  title: { fontSize: 16, fontWeight: '800', flex: 1, textAlign: 'center' },
  err: { paddingHorizontal: 22, marginTop: 24, fontSize: 14 },
  hero: {
    marginHorizontal: 18,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    width: undefined,
  },
  heroMedia: { width: '100%', aspectRatio: 3 / 4 },
  caption: { paddingHorizontal: 22, marginTop: 16, fontSize: 15, lineHeight: 22 },
  shareBlock: { paddingHorizontal: 22, marginTop: 22, gap: 10 },
  shareHint: { fontSize: 11, lineHeight: 16 },
  shareUrl: { fontSize: 12, lineHeight: 17 },
  shareRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  shareBtn: { flex: 1, borderRadius: 50, paddingVertical: 14, alignItems: 'center' },
  shareBtnOutline: {
    flex: 1,
    borderRadius: 50,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  shareBtnText: { fontSize: 14, fontWeight: '800' },
});
