import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { splitChallengeTitle } from '../../src/challenge';
import { PostMediaTile } from '../../src/components/PostMediaTile';
import { useAppTheme } from '../../src/context/AppThemeContext';
import { MARKETING_SITE_URL } from '../../src/constants/shareLinks';
import { tryGetSupabase } from '../../src/lib/supabase';
import { isSupabaseConfigured } from '../../src/lib/supabaseConfig';
import { MissingConfigScreen } from '../../src/screens/MissingConfigScreen';
import { font, getColors } from '../../src/theme';
import type { ChallengeRow, PostRow, ProfileRow } from '../../src/types/database';

/**
 * In-app / client route for `/p/[postId]`. On the web, Vercel rewrites the same path to `api/share-html`
 * (server HTML + OG). This screen still helps native or client-side navigation.
 */
export default function PublicPostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { resolvedScheme } = useAppTheme();
  const colors = getColors(resolvedScheme);
  const scheme = resolvedScheme;

  const [post, setPost] = useState<PostRow | null>(null);
  const [challenge, setChallenge] = useState<ChallengeRow | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!id || !isSupabaseConfigured()) {
        setLoading(false);
        if (!id) setErr('Invalid link');
        return;
      }
      const sb = tryGetSupabase();
      if (!sb) {
        setLoading(false);
        return;
      }
      const { data: row, error: pe } = await sb.from('posts').select('*').eq('id', id).maybeSingle();
      if (pe || !row) {
        setErr('This post could not be found.');
        setPost(null);
        setLoading(false);
        return;
      }
      const p = row as PostRow;
      setPost(p);
      const { data: ch } = await sb.from('challenges').select('*').eq('id', p.challenge_id).maybeSingle();
      setChallenge((ch as ChallengeRow) ?? null);
      if (!p.is_anonymous) {
        const { data: prof } = await sb.from('profiles').select('username').eq('id', p.user_id).maybeSingle();
        setUsername((prof as ProfileRow | null)?.username ?? null);
      } else {
        setUsername(null);
      }
      setErr(null);
      setLoading(false);
    };
    void load();
  }, [id]);

  if (!isSupabaseConfigured()) {
    return <MissingConfigScreen />;
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  if (err || !post) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg, paddingTop: insets.top, paddingHorizontal: 24 }]}>
        <Text style={[styles.title, { color: colors.text1, fontFamily: font.syneExtra }]}>Link not found</Text>
        <Text style={[styles.body, { color: colors.text2, fontFamily: font.dm, marginTop: 10, textAlign: 'center' }]}>
          {err ?? 'Something went wrong.'}
        </Text>
        <Pressable onPress={() => router.replace('/')} style={{ marginTop: 20 }}>
          <Text style={{ color: colors.accent, fontFamily: font.syne, fontWeight: '700' }}>Open Sidekix →</Text>
        </Pressable>
      </View>
    );
  }

  const cap = (post.body ?? post.caption ?? '').trim();
  const chParts = challenge ? splitChallengeTitle(challenge) : null;

  const onCta = () => {
    void Linking.openURL(MARKETING_SITE_URL);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Pressable onPress={() => router.replace('/')} hitSlop={12}>
          <Text style={{ fontSize: 18, color: colors.text1 }}>←</Text>
        </Pressable>
        <Text style={[styles.headTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>sidekix</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {challenge ? (
          <Text style={[styles.chTag, { color: colors.text3, fontFamily: font.syne }]}>
            {challenge.display_number ? `sidequest · #${challenge.display_number}` : 'sidequest'}
          </Text>
        ) : null}
        <Text style={[styles.chTitle, { color: colors.text1, fontFamily: font.syneExtra }]}>
          {chParts && challenge ? (
            <>
              {chParts.before}
              <Text style={{ color: colors.accent, fontStyle: 'normal' }}>{challenge.emphasis}</Text>
              {chParts.after}
            </>
          ) : (
            'Campus take'
          )}
        </Text>
        <Text style={[styles.byline, { color: colors.text2, fontFamily: font.dm }]}>
          {post.is_anonymous ? 'anonymous' : username ? `@${username}` : 'campus'}
        </Text>
        <View style={[styles.mediaWrap, { borderColor: colors.border2 }]}>
          <PostMediaTile post={post} style={styles.media} borderRadius={14} />
        </View>
        {cap ? (
          <Text style={[styles.caption, { color: colors.text1, fontFamily: font.dm }]}>{cap}</Text>
        ) : null}
        <Pressable
          onPress={onCta}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
          ]}
        >
          <Text
            style={[
              styles.ctaText,
              { color: scheme === 'light' ? '#fff' : '#0a0a0a', fontFamily: font.syne },
            ]}
          >
            post yours →
          </Text>
        </Pressable>
        {Platform.OS === 'web' ? (
          <Text style={[styles.webHint, { color: colors.text3, fontFamily: font.dm }]}>
            Opening this URL directly in a browser usually hits the server share page with Open Graph tags for
            Messages and other apps.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headTitle: { fontSize: 15, fontWeight: '800', flex: 1, textAlign: 'center' },
  title: { fontSize: 20, textAlign: 'center' },
  body: { fontSize: 14, lineHeight: 21 },
  chTag: { fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', paddingHorizontal: 18, marginTop: 8 },
  chTitle: { fontSize: 22, lineHeight: 28, letterSpacing: -0.3, paddingHorizontal: 18, marginTop: 6 },
  byline: { fontSize: 13, paddingHorizontal: 18, marginTop: 8 },
  mediaWrap: {
    marginHorizontal: 18,
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  media: { width: '100%', aspectRatio: 3 / 4 },
  caption: { paddingHorizontal: 22, marginTop: 16, fontSize: 15, lineHeight: 22 },
  cta: { marginHorizontal: 18, marginTop: 22, borderRadius: 50, paddingVertical: 16, alignItems: 'center' },
  ctaText: { fontSize: 15, fontWeight: '800' },
  webHint: { paddingHorizontal: 22, marginTop: 16, fontSize: 11, lineHeight: 16, textAlign: 'center' },
});
